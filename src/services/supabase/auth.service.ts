/**
 * Authentication Service
 * Handles user authentication, registration, and session management
 */

import type { AuthError, Session, User } from '@supabase/supabase-js';

import type { Profile, SignInInput, SignUpInput } from '@/types';

import { supabase, withRetry } from './client';

// ============================================================================
// Types
// ============================================================================

interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

interface ProfileResult {
  profile: Profile | null;
  error: Error | null;
}

// ============================================================================
// Sign Up
// ============================================================================

/**
 * Register a new user with email and password
 * Also creates their initial profile
 */
export async function signUp(input: SignUpInput): Promise<AuthResult & ProfileResult> {
  const { email, password, displayName, city } = input;

  // Step 1: Create auth user
  const { data: authData, error: authError } = await withRetry(() =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          city,
        },
      },
    })
  );

  if (authError || !authData.user) {
    return {
      user: null,
      session: null,
      profile: null,
      error: authError,
    };
  }

  // Step 2: Create profile (triggered by auth.users insert trigger in production)
  // In dev, we create it manually
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authData.user.id,
      display_name: displayName,
      city,
      interests: [],
      subscription_type: 'free',
    })
    .select()
    .single();

  if (profileError) {
    return {
      user: authData.user,
      session: authData.session,
      profile: null,
      error: new Error(profileError.message),
    };
  }

  return {
    user: authData.user,
    session: authData.session,
    profile: transformProfile(profile),
    error: null,
  };
}

// ============================================================================
// Sign In
// ============================================================================

/**
 * Sign in with email and password
 */
export async function signIn(input: SignInInput): Promise<AuthResult> {
  const { email, password } = input;

  const { data, error } = await withRetry(() =>
    supabase.auth.signInWithPassword({
      email,
      password,
    })
  );

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    error,
  };
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithProvider(
  provider: 'google' | 'apple'
): Promise<{ url: string | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: 'meetuplocal://auth/callback',
      skipBrowserRedirect: true,
    },
  });

  return {
    url: data?.url ?? null,
    error,
  };
}

// ============================================================================
// Sign Out
// ============================================================================

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get current session
 */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Refresh the current session
 */
export async function refreshSession(): Promise<AuthResult> {
  const { data, error } = await supabase.auth.refreshSession();

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    error,
  };
}

// ============================================================================
// Password Management
// ============================================================================

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'meetuplocal://auth/reset-password',
  });

  return { error };
}

/**
 * Update password (when user is authenticated)
 */
export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  return { error };
}

// ============================================================================
// Email Verification
// ============================================================================

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });

  return { error };
}

// ============================================================================
// Auth State Listener
// ============================================================================

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);

  return () => {
    subscription.unsubscribe();
  };
}

// ============================================================================
// Profile Helpers
// ============================================================================

/**
 * Get profile for a user
 */
export async function getProfile(userId: string): Promise<ProfileResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    return { profile: null, error: new Error(error.message) };
  }

  return { profile: transformProfile(data), error: null };
}

/**
 * Check if user has completed onboarding
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('interests')
    .eq('id', userId)
    .single();

  return data?.interests && data.interests.length >= 3;
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform database profile to app Profile type
 */
function transformProfile(data: Record<string, unknown>): Profile {
  return {
    id: data.id as string,
    displayName: data.display_name as string,
    avatarUrl: data.avatar_url as string | null,
    bio: data.bio as string | null,
    birthYear: data.birth_year as number | null,
    city: data.city as string,
    location: data.location ? parseLocation(data.location) : null,
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

/**
 * Parse PostGIS geography point to GeoPoint
 */
function parseLocation(location: unknown): { latitude: number; longitude: number } | null {
  if (!location) {
    return null;
  }

  // Handle PostGIS POINT format
  if (typeof location === 'object' && location !== null) {
    const geo = location as { coordinates?: number[] };
    if (geo.coordinates && geo.coordinates.length === 2) {
      return {
        longitude: geo.coordinates[0] as number,
        latitude: geo.coordinates[1] as number,
      };
    }
  }

  // Handle string format "POINT(lon lat)"
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
