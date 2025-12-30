/**
 * Reviews Service
 * Handles event and organizer reviews
 */

import { supabase, withRetry } from './client';
import type { Review } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface CreateReviewParams {
  eventId: string;
  organizerId: string;
  rating: number; // 1-5
  comment?: string;
}

export interface ReviewWithDetails extends Review {
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  event?: {
    id: string;
    title: string;
  };
}

// ============================================================================
// Reviews CRUD
// ============================================================================

/**
 * Create a new review
 */
export async function createReview(params: CreateReviewParams): Promise<Review> {
  const { eventId, organizerId, rating, comment } = params;

  // Validate rating
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check if user participated in the event
    const { data: participation } = await supabase
      .from('participants')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    if (!participation) {
      throw new Error('You must participate in the event to leave a review');
    }

    if (participation.status !== 'attended') {
      throw new Error('You must have attended the event to leave a review');
    }

    // Check if already reviewed
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('event_id', eventId)
      .eq('reviewer_id', user.id)
      .single();

    if (existingReview) {
      throw new Error('You have already reviewed this event');
    }

    // Create review
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        event_id: eventId,
        organizer_id: organizerId,
        reviewer_id: user.id,
        rating,
        comment: comment?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create review: ${error.message}`);
    }

    // Update organizer's average rating
    await updateOrganizerRating(organizerId);

    return transformReview(data);
  });
}

/**
 * Get reviews for an event
 */
export async function getEventReviews(
  eventId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ reviews: ReviewWithDetails[]; total: number }> {
  const { limit = 20, offset = 0 } = options;

  return withRetry(async () => {
    // Get total count
    const { count } = await supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    // Get reviews
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        author:profiles!reviewer_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch reviews: ${error.message}`);
    }

    return {
      reviews: (data ?? []).map(transformReviewWithDetails),
      total: count ?? 0,
    };
  });
}

/**
 * Get reviews for an organizer
 */
export async function getOrganizerReviews(
  organizerId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ reviews: ReviewWithDetails[]; total: number; averageRating: number }> {
  const { limit = 20, offset = 0 } = options;

  return withRetry(async () => {
    // Get total count and average
    const { count, data: avgData } = await supabase
      .from('reviews')
      .select('rating', { count: 'exact' })
      .eq('organizer_id', organizerId);

    const averageRating =
      avgData && avgData.length > 0
        ? avgData.reduce((sum, r) => sum + r.rating, 0) / avgData.length
        : 0;

    // Get reviews with details
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        author:profiles!reviewer_id (
          id,
          display_name,
          avatar_url
        ),
        event:events (
          id,
          title
        )
      `)
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch reviews: ${error.message}`);
    }

    return {
      reviews: (data ?? []).map(transformReviewWithDetails),
      total: count ?? 0,
      averageRating,
    };
  });
}

/**
 * Check if user can review an event
 */
export async function canReviewEvent(eventId: string): Promise<{
  canReview: boolean;
  reason?: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { canReview: false, reason: 'not_authenticated' };
  }

  // Check participation
  const { data: participation } = await supabase
    .from('participants')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single();

  if (!participation) {
    return { canReview: false, reason: 'not_participant' };
  }

  if (participation.status !== 'attended') {
    return { canReview: false, reason: 'not_attended' };
  }

  // Check existing review
  const { data: existingReview } = await supabase
    .from('reviews')
    .select('id')
    .eq('event_id', eventId)
    .eq('reviewer_id', user.id)
    .single();

  if (existingReview) {
    return { canReview: false, reason: 'already_reviewed' };
  }

  return { canReview: true };
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<void> {
  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get review to find organizer
    const { data: review } = await supabase
      .from('reviews')
      .select('organizer_id')
      .eq('id', reviewId)
      .eq('reviewer_id', user.id)
      .single();

    if (!review) {
      throw new Error('Review not found or you do not have permission to delete it');
    }

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('reviewer_id', user.id);

    if (error) {
      throw new Error(`Failed to delete review: ${error.message}`);
    }

    // Update organizer's average rating
    await updateOrganizerRating(review.organizer_id);
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Update organizer's average rating
 */
async function updateOrganizerRating(organizerId: string): Promise<void> {
  const { data } = await supabase
    .from('reviews')
    .select('rating')
    .eq('organizer_id', organizerId);

  if (!data || data.length === 0) {
    await supabase
      .from('profiles')
      .update({
        rating: null,
        reviews_count: 0,
      })
      .eq('id', organizerId);
    return;
  }

  const averageRating = data.reduce((sum, r) => sum + r.rating, 0) / data.length;

  await supabase
    .from('profiles')
    .update({
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      reviews_count: data.length,
    })
    .eq('id', organizerId);
}

/**
 * Transform database review to app review
 */
function transformReview(data: Record<string, unknown>): Review {
  return {
    id: data.id as string,
    eventId: data.event_id as string,
    organizerId: data.organizer_id as string,
    reviewerId: data.reviewer_id as string,
    rating: data.rating as number,
    comment: data.comment as string | undefined,
    createdAt: new Date(data.created_at as string),
  };
}

/**
 * Transform database review with relations to app review
 */
function transformReviewWithDetails(data: Record<string, unknown>): ReviewWithDetails {
  const author = data.author as Record<string, unknown>;
  const event = data.event as Record<string, unknown> | null;

  return {
    ...transformReview(data),
    author: {
      id: author.id as string,
      displayName: author.display_name as string,
      avatarUrl: author.avatar_url as string | undefined,
    },
    event: event
      ? {
          id: event.id as string,
          title: event.title as string,
        }
      : undefined,
  };
}

/**
 * Get rating distribution for organizer
 */
export async function getRatingDistribution(
  organizerId: string
): Promise<Record<number, number>> {
  const { data } = await supabase
    .from('reviews')
    .select('rating')
    .eq('organizer_id', organizerId);

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  if (data) {
    for (const review of data) {
      distribution[review.rating] = (distribution[review.rating] ?? 0) + 1;
    }
  }

  return distribution;
}
