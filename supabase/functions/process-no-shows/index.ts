/**
 * Process No-Shows Edge Function
 * Scheduled function to handle no-show participants after events end
 * Should be triggered via Supabase cron job
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// No-show threshold - number of no-shows before penalty
const NO_SHOW_THRESHOLD = 3;
// Time window for no-show count (days)
const NO_SHOW_WINDOW_DAYS = 30;
// Suspension duration (days)
const SUSPENSION_DAYS = 7;

interface ProcessingStats {
  eventsProcessed: number;
  noShowsMarked: number;
  usersPenalized: number;
  notificationsSent: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const stats: ProcessingStats = {
      eventsProcessed: 0,
      noShowsMarked: 0,
      usersPenalized: 0,
      notificationsSent: 0,
    };

    // Find events that ended in the last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const now = new Date();

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, ends_at, organizer_id')
      .lt('ends_at', now.toISOString())
      .gt('ends_at', twentyFourHoursAgo.toISOString())
      .eq('no_shows_processed', false);

    if (eventsError) {
      console.error('Failed to fetch events:', eventsError);
      throw eventsError;
    }

    console.log(`Found ${events?.length ?? 0} events to process`);

    for (const event of events ?? []) {
      try {
        await processEventNoShows(supabase, event, stats);
        stats.eventsProcessed++;
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error);
      }
    }

    // Check users with too many no-shows
    await checkAndPenalizeNoShowUsers(supabase, stats);

    console.log('Processing complete:', stats);

    return new Response(
      JSON.stringify({ success: true, stats }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('No-show processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Process no-shows for a single event
 */
async function processEventNoShows(
  supabase: ReturnType<typeof createClient>,
  event: { id: string; title: string; ends_at: string; organizer_id: string },
  stats: ProcessingStats
): Promise<void> {
  // Get participants who are still marked as 'confirmed' (not attended, not already marked as no_show)
  const { data: noShowParticipants, error } = await supabase
    .from('participants')
    .select('id, user_id, event_id')
    .eq('event_id', event.id)
    .eq('status', 'confirmed');

  if (error) {
    throw error;
  }

  if (!noShowParticipants || noShowParticipants.length === 0) {
    // Mark event as processed even if no no-shows
    await supabase
      .from('events')
      .update({ no_shows_processed: true })
      .eq('id', event.id);
    return;
  }

  console.log(`Event ${event.id}: ${noShowParticipants.length} no-shows`);

  // Mark participants as no_show
  const participantIds = noShowParticipants.map((p) => p.id);
  await supabase
    .from('participants')
    .update({ status: 'no_show' })
    .in('id', participantIds);

  stats.noShowsMarked += noShowParticipants.length;

  // Create no-show records for tracking
  const noShowRecords = noShowParticipants.map((p) => ({
    user_id: p.user_id,
    event_id: event.id,
    recorded_at: new Date().toISOString(),
  }));

  await supabase.from('no_show_records').insert(noShowRecords);

  // Send notifications to no-show users
  for (const participant of noShowParticipants) {
    await sendNoShowNotification(supabase, participant.user_id, event.title);
    stats.notificationsSent++;
  }

  // Notify organizer
  await sendOrganizerNoShowSummary(
    supabase,
    event.organizer_id,
    event.title,
    noShowParticipants.length
  );

  // Mark event as processed
  await supabase
    .from('events')
    .update({ no_shows_processed: true })
    .eq('id', event.id);
}

/**
 * Check and penalize users with too many no-shows
 */
async function checkAndPenalizeNoShowUsers(
  supabase: ReturnType<typeof createClient>,
  stats: ProcessingStats
): Promise<void> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - NO_SHOW_WINDOW_DAYS);

  // Find users with too many no-shows
  const { data: noShowCounts, error } = await supabase
    .from('no_show_records')
    .select('user_id')
    .gte('recorded_at', windowStart.toISOString());

  if (error || !noShowCounts) {
    console.error('Failed to get no-show counts:', error);
    return;
  }

  // Count no-shows per user
  const userNoShowCounts = new Map<string, number>();
  for (const record of noShowCounts) {
    const count = userNoShowCounts.get(record.user_id) ?? 0;
    userNoShowCounts.set(record.user_id, count + 1);
  }

  // Find users exceeding threshold
  const usersToSuspend: string[] = [];
  for (const [userId, count] of userNoShowCounts) {
    if (count >= NO_SHOW_THRESHOLD) {
      usersToSuspend.push(userId);
    }
  }

  if (usersToSuspend.length === 0) {
    return;
  }

  console.log(`Suspending ${usersToSuspend.length} users for excessive no-shows`);

  // Check which users are not already suspended
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, suspended_until')
    .in('id', usersToSuspend);

  const now = new Date();
  const suspensionEnd = new Date();
  suspensionEnd.setDate(suspensionEnd.getDate() + SUSPENSION_DAYS);

  for (const profile of profiles ?? []) {
    // Skip if already suspended
    if (profile.suspended_until && new Date(profile.suspended_until) > now) {
      continue;
    }

    // Suspend user
    await supabase
      .from('profiles')
      .update({
        suspended_until: suspensionEnd.toISOString(),
        suspension_reason: 'excessive_no_shows',
      })
      .eq('id', profile.id);

    // Send suspension notification
    await sendSuspensionNotification(supabase, profile.id, SUSPENSION_DAYS);

    stats.usersPenalized++;
  }
}

/**
 * Send notification to user about their no-show
 */
async function sendNoShowNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  eventTitle: string
): Promise<void> {
  // Get user's push tokens
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) {
    return;
  }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: 'Вы пропустили встречу',
    body: `Вы были отмечены как "не пришёл" на встречу "${eventTitle}". Пожалуйста, предупреждайте организатора об отмене.`,
    data: {
      type: 'no_show',
    },
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error('Failed to send no-show notification:', error);
  }
}

/**
 * Send summary to organizer about no-shows
 */
async function sendOrganizerNoShowSummary(
  supabase: ReturnType<typeof createClient>,
  organizerId: string,
  eventTitle: string,
  noShowCount: number
): Promise<void> {
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', organizerId);

  if (!tokens || tokens.length === 0) {
    return;
  }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: 'Итоги встречи',
    body: `"${eventTitle}": ${noShowCount} участников не пришли и были отмечены.`,
    data: {
      type: 'no_show_summary',
    },
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error('Failed to send organizer summary:', error);
  }
}

/**
 * Send suspension notification to user
 */
async function sendSuspensionNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  days: number
): Promise<void> {
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) {
    return;
  }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: 'Аккаунт временно ограничен',
    body: `Из-за частых неявок ваш аккаунт ограничен на ${days} дней. Вы не сможете записываться на новые встречи.`,
    data: {
      type: 'suspension',
    },
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error('Failed to send suspension notification:', error);
  }
}
