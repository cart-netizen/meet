/**
 * Profiles Service
 * Handles user profile operations
 * Optimized for 10M registered users
 */

import { ENV } from '@/config/env';
import type { GeoPoint, Profile, ProfileUpdateInput, Review } from '@/types';

import { deduplicateRequest, supabase, withRetry } from './client';

// ============================================================================
// Types
// ============================================================================

interface ProfileResult {
  profile: Profile | null;
  error: Error | null;
}

interface ReviewsResult {
  reviews: Review[];
  error: Error | null;
}

// ============================================================================
// Profile CRUD
// ============================================================================

/**
 * Get profile by user ID
 */
export async function getProfileById(userId: string): Promise<ProfileResult> {
  return deduplicateRequest(`profile:${userId}`, async () => {
    const { data, error } = await withRetry(() =>
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
    );

    if (error) {
      return { profile: null, error: new Error(error.message) };
    }

    return { profile: transformProfile(data), error: null };
  });
}

/**
 * Get current user's profile
 */
export async function getCurrentProfile(): Promise<ProfileResult> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { profile: null, error: new Error('Not authenticated') };
  }

  return getProfileById(user.id);
}

/**
 * Update current user's profile
 */
export async function updateProfile(input: ProfileUpdateInput): Promise<ProfileResult> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { profile: null, error: new Error('Not authenticated') };
  }

  const updateData: Record<string, unknown> = {};

  if (input.displayName !== undefined) {
    updateData.display_name = input.displayName;
  }
  if (input.avatarUrl !== undefined) {
    updateData.avatar_url = input.avatarUrl;
  }
  if (input.bio !== undefined) {
    updateData.bio = input.bio;
  }
  if (input.birthYear !== undefined) {
    updateData.birth_year = input.birthYear;
  }
  if (input.city !== undefined) {
    updateData.city = input.city;
  }
  if (input.interests !== undefined) {
    updateData.interests = input.interests;
  }
  if (input.subscriptionType !== undefined) {
    updateData.subscription_type = input.subscriptionType;
  }
  if (input.subscriptionExpiresAt !== undefined) {
    updateData.subscription_expires_at = input.subscriptionExpiresAt;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    return { profile: null, error: new Error(error.message) };
  }

  return { profile: transformProfile(data), error: null };
}

/**
 * Update user's interests
 */
export async function updateInterests(interests: string[]): Promise<ProfileResult> {
  return updateProfile({ interests });
}

/**
 * Update user's location
 */
export async function updateLocation(location: GeoPoint): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      location: `POINT(${location.longitude} ${location.latitude})`,
    })
    .eq('id', user.id);

  return { error: error ? new Error(error.message) : null };
}

/**
 * Update last active timestamp
 */
export async function updateLastActive(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id);
}

/**
 * Update push notification token
 */
export async function updatePushToken(token: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', user.id);

  return { error: error ? new Error(error.message) : null };
}

// ============================================================================
// Subscription
// ============================================================================

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data } = await supabase
    .from('profiles')
    .select('subscription_type, subscription_expires_at')
    .eq('id', user.id)
    .single();

  if (!data) {
    return false;
  }

  if (data.subscription_type === 'free') {
    return false;
  }

  if (data.subscription_expires_at) {
    return new Date(data.subscription_expires_at) > new Date();
  }

  return false;
}

/**
 * Check if user can create events (organizer subscription)
 */
export async function canCreateEvents(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data } = await supabase
    .from('profiles')
    .select('subscription_type, subscription_expires_at')
    .eq('id', user.id)
    .single();

  if (!data) {
    return false;
  }

  if (data.subscription_type !== 'organizer') {
    return false;
  }

  if (data.subscription_expires_at) {
    return new Date(data.subscription_expires_at) > new Date();
  }

  return false;
}

/**
 * Check if user is banned
 */
export async function isUserBanned(): Promise<{ isBanned: boolean; bannedUntil: Date | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { isBanned: false, bannedUntil: null };
  }

  const { data } = await supabase
    .from('profiles')
    .select('is_banned, banned_until')
    .eq('id', user.id)
    .single();

  if (!data) {
    return { isBanned: false, bannedUntil: null };
  }

  // Check if ban has expired
  if (data.is_banned && data.banned_until) {
    const bannedUntil = new Date(data.banned_until);
    if (bannedUntil < new Date()) {
      // Ban expired, update the record
      await supabase
        .from('profiles')
        .update({ is_banned: false, banned_until: null })
        .eq('id', user.id);
      return { isBanned: false, bannedUntil: null };
    }
    return { isBanned: true, bannedUntil };
  }

  return { isBanned: Boolean(data.is_banned), bannedUntil: null };
}

// ============================================================================
// Reviews
// ============================================================================

/**
 * Get reviews for a user
 */
export async function getProfileReviews(userId: string): Promise<ReviewsResult> {
  const { data, error } = await supabase
    .from('reviews')
    .select(
      `
      *,
      reviewer:profiles!reviewer_id(id, display_name, avatar_url),
      event:events(id, title)
    `
    )
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { reviews: [], error: new Error(error.message) };
  }

  return {
    reviews: (data ?? []).map(transformReview),
    error: null,
  };
}

/**
 * Create a review
 */
export async function createReview(
  eventId: string,
  revieweeId: string,
  rating: number,
  comment?: string,
  reviewType: 'organizer_to_participant' | 'participant_to_organizer' = 'participant_to_organizer'
): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase.from('reviews').insert({
    event_id: eventId,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    rating,
    comment,
    review_type: reviewType,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: new Error('You have already reviewed this person for this event') };
    }
    return { error: new Error(error.message) };
  }

  // Recalculate the reviewee's rating
  await supabase.rpc('recalculate_rating', { p_user_id: revieweeId });

  return { error: null };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get user statistics
 */
export async function getProfileStats(userId: string): Promise<{
  eventsOrganized: number;
  eventsAttended: number;
  rating: number;
  reviewsCount: number;
  noShowCount: number;
}> {
  const { data } = await supabase
    .from('profiles')
    .select('events_organized, events_attended, rating, reviews_count, no_show_count')
    .eq('id', userId)
    .single();

  return {
    eventsOrganized: data?.events_organized ?? 0,
    eventsAttended: data?.events_attended ?? 0,
    rating: Number(data?.rating) || 5.0,
    reviewsCount: data?.reviews_count ?? 0,
    noShowCount: data?.no_show_count ?? 0,
  };
}

// ============================================================================
// Avatar Upload
// ============================================================================

/**
 * Upload file to Supabase Storage using XMLHttpRequest (bypasses fetch issues in React Native)
 */
export function uploadToStorageXHR(
  bucket: string,
  path: string,
  fileUri: string,
  contentType: string,
  accessToken: string
): Promise<{ error: Error | null }> {
  return new Promise((resolve) => {
    const storageUrl = ENV.supabase.url;
    const anonKey = ENV.supabase.anonKey;
    const uploadUrl = `${storageUrl}/storage/v1/object/${bucket}/${path}`;

    const xhr = new XMLHttpRequest();

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ error: null });
      } else {
        let errorMessage = 'Ошибка загрузки';
        try {
          const response = JSON.parse(xhr.responseText);
          errorMessage = response.error || response.message || errorMessage;
        } catch {
          errorMessage = xhr.statusText || errorMessage;
        }
        resolve({ error: new Error(errorMessage) });
      }
    };

    xhr.onerror = function () {
      resolve({ error: new Error('Ошибка сети при загрузке') });
    };

    xhr.ontimeout = function () {
      resolve({ error: new Error('Превышено время ожидания загрузки') });
    };

    xhr.open('POST', uploadUrl, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.timeout = 60000; // 60 second timeout

    // Create FormData with file
    const formData = new FormData();
    formData.append('', {
      uri: fileUri,
      type: contentType,
      name: path.split('/').pop() || 'file',
    } as unknown as Blob);

    xhr.send(formData);
  });
}

/**
 * Upload avatar image
 */
export async function uploadAvatar(
  file: { uri: string; type: string; name: string }
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();

    if (!user || !session) {
      return { url: null, error: new Error('Not authenticated') };
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop() ?? 'jpg';
    const filePath = `${user.id}/avatar.${fileExt}`;

    // Upload using XMLHttpRequest (bypasses React Native fetch issues)
    const { error: uploadError } = await uploadToStorageXHR(
      'avatars',
      filePath,
      file.uri,
      file.type,
      session.access_token
    );

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { url: null, error: uploadError };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Update profile with new avatar URL
    await updateProfile({ avatarUrl: publicUrl });

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error('Upload avatar error:', error);
    const message = error instanceof Error ? error.message : 'Ошибка загрузки фото';
    return { url: null, error: new Error(message) };
  }
}

/**
 * Upload additional profile photo (max 5 photos)
 */
export async function uploadProfilePhoto(
  file: { uri: string; type: string; name: string }
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();

    if (!user || !session) {
      return { url: null, error: new Error('Not authenticated') };
    }

    // Get current photos
    const { profile } = await getProfile(user.id);
    const currentPhotos = profile?.photos ?? [];

    if (currentPhotos.length >= 5) {
      return { url: null, error: new Error('Максимум 5 фото') };
    }

    // Generate unique file path with timestamp
    const fileExt = file.name.split('.').pop() ?? 'jpg';
    const timestamp = Date.now();
    const filePath = `${user.id}/photo_${timestamp}.${fileExt}`;

    // Upload using XMLHttpRequest
    const { error: uploadError } = await uploadToStorageXHR(
      'avatars',
      filePath,
      file.uri,
      file.type,
      session.access_token
    );

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { url: null, error: uploadError };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Update profile with new photo
    const updatedPhotos = [...currentPhotos, publicUrl];
    await updateProfile({ photos: updatedPhotos });

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error('Upload photo error:', error);
    const message = error instanceof Error ? error.message : 'Ошибка загрузки фото';
    return { url: null, error: new Error(message) };
  }
}

/**
 * Delete profile photo
 */
export async function deleteProfilePhoto(
  photoUrl: string
): Promise<{ error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    // Get current photos
    const { profile } = await getProfile(user.id);
    const currentPhotos = profile?.photos ?? [];

    // Remove photo from list
    const updatedPhotos = currentPhotos.filter(url => url !== photoUrl);
    await updateProfile({ photos: updatedPhotos });

    return { error: null };
  } catch (error) {
    console.error('Delete photo error:', error);
    const message = error instanceof Error ? error.message : 'Ошибка удаления фото';
    return { error: new Error(message) };
  }
}

// ============================================================================
// Transform Functions
// ============================================================================

function transformProfile(data: Record<string, unknown>): Profile {
  return {
    id: data.id as string,
    displayName: data.display_name as string,
    avatarUrl: data.avatar_url as string | null,
    photos: (data.photos as string[]) ?? [],
    bio: data.bio as string | null,
    birthYear: data.birth_year as number | null,
    city: data.city as string,
    location: parseLocation(data.location),
    interests: (data.interests as string[]) ?? [],
    subscriptionType: data.subscription_type as 'free' | 'participant' | 'organizer',
    subscriptionExpiresAt: data.subscription_expires_at
      ? new Date(data.subscription_expires_at as string)
      : null,
    rating: Number(data.rating) || 5.0,
    reviewsCount: Number(data.reviews_count) || 0,
    eventsOrganized: Number(data.events_organized) || 0,
    eventsAttended: Number(data.events_attended) || 0,
    noShowCount: Number(data.no_show_count) || 0,
    isVerified: Boolean(data.is_verified),
    isBanned: Boolean(data.is_banned),
    bannedUntil: data.banned_until ? new Date(data.banned_until as string) : null,
    pushToken: data.push_token as string | null,
    lastActiveAt: data.last_active_at ? new Date(data.last_active_at as string) : null,
    createdAt: new Date(data.created_at as string),
    role: (data.role as 'user' | 'moderator' | 'admin') ?? 'user',
  };
}

function transformReview(data: Record<string, unknown>): Review {
  return {
    id: data.id as string,
    eventId: data.event_id as string,
    reviewerId: data.reviewer_id as string,
    revieweeId: data.reviewee_id as string,
    rating: data.rating as number,
    comment: data.comment as string | null,
    reviewType: data.review_type as 'organizer_to_participant' | 'participant_to_organizer',
    createdAt: new Date(data.created_at as string),
    reviewer: data.reviewer
      ? {
          id: (data.reviewer as Record<string, unknown>).id as string,
          displayName: (data.reviewer as Record<string, unknown>).display_name as string,
          avatarUrl: (data.reviewer as Record<string, unknown>).avatar_url as string | null,
        }
      : undefined,
    event: data.event
      ? {
          id: (data.event as Record<string, unknown>).id as string,
          title: (data.event as Record<string, unknown>).title as string,
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
