/**
 * Renew Subscriptions Edge Function
 * Scheduled function to process subscription auto-renewals
 * Should be triggered daily via Supabase cron job
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Days before expiry to attempt renewal
const RENEWAL_DAYS_BEFORE = 3;

interface RenewalStats {
  subscriptionsChecked: number;
  renewalsAttempted: number;
  renewalsSuccessful: number;
  renewalsFailed: number;
  expired: number;
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

    const stats: RenewalStats = {
      subscriptionsChecked: 0,
      renewalsAttempted: 0,
      renewalsSuccessful: 0,
      renewalsFailed: 0,
      expired: 0,
    };

    // Find subscriptions that need renewal
    const renewalThreshold = new Date();
    renewalThreshold.setDate(renewalThreshold.getDate() + RENEWAL_DAYS_BEFORE);

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        profile:profiles!user_id (
          id,
          email
        )
      `)
      .eq('status', 'active')
      .eq('auto_renew', true)
      .lt('current_period_end', renewalThreshold.toISOString());

    if (error) {
      console.error('Failed to fetch subscriptions:', error);
      throw error;
    }

    stats.subscriptionsChecked = subscriptions?.length ?? 0;
    console.log(`Found ${stats.subscriptionsChecked} subscriptions to process`);

    for (const subscription of subscriptions ?? []) {
      try {
        const result = await processSubscriptionRenewal(supabase, subscription);

        if (result.success) {
          stats.renewalsSuccessful++;
        } else if (result.expired) {
          stats.expired++;
        } else {
          stats.renewalsFailed++;
        }

        stats.renewalsAttempted++;
      } catch (error) {
        console.error(`Failed to process subscription ${subscription.id}:`, error);
        stats.renewalsFailed++;
      }
    }

    // Process expired subscriptions
    await processExpiredSubscriptions(supabase, stats);

    console.log('Subscription renewal complete:', stats);

    return new Response(
      JSON.stringify({ success: true, stats }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Subscription renewal error:', error);
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
 * Process single subscription renewal
 */
async function processSubscriptionRenewal(
  supabase: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>
): Promise<{ success: boolean; expired?: boolean }> {
  const userId = subscription.user_id as string;
  const subscriptionType = subscription.type as string;
  const currentPeriodEnd = new Date(subscription.current_period_end as string);

  // Check if already expired
  if (currentPeriodEnd < new Date()) {
    console.log(`Subscription ${subscription.id} has already expired`);
    return { success: false, expired: true };
  }

  // Get user's saved card binding
  const binding = await getUserBinding(userId);

  if (!binding) {
    console.log(`No saved payment method for user ${userId}`);
    await sendRenewalReminder(supabase, userId, subscriptionType, currentPeriodEnd);
    return { success: false };
  }

  // Attempt payment
  const paymentResult = await attemptRecurringPayment(
    userId,
    subscriptionType,
    binding.bindingId
  );

  if (paymentResult.success) {
    // Extend subscription
    const newPeriodEnd = new Date(currentPeriodEnd);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

    await supabase
      .from('subscriptions')
      .update({
        current_period_start: currentPeriodEnd.toISOString(),
        current_period_end: newPeriodEnd.toISOString(),
      })
      .eq('id', subscription.id);

    await supabase
      .from('profiles')
      .update({
        subscription_expires_at: newPeriodEnd.toISOString(),
      })
      .eq('id', userId);

    await sendRenewalConfirmation(supabase, userId, subscriptionType, newPeriodEnd);

    console.log(`Successfully renewed subscription ${subscription.id}`);
    return { success: true };
  } else {
    // Payment failed
    await sendPaymentFailedNotification(supabase, userId);
    return { success: false };
  }
}

/**
 * Get user's saved card binding
 */
async function getUserBinding(userId: string): Promise<{ bindingId: string } | null> {
  const alfaApiUrl = Deno.env.get('ALFA_API_URL') ?? 'https://pay.alfabank.ru/payment';
  const merchantLogin = Deno.env.get('ALFA_MERCHANT_LOGIN') ?? '';
  const merchantPassword = Deno.env.get('ALFA_MERCHANT_PASSWORD') ?? '';

  // STUB MODE
  if (!merchantLogin) {
    console.log('[STUB] Returning mock binding');
    return { bindingId: 'stub_binding_1' };
  }

  const params = new URLSearchParams({
    userName: merchantLogin,
    password: merchantPassword,
    clientId: userId,
  });

  try {
    const response = await fetch(`${alfaApiUrl}/rest/getBindings.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    if (data.bindings && data.bindings.length > 0) {
      return { bindingId: data.bindings[0].bindingId };
    }
  } catch (error) {
    console.error('Failed to get bindings:', error);
  }

  return null;
}

/**
 * Attempt recurring payment
 */
async function attemptRecurringPayment(
  userId: string,
  subscriptionType: string,
  bindingId: string
): Promise<{ success: boolean }> {
  const alfaApiUrl = Deno.env.get('ALFA_API_URL') ?? 'https://pay.alfabank.ru/payment';
  const merchantLogin = Deno.env.get('ALFA_MERCHANT_LOGIN') ?? '';
  const merchantPassword = Deno.env.get('ALFA_MERCHANT_PASSWORD') ?? '';

  // Determine amount
  const prices: Record<string, number> = {
    participant: 19900, // 199 rubles in kopecks
    organizer: 49900,   // 499 rubles
  };
  const amount = prices[subscriptionType] ?? 19900;

  // STUB MODE
  if (!merchantLogin) {
    console.log('[STUB] Simulating successful recurring payment');
    return { success: true };
  }

  const orderNumber = `renewal_${userId.slice(0, 8)}_${Date.now()}`;

  const params = new URLSearchParams({
    userName: merchantLogin,
    password: merchantPassword,
    orderNumber,
    amount: amount.toString(),
    bindingId,
    description: `Продление подписки MeetUp.local`,
  });

  try {
    const response = await fetch(`${alfaApiUrl}/rest/paymentOrderBinding.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    return { success: data.errorCode === '0' || data.errorCode === 0 };
  } catch (error) {
    console.error('Recurring payment failed:', error);
    return { success: false };
  }
}

/**
 * Process expired subscriptions
 */
async function processExpiredSubscriptions(
  supabase: ReturnType<typeof createClient>,
  stats: RenewalStats
): Promise<void> {
  const now = new Date();

  // Find expired subscriptions that are still marked as active
  const { data: expired, error } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('status', 'active')
    .lt('current_period_end', now.toISOString());

  if (error) {
    console.error('Failed to fetch expired subscriptions:', error);
    return;
  }

  for (const subscription of expired ?? []) {
    // Mark subscription as expired
    await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('id', subscription.id);

    // Update profile to free tier
    await supabase
      .from('profiles')
      .update({
        subscription_type: 'free',
        subscription_expires_at: null,
      })
      .eq('id', subscription.user_id);

    stats.expired++;
  }
}

/**
 * Send renewal reminder notification
 */
async function sendRenewalReminder(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  subscriptionType: string,
  expiresAt: Date
): Promise<void> {
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) return;

  const daysLeft = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const messages = tokens.map((t) => ({
    to: t.token,
    title: 'Подписка скоро истекает',
    body: `Ваша подписка ${subscriptionType === 'organizer' ? 'Организатор' : 'Участник'} истекает через ${daysLeft} дней. Добавьте способ оплаты для автоматического продления.`,
    data: {
      type: 'subscription_reminder',
    },
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error('Failed to send reminder:', error);
  }
}

/**
 * Send renewal confirmation notification
 */
async function sendRenewalConfirmation(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  subscriptionType: string,
  newExpiryDate: Date
): Promise<void> {
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: 'Подписка продлена',
    body: `Ваша подписка ${subscriptionType === 'organizer' ? 'Организатор' : 'Участник'} успешно продлена до ${newExpiryDate.toLocaleDateString('ru-RU')}.`,
    data: {
      type: 'subscription_renewed',
    },
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error('Failed to send confirmation:', error);
  }
}

/**
 * Send payment failed notification
 */
async function sendPaymentFailedNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<void> {
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: 'Не удалось продлить подписку',
    body: 'Автоматическое продление не удалось. Пожалуйста, обновите способ оплаты, чтобы сохранить доступ.',
    data: {
      type: 'payment_failed',
    },
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error('Failed to send payment failed notification:', error);
  }
}
