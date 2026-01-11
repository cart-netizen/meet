/**
 * Authentication Store
 * Manages user authentication state with persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { Profile, SignInInput, SignUpInput } from '@/types';
import {
  getProfile,
  hasCompletedOnboarding,
  onAuthStateChange,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
} from '@/services/supabase/auth.service';
import { isDemoMode } from '@/services/supabase/client';

// ============================================================================
// Types
// ============================================================================

interface AuthState {
  // State
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  hasCompletedOnboarding: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ success: boolean; error?: string }>;
  signIn: (input: SignInInput) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setOnboardingCompleted: () => void;
  clearError: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      user: null,
      profile: null,
      session: null,
      isLoading: true,
      isInitialized: false,
      hasCompletedOnboarding: false,
      error: null,

      // Initialize auth state from Supabase
      initialize: async () => {
        if (get().isInitialized) {
          return;
        }

        set((state) => {
          state.isLoading = true;
        });

        // In demo mode, skip Supabase auth
        if (isDemoMode()) {
          console.log('🎭 Running in demo mode - skipping auth');
          set((state) => {
            state.isInitialized = true;
            state.isLoading = false;
          });
          return;
        }

        try {
          // Set up auth state listener
          onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              const user = session?.user ?? null;

              if (user) {
                const { profile } = await getProfile(user.id);
                const onboarded = await hasCompletedOnboarding(user.id);

                set((state) => {
                  state.user = user;
                  state.session = session;
                  state.profile = profile;
                  state.hasCompletedOnboarding = onboarded;
                  state.isLoading = false;
                });
              }
            } else if (event === 'SIGNED_OUT') {
              set((state) => {
                state.user = null;
                state.session = null;
                state.profile = null;
                state.hasCompletedOnboarding = false;
                state.isLoading = false;
              });
            }
          });

          set((state) => {
            state.isInitialized = true;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to initialize auth';
            state.isLoading = false;
            state.isInitialized = true;
          });
        }
      },

      // Sign up new user
      signUp: async (input) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const result = await authSignUp(input);

          if (result.error) {
            set((state) => {
              state.error = result.error?.message ?? 'Sign up failed';
              state.isLoading = false;
            });
            return { success: false, error: result.error.message };
          }

          set((state) => {
            state.user = result.user;
            state.session = result.session;
            state.profile = result.profile;
            state.hasCompletedOnboarding = false;
            state.isLoading = false;
          });

          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Sign up failed';
          set((state) => {
            state.error = message;
            state.isLoading = false;
          });
          return { success: false, error: message };
        }
      },

      // Sign in existing user
      signIn: async (input) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const result = await authSignIn(input);

          if (result.error) {
            set((state) => {
              state.error = result.error?.message ?? 'Sign in failed';
              state.isLoading = false;
            });
            return { success: false, error: result.error.message };
          }

          if (result.user) {
            const { profile } = await getProfile(result.user.id);
            const onboarded = await hasCompletedOnboarding(result.user.id);

            set((state) => {
              state.user = result.user;
              state.session = result.session;
              state.profile = profile;
              state.hasCompletedOnboarding = onboarded;
              state.isLoading = false;
            });
          }

          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Sign in failed';
          set((state) => {
            state.error = message;
            state.isLoading = false;
          });
          return { success: false, error: message };
        }
      },

      // Sign out
      signOut: async () => {
        set((state) => {
          state.isLoading = true;
        });

        try {
          await authSignOut();

          set((state) => {
            state.user = null;
            state.session = null;
            state.profile = null;
            state.hasCompletedOnboarding = false;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Sign out failed';
            state.isLoading = false;
          });
        }
      },

      // Refresh profile from server
      refreshProfile: async () => {
        const user = get().user;
        if (!user) {
          return;
        }

        try {
          const { profile } = await getProfile(user.id);
          if (profile) {
            set((state) => {
              state.profile = profile;
            });
          }
        } catch (error) {
          console.error('Failed to refresh profile:', error);
        }
      },

      // Mark onboarding as completed
      setOnboardingCompleted: () => {
        set((state) => {
          state.hasCompletedOnboarding = true;
        });
      },

      // Clear error
      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },
    })),
    {
      name: 'meetup-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectUser = (state: AuthState) => state.user;
export const selectProfile = (state: AuthState) => state.profile;
export const selectIsAuthenticated = (state: AuthState) => state.user !== null;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectIsOrganizer = (state: AuthState) =>
  state.profile?.subscriptionType === 'organizer';
export const selectHasSubscription = (state: AuthState) =>
  state.profile?.subscriptionType !== 'free';
export const selectCanCreateEvents = (state: AuthState) =>
  state.profile?.subscriptionType === 'organizer' &&
  (!state.profile.subscriptionExpiresAt || state.profile.subscriptionExpiresAt > new Date());
