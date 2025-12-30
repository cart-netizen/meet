/**
 * Core type definitions for MeetUp.local
 * Designed for scalability: 100K concurrent users, 10M registered, 10K events
 */

// ============================================================================
// User & Profile Types
// ============================================================================

export type SubscriptionType = 'free' | 'participant' | 'organizer';

export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  birthYear: number | null;
  city: string;
  location: GeoPoint | null;
  interests: string[];
  subscriptionType: SubscriptionType;
  subscriptionExpiresAt: Date | null;
  rating: number;
  reviewsCount: number;
  eventsOrganized: number;
  eventsAttended: number;
  noShowCount: number;
  isVerified: boolean;
  isBanned: boolean;
  bannedUntil: Date | null;
  pushToken: string | null;
  lastActiveAt: Date | null;
  createdAt: Date;
  role: UserRole;
}

export interface ProfileUpdateInput {
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  birthYear?: number | null;
  city?: string;
  interests?: string[];
}

// ============================================================================
// Geo Types
// ============================================================================

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoLocation extends GeoPoint {
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GeoBounds {
  northeast: GeoPoint;
  southwest: GeoPoint;
}

// ============================================================================
// Category Types
// ============================================================================

export interface ActivityCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  parentId: string | null;
  isActive: boolean;
  subcategories?: ActivityCategory[];
}

// ============================================================================
// Event Types
// ============================================================================

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export interface Event {
  id: string;
  organizerId: string;

  // Basic info
  title: string;
  description: string | null;
  categoryId: string;
  tags: string[];
  coverImageUrl: string | null;

  // Time
  startsAt: Date;
  endsAt: Date | null;
  durationMinutes: number | null;
  timezone: string;

  // Location
  location: GeoPoint;
  address: string;
  placeName: string | null;
  placeDetails: string | null;
  city: string;

  // Participants
  minParticipants: number;
  maxParticipants: number | null;
  currentParticipants: number;

  // Settings
  isPublic: boolean;
  requiresApproval: boolean;
  allowChat: boolean;

  // Payment
  entryFee: number;

  // Status
  status: EventStatus;
  cancelledReason: string | null;

  // Metrics
  viewsCount: number;

  // Relations (populated on demand)
  organizer?: Profile;
  category?: ActivityCategory;
  participants?: EventParticipant[];

  createdAt: Date;
  updatedAt: Date;
}

export interface EventCreateInput {
  title: string;
  description?: string;
  categoryId: string;
  tags?: string[];
  coverImageUrl?: string;
  startsAt: Date;
  durationMinutes?: number;
  location: GeoPoint;
  address: string;
  placeName?: string;
  placeDetails?: string;
  city: string;
  minParticipants?: number;
  maxParticipants?: number;
  requiresApproval?: boolean;
  allowChat?: boolean;
  entryFee?: number;
}

export interface EventUpdateInput extends Partial<EventCreateInput> {
  status?: EventStatus;
  cancelledReason?: string;
}

// ============================================================================
// Participant Types
// ============================================================================

export type ParticipantStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'cancelled'
  | 'attended'
  | 'no_show';

export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export interface EventParticipant {
  id: string;
  eventId: string;
  userId: string;
  status: ParticipantStatus;
  paymentId: string | null;
  paymentStatus: PaymentStatus | null;
  messageToOrganizer: string | null;
  joinedAt: Date;
  approvedAt: Date | null;
  cancelledAt: Date | null;

  // Relations
  user?: Profile;
  event?: Event;
}

export interface JoinEventInput {
  eventId: string;
  messageToOrganizer?: string;
}

// ============================================================================
// Review Types
// ============================================================================

export type ReviewType = 'organizer_to_participant' | 'participant_to_organizer';

export interface Review {
  id: string;
  eventId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  reviewType: ReviewType;
  createdAt: Date;

  // Relations
  reviewer?: Profile;
  reviewee?: Profile;
  event?: Event;
}

export interface ReviewCreateInput {
  eventId: string;
  revieweeId: string;
  rating: number;
  comment?: string;
  reviewType: ReviewType;
}

// ============================================================================
// Chat Types
// ============================================================================

export interface EventMessage {
  id: string;
  eventId: string;
  userId: string;
  content: string;
  isSystem: boolean;
  createdAt: Date;

  // Relations
  user?: Profile;
}

export interface SendMessageInput {
  eventId: string;
  content: string;
}

// ============================================================================
// Subscription Types
// ============================================================================

export interface AppSubscription {
  id: string;
  userId: string;
  type: Exclude<SubscriptionType, 'free'>;
  startsAt: Date;
  expiresAt: Date;
  paymentId: string | null;
  amount: number;
  isActive: boolean;
  autoRenew: boolean;
  createdAt: Date;
}

// ============================================================================
// Payment Types
// ============================================================================

export type PaymentStatusType = 'pending' | 'succeeded' | 'cancelled' | 'refunded';

export interface EventPayment {
  id: string;
  eventId: string;
  userId: string;
  amount: number;
  yookassaPaymentId: string | null;
  status: PaymentStatusType;
  createdAt: Date;
}

export interface CreatePaymentInput {
  type: 'participant_monthly' | 'organizer_monthly' | 'single_event';
  eventId?: string;
}

export interface PaymentResult {
  paymentId: string;
  confirmationUrl: string;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationType =
  | 'event_reminder'
  | 'new_participant'
  | 'participant_approved'
  | 'participant_declined'
  | 'event_cancelled'
  | 'new_message'
  | 'new_review'
  | 'subscription_expiring'
  | 'ban_notification';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

// ============================================================================
// Filter & Search Types
// ============================================================================

export interface EventFilters {
  search?: string;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  maxDistance?: number; // km
  city?: string;
  hasAvailableSpots?: boolean;
  isFree?: boolean;
  sortBy?: 'date' | 'distance' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ============================================================================
// Realtime Types
// ============================================================================

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimePayload<T> {
  type: RealtimeEventType;
  table: string;
  record: T;
  oldRecord?: T;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  session: Session | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  city: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

// ============================================================================
// Store Types
// ============================================================================

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface AsyncState<T> extends LoadingState {
  data: T | null;
  lastFetched: Date | null;
}
