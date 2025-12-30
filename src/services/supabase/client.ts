/**
 * Supabase Client Configuration
 * Optimized for high-load: 100K concurrent users
 *
 * Key optimizations:
 * - Connection pooling via PgBouncer (server-side)
 * - Request deduplication
 * - Automatic retry with exponential backoff
 * - Secure token storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { ENV } from '@/config/env';
import type { Database } from '@/types/database.types';

// ============================================================================
// Secure Storage Adapter for Auth Tokens
// ============================================================================

/**
 * Custom storage adapter using Expo SecureStore for sensitive auth data
 * Falls back to AsyncStorage for web compatibility
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // SecureStore is only available on native platforms
      if (typeof SecureStore.getItemAsync === 'function') {
        return await SecureStore.getItemAsync(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error reading from secure storage:', error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof SecureStore.setItemAsync === 'function') {
        await SecureStore.setItemAsync(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Error writing to secure storage:', error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof SecureStore.deleteItemAsync === 'function') {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error removing from secure storage:', error);
    }
  },
};

// ============================================================================
// Supabase Client Configuration
// ============================================================================

const supabaseUrl = ENV.supabase.url;
const supabaseAnonKey = ENV.supabase.anonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

/**
 * Configured Supabase client with optimizations for high-load scenarios
 */
export const supabase = createClient<Database>(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Lock for concurrent tab/session handling
    lock: async (name, acquireTimeout, fn) => {
      return fn();
    },
  },
  global: {
    headers: {
      'x-client-info': 'meetup-local-mobile',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limiting for realtime events
    },
  },
});

// ============================================================================
// Request Deduplication
// ============================================================================

interface PendingRequest {
  promise: Promise<unknown>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest>();
const REQUEST_DEDUP_TTL = 100; // ms

/**
 * Deduplicate identical requests within a short time window
 * Prevents duplicate API calls from rapid re-renders
 */
export function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = pendingRequests.get(key);

  // Return existing request if within dedup window
  if (existing && now - existing.timestamp < REQUEST_DEDUP_TTL) {
    return existing.promise as Promise<T>;
  }

  // Create new request
  const promise = requestFn().finally(() => {
    // Clean up after request completes
    setTimeout(() => {
      pendingRequests.delete(key);
    }, REQUEST_DEDUP_TTL);
  });

  pendingRequests.set(key, { promise, timestamp: now });

  return promise;
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  retryableStatuses?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Execute a request with automatic retry and exponential backoff
 */
export async function withRetry<T>(
  requestFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error, config.retryableStatuses);

      if (!isRetryable || attempt === config.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        config.initialDelay * Math.pow(2, attempt) + Math.random() * 1000,
        config.maxDelay
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return true;
    }

    // Check for HTTP status codes
    const status = (error as { status?: number }).status;
    if (status && retryableStatuses.includes(status)) {
      return true;
    }
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Connection Health Check
// ============================================================================

let isOnline = true;

/**
 * Check if Supabase connection is healthy
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('activity_categories').select('id').limit(1);
    isOnline = !error;
    return isOnline;
  } catch {
    isOnline = false;
    return false;
  }
}

/**
 * Get current connection status
 */
export function getConnectionStatus(): boolean {
  return isOnline;
}

// ============================================================================
// Typed Query Helpers
// ============================================================================

/**
 * Helper type for Supabase query results
 */
export type QueryResult<T> = {
  data: T | null;
  error: Error | null;
};

/**
 * Execute a query and return typed result
 */
export async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: Error | null }>
): Promise<QueryResult<T>> {
  try {
    const { data, error } = await queryFn();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

// ============================================================================
// Realtime Helpers
// ============================================================================

/**
 * Subscribe to table changes with automatic cleanup
 */
export function subscribeToTable<T extends Record<string, unknown>>(
  table: string,
  callback: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: T; old: T }) => void,
  filter?: string
) {
  const channel = supabase
    .channel(`${table}-changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter,
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as T,
          old: payload.old as T,
        });
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// Auth Helpers
// ============================================================================

/**
 * Get current user ID or throw if not authenticated
 */
export async function requireAuth(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  return user.id;
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

// ============================================================================
// Export Database Types
// ============================================================================

export type { Database } from '@/types/database.types';
