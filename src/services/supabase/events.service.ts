/**
 * Events Service
 * Handles all event-related database operations
 * Optimized for high-load: 10K concurrent events
 */

import type {
  Event,
  EventCreateInput,
  EventFilters,
  EventParticipant,
  EventUpdateInput,
  GeoPoint,
  PaginatedResult,
  PaginationParams,
} from '@/types';

import { deduplicateRequest, supabase, withRetry } from './client';

// ============================================================================
// Types
// ============================================================================

interface EventResult {
  event: Event | null;
  error: Error | null;
}

interface EventsResult {
  events: Event[];
  error: Error | null;
}

interface ParticipantsResult {
  participants: EventParticipant[];
  error: Error | null;
}

// ============================================================================
// Event CRUD Operations
// ============================================================================

/**
 * Create a new event
 */
export async function createEvent(input: EventCreateInput): Promise<EventResult> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { event: null, error: new Error('Authentication required') };
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      organizer_id: user.id,
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      tags: input.tags ?? [],
      cover_image_url: input.coverImageUrl,
      starts_at: input.startsAt.toISOString(),
      duration_minutes: input.durationMinutes,
      location: `POINT(${input.location.longitude} ${input.location.latitude})`,
      address: input.address,
      place_name: input.placeName,
      place_details: input.placeDetails,
      city: input.city,
      min_participants: input.minParticipants ?? 2,
      max_participants: input.maxParticipants,
      requires_approval: input.requiresApproval ?? false,
      allow_chat: input.allowChat ?? true,
      entry_fee: input.entryFee ?? 0,
      status: 'published',
    })
    .select(EVENT_SELECT_QUERY)
    .single();

  if (error) {
    return { event: null, error: new Error(error.message) };
  }

  return { event: transformEvent(data), error: null };
}

/**
 * Update an existing event
 */
export async function updateEvent(
  eventId: string,
  input: EventUpdateInput
): Promise<EventResult> {
  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) {
    updateData.title = input.title;
  }
  if (input.description !== undefined) {
    updateData.description = input.description;
  }
  if (input.categoryId !== undefined) {
    updateData.category_id = input.categoryId;
  }
  if (input.tags !== undefined) {
    updateData.tags = input.tags;
  }
  if (input.startsAt !== undefined) {
    updateData.starts_at = input.startsAt.toISOString();
  }
  if (input.durationMinutes !== undefined) {
    updateData.duration_minutes = input.durationMinutes;
  }
  if (input.location !== undefined) {
    updateData.location = `POINT(${input.location.longitude} ${input.location.latitude})`;
  }
  if (input.address !== undefined) {
    updateData.address = input.address;
  }
  if (input.placeName !== undefined) {
    updateData.place_name = input.placeName;
  }
  if (input.placeDetails !== undefined) {
    updateData.place_details = input.placeDetails;
  }
  if (input.city !== undefined) {
    updateData.city = input.city;
  }
  if (input.maxParticipants !== undefined) {
    updateData.max_participants = input.maxParticipants;
  }
  if (input.requiresApproval !== undefined) {
    updateData.requires_approval = input.requiresApproval;
  }
  if (input.allowChat !== undefined) {
    updateData.allow_chat = input.allowChat;
  }
  if (input.status !== undefined) {
    updateData.status = input.status;
  }
  if (input.cancelledReason !== undefined) {
    updateData.cancelled_reason = input.cancelledReason;
  }

  const { data, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .select(EVENT_SELECT_QUERY)
    .single();

  if (error) {
    return { event: null, error: new Error(error.message) };
  }

  return { event: transformEvent(data), error: null };
}

/**
 * Get event by ID
 */
export async function getEventById(eventId: string): Promise<EventResult> {
  return deduplicateRequest(`event:${eventId}`, async () => {
    const { data, error } = await withRetry(() =>
      supabase
        .from('events')
        .select(EVENT_SELECT_QUERY)
        .eq('id', eventId)
        .single()
    );

    if (error) {
      return { event: null, error: new Error(error.message) };
    }

    return { event: transformEvent(data), error: null };
  });
}

/**
 * Cancel an event
 */
export async function cancelEvent(
  eventId: string,
  reason?: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('events')
    .update({
      status: 'cancelled',
      cancelled_reason: reason,
    })
    .eq('id', eventId);

  return { error: error ? new Error(error.message) : null };
}

/**
 * Delete an event (soft delete - changes status to cancelled)
 */
export async function deleteEvent(eventId: string): Promise<{ error: Error | null }> {
  return cancelEvent(eventId, 'Deleted by organizer');
}

// ============================================================================
// Event Search & Discovery
// ============================================================================

/**
 * Search events with filters and pagination
 * Uses optimized PostGIS function for geo queries
 */
export async function searchEvents(
  filters: EventFilters,
  pagination: PaginationParams,
  userLocation?: GeoPoint
): Promise<PaginatedResult<Event>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  // If we have user location, use the optimized geo search function
  if (userLocation && filters.maxDistance) {
    return searchEventsNearby(userLocation, filters, pagination);
  }

  // Regular search without geo
  let query = supabase
    .from('events')
    .select(EVENT_SELECT_QUERY, { count: 'exact' })
    .eq('status', 'published')
    .gte('starts_at', (filters.dateFrom ?? new Date()).toISOString());

  // Apply filters
  if (filters.dateTo) {
    query = query.lte('starts_at', filters.dateTo.toISOString());
  }

  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  if (filters.city) {
    query = query.eq('city', filters.city);
  }

  if (filters.search) {
    query = query.textSearch('title', filters.search, { type: 'websearch' });
  }

  if (filters.hasAvailableSpots) {
    query = query.or('max_participants.is.null,current_participants.lt.max_participants');
  }

  if (filters.isFree) {
    query = query.eq('entry_fee', 0);
  }

  // Apply sorting
  const sortColumn = filters.sortBy === 'popularity' ? 'views_count' : 'starts_at';
  const sortOrder = filters.sortOrder === 'desc' ? { ascending: false } : { ascending: true };
  query = query.order(sortColumn, sortOrder);

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await withRetry(() => query);

  if (error) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: (data ?? []).map(transformEvent),
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Search events near a location using PostGIS
 */
async function searchEventsNearby(
  location: GeoPoint,
  filters: EventFilters,
  pagination: PaginationParams
): Promise<PaginatedResult<Event>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;
  const distanceMeters = (filters.maxDistance ?? 10) * 1000;

  const { data, error } = await supabase.rpc('search_events_nearby', {
    p_latitude: location.latitude,
    p_longitude: location.longitude,
    p_distance_meters: distanceMeters,
    p_category_id: filters.categoryId,
    p_date_from: (filters.dateFrom ?? new Date()).toISOString(),
    p_date_to: filters.dateTo?.toISOString(),
    p_city: filters.city,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  // For nearby search, we need a separate count query
  const events = (data ?? []).map((row: Record<string, unknown>) =>
    transformEventFromRpc(row)
  );

  return {
    data: events,
    total: events.length, // Approximate for now
    page,
    limit,
    totalPages: Math.ceil(events.length / limit),
    hasNextPage: events.length === limit,
    hasPreviousPage: page > 1,
  };
}

/**
 * Get events organized by a user
 */
export async function getEventsByOrganizer(
  organizerId: string,
  pagination: PaginationParams
): Promise<PaginatedResult<Event>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('events')
    .select(EVENT_SELECT_QUERY, { count: 'exact' })
    .eq('organizer_id', organizerId)
    .order('starts_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: (data ?? []).map(transformEvent),
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Get events a user is participating in
 */
export async function getEventsParticipating(
  userId: string,
  pagination: PaginationParams
): Promise<PaginatedResult<Event>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('event_participants')
    .select(
      `
      event:events(${EVENT_SELECT_QUERY})
    `,
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .in('status', ['approved', 'pending'])
    .order('joined_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  const events = (data ?? [])
    .map((row) => (row as { event: Record<string, unknown> }).event)
    .filter(Boolean)
    .map(transformEvent);

  return {
    data: events,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

// ============================================================================
// Participant Operations
// ============================================================================

/**
 * Join an event
 */
export async function joinEvent(
  eventId: string,
  message?: string
): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Authentication required') };
  }

  // Check if event has available spots
  const { data: event } = await supabase
    .from('events')
    .select('max_participants, current_participants, requires_approval')
    .eq('id', eventId)
    .single();

  if (!event) {
    return { error: new Error('Event not found') };
  }

  if (
    event.max_participants &&
    event.current_participants >= event.max_participants
  ) {
    return { error: new Error('Event is full') };
  }

  const status = event.requires_approval ? 'pending' : 'approved';

  const { error } = await supabase.from('event_participants').insert({
    event_id: eventId,
    user_id: user.id,
    status,
    message_to_organizer: message,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: new Error('Already joined this event') };
    }
    return { error: new Error(error.message) };
  }

  // Increment participant count if auto-approved
  if (status === 'approved') {
    await supabase.rpc('increment_participants', { p_event_id: eventId });
  }

  return { error: null };
}

/**
 * Leave an event
 */
export async function leaveEvent(eventId: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Authentication required') };
  }

  // Get current participation status
  const { data: participation } = await supabase
    .from('event_participants')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single();

  if (!participation) {
    return { error: new Error('Not participating in this event') };
  }

  const { error } = await supabase
    .from('event_participants')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  // Decrement participant count if was approved
  if (participation.status === 'approved') {
    await supabase.rpc('decrement_participants', { p_event_id: eventId });
  }

  return { error: null };
}

/**
 * Approve a participant (organizer only)
 */
export async function approveParticipant(
  eventId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('event_participants')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  // Increment participant count
  await supabase.rpc('increment_participants', { p_event_id: eventId });

  return { error: null };
}

/**
 * Decline a participant (organizer only)
 */
export async function declineParticipant(
  eventId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('event_participants')
    .update({
      status: 'declined',
    })
    .eq('event_id', eventId)
    .eq('user_id', userId);

  return { error: error ? new Error(error.message) : null };
}

/**
 * Get participants for an event
 */
export async function getEventParticipants(eventId: string): Promise<ParticipantsResult> {
  const { data, error } = await supabase
    .from('event_participants')
    .select(
      `
      *,
      user:profiles(id, display_name, avatar_url, rating)
    `
    )
    .eq('event_id', eventId)
    .in('status', ['pending', 'approved', 'attended'])
    .order('joined_at', { ascending: true });

  if (error) {
    return { participants: [], error: new Error(error.message) };
  }

  return {
    participants: (data ?? []).map(transformParticipant),
    error: null,
  };
}

/**
 * Check if current user is participating in an event
 */
export async function isUserParticipating(eventId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data } = await supabase
    .from('event_participants')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('status', ['pending', 'approved'])
    .single();

  return data !== null;
}

/**
 * Mark attendance for a participant (organizer only)
 */
export async function markAttendance(
  eventId: string,
  userId: string,
  attended: boolean
): Promise<{ error: Error | null }> {
  const status = attended ? 'attended' : 'no_show';

  const { error } = await supabase
    .from('event_participants')
    .update({ status })
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  // Increment no-show count if not attended
  if (!attended) {
    await supabase.rpc('increment_no_show', { p_user_id: userId });
  }

  return { error: null };
}

// ============================================================================
// Saved Events (Favorites)
// ============================================================================

/**
 * Save an event to favorites
 */
export async function saveEvent(eventId: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Authentication required') };
  }

  const { error } = await supabase.from('saved_events').insert({
    user_id: user.id,
    event_id: eventId,
  });

  return { error: error ? new Error(error.message) : null };
}

/**
 * Remove an event from favorites
 */
export async function unsaveEvent(eventId: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Authentication required') };
  }

  const { error } = await supabase
    .from('saved_events')
    .delete()
    .eq('user_id', user.id)
    .eq('event_id', eventId);

  return { error: error ? new Error(error.message) : null };
}

/**
 * Get saved events for current user
 */
export async function getSavedEvents(): Promise<EventsResult> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { events: [], error: new Error('Authentication required') };
  }

  const { data, error } = await supabase
    .from('saved_events')
    .select(
      `
      event:events(${EVENT_SELECT_QUERY})
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { events: [], error: new Error(error.message) };
  }

  const events = (data ?? [])
    .map((row) => (row as { event: Record<string, unknown> }).event)
    .filter(Boolean)
    .map(transformEvent);

  return { events, error: null };
}

/**
 * Check if event is saved
 */
export async function isEventSaved(eventId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data } = await supabase
    .from('saved_events')
    .select('event_id')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .single();

  return data !== null;
}

// ============================================================================
// Query Constants
// ============================================================================

const EVENT_SELECT_QUERY = `
  *,
  organizer:profiles!organizer_id(
    id,
    display_name,
    avatar_url,
    rating,
    events_organized,
    is_verified
  ),
  category:activity_categories(
    id,
    name,
    slug,
    icon,
    color
  )
`;

// ============================================================================
// Transform Functions
// ============================================================================

function transformEvent(data: Record<string, unknown>): Event {
  // Parse startsAt with validation
  const startsAtRaw = data.starts_at as string | null;
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : new Date();
  // Ensure startsAt is valid
  const validStartsAt = isNaN(startsAt.getTime()) ? new Date() : startsAt;

  const durationMinutes = data.duration_minutes as number | null;

  // Calculate endsAt: use ends_at from DB if available, otherwise calculate from duration
  let endsAt: Date;
  if (data.ends_at) {
    const parsedEndsAt = new Date(data.ends_at as string);
    // Validate parsed date
    endsAt = isNaN(parsedEndsAt.getTime())
      ? new Date(validStartsAt.getTime() + (durationMinutes ?? 60) * 60 * 1000)
      : parsedEndsAt;
  } else if (durationMinutes) {
    endsAt = new Date(validStartsAt.getTime() + durationMinutes * 60 * 1000);
  } else {
    // Default to 1 hour duration if no ends_at and no duration
    endsAt = new Date(validStartsAt.getTime() + 60 * 60 * 1000);
  }

  return {
    id: data.id as string,
    organizerId: data.organizer_id as string,
    title: data.title as string,
    description: data.description as string | null,
    categoryId: data.category_id as string,
    tags: (data.tags as string[]) ?? [],
    coverImageUrl: data.cover_image_url as string | null,
    startsAt: validStartsAt,
    endsAt,
    durationMinutes,
    timezone: data.timezone as string,
    location: parseLocation(data.location) ?? { latitude: 0, longitude: 0 },
    address: data.address as string,
    placeName: data.place_name as string | null,
    placeDetails: data.place_details as string | null,
    city: data.city as string,
    minParticipants: data.min_participants as number,
    maxParticipants: data.max_participants as number | null,
    currentParticipants: data.current_participants as number,
    isPublic: data.is_public as boolean,
    requiresApproval: data.requires_approval as boolean,
    allowChat: data.allow_chat as boolean,
    entryFee: Number(data.entry_fee) || 0,
    status: data.status as 'draft' | 'published' | 'cancelled' | 'completed',
    cancelledReason: data.cancelled_reason as string | null,
    viewsCount: data.views_count as number,
    organizer: data.organizer ? transformOrganizer(data.organizer as Record<string, unknown>) : undefined,
    category: data.category ? transformCategory(data.category as Record<string, unknown>) : undefined,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function transformEventFromRpc(data: Record<string, unknown>): Event {
  // Parse startsAt with validation
  const startsAtRaw = data.starts_at as string | null;
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : new Date();
  const validStartsAt = isNaN(startsAt.getTime()) ? new Date() : startsAt;

  const durationMinutes = data.duration_minutes as number | null;

  // Calculate endsAt from duration if available
  let endsAt: Date;
  if (data.ends_at) {
    const parsedEndsAt = new Date(data.ends_at as string);
    endsAt = isNaN(parsedEndsAt.getTime())
      ? new Date(validStartsAt.getTime() + (durationMinutes ?? 60) * 60 * 1000)
      : parsedEndsAt;
  } else if (durationMinutes) {
    endsAt = new Date(validStartsAt.getTime() + durationMinutes * 60 * 1000);
  } else {
    // Default to 1 hour duration
    endsAt = new Date(validStartsAt.getTime() + 60 * 60 * 1000);
  }

  return {
    id: data.id as string,
    organizerId: data.organizer_id as string,
    title: data.title as string,
    description: data.description as string | null,
    categoryId: data.category_id as string,
    tags: [],
    coverImageUrl: null,
    startsAt: validStartsAt,
    endsAt,
    durationMinutes,
    timezone: 'Europe/Moscow',
    location: parseLocation(data.location) ?? { latitude: 0, longitude: 0 },
    address: data.address as string,
    placeName: data.place_name as string | null,
    placeDetails: null,
    city: data.city as string,
    minParticipants: 2,
    maxParticipants: data.max_participants as number | null,
    currentParticipants: data.current_participants as number,
    isPublic: true,
    requiresApproval: false,
    allowChat: true,
    entryFee: 0,
    status: 'published',
    cancelledReason: null,
    viewsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function transformOrganizer(data: Record<string, unknown>) {
  return {
    id: data.id as string,
    displayName: data.display_name as string,
    avatarUrl: data.avatar_url as string | null,
    rating: Number(data.rating) || 5.0,
    eventsOrganized: data.events_organized as number,
    isVerified: data.is_verified as boolean,
  };
}

function transformCategory(data: Record<string, unknown>) {
  return {
    id: data.id as string,
    name: data.name as string,
    slug: data.slug as string,
    icon: data.icon as string,
    color: data.color as string,
    parentId: null,
    isActive: true,
  };
}

function transformParticipant(data: Record<string, unknown>): EventParticipant {
  return {
    id: data.id as string,
    eventId: data.event_id as string,
    userId: data.user_id as string,
    status: data.status as 'pending' | 'approved' | 'declined' | 'cancelled' | 'attended' | 'no_show',
    paymentId: data.payment_id as string | null,
    paymentStatus: data.payment_status as 'pending' | 'paid' | 'refunded' | null,
    messageToOrganizer: data.message_to_organizer as string | null,
    joinedAt: new Date(data.joined_at as string),
    approvedAt: data.approved_at ? new Date(data.approved_at as string) : null,
    cancelledAt: data.cancelled_at ? new Date(data.cancelled_at as string) : null,
    user: data.user
      ? {
          id: (data.user as Record<string, unknown>).id as string,
          displayName: (data.user as Record<string, unknown>).display_name as string,
          avatarUrl: (data.user as Record<string, unknown>).avatar_url as string | null,
          rating: Number((data.user as Record<string, unknown>).rating) || 5.0,
        }
      : undefined,
  };
}

function parseLocation(location: unknown): GeoPoint | null {
  if (!location) {
    return null;
  }

  if (typeof location === 'object' && location !== null) {
    const geo = location as { coordinates?: number[] };
    if (geo.coordinates && geo.coordinates.length === 2) {
      return {
        longitude: geo.coordinates[0] as number,
        latitude: geo.coordinates[1] as number,
      };
    }
  }

  if (typeof location === 'string') {
    const match = location.match(/POINT\(([^ ]+) ([^)]+)\)/);
    if (match) {
      return {
        longitude: parseFloat(match[1] as string),
        latitude: parseFloat(match[2] as string),
      };
    }
  }

  return null;
}
