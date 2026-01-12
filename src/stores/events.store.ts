/**
 * Events Store
 * Manages events state with optimistic updates and caching
 * Optimized for high-load: 10K concurrent events
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { CACHE_CONFIG, SEARCH_CONFIG } from '@/constants';
import {
  createEvent,
  getEventById,
  getEventsParticipating,
  getEventsByOrganizer,
  getSavedEvents,
  isEventSaved,
  isUserParticipating,
  joinEvent,
  leaveEvent,
  saveEvent,
  searchEvents,
  unsaveEvent,
  updateEvent,
} from '@/services/supabase/events.service';
import type {
  Event,
  EventCreateInput,
  EventFilters,
  EventUpdateInput,
  GeoPoint,
  PaginatedResult,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

interface EventsState {
  // Discovery
  discoveryEvents: Event[];
  discoveryFilters: EventFilters;
  discoveryPagination: {
    page: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  isLoadingDiscovery: boolean;

  // My Events
  myOrganizedEvents: Event[];
  myParticipatingEvents: Event[];
  isLoadingMyEvents: boolean;

  // Saved Events
  savedEvents: Event[];
  savedEventIds: Set<string>;
  isLoadingSaved: boolean;

  // Current Event
  currentEvent: Event | null;
  isLoadingCurrentEvent: boolean;
  isParticipating: boolean;

  // Cache
  eventsCache: Map<string, { event: Event; timestamp: number }>;
  lastFetched: {
    discovery: number | null;
    myEvents: number | null;
    saved: number | null;
  };

  // Error
  error: string | null;

  // Actions
  fetchDiscoveryEvents: (userLocation?: GeoPoint, reset?: boolean) => Promise<void>;
  loadMoreDiscoveryEvents: (userLocation?: GeoPoint) => Promise<void>;
  setDiscoveryFilters: (filters: Partial<EventFilters>) => void;
  resetDiscoveryFilters: () => void;

  fetchMyEvents: () => Promise<void>;
  fetchSavedEvents: () => Promise<void>;

  fetchEventById: (eventId: string) => Promise<Event | null>;
  createNewEvent: (input: EventCreateInput) => Promise<{ event: Event | null; error?: string }>;
  updateExistingEvent: (eventId: string, input: EventUpdateInput) => Promise<{ error?: string }>;

  joinEventAction: (eventId: string, message?: string) => Promise<{ error?: string }>;
  leaveEventAction: (eventId: string) => Promise<{ error?: string }>;

  saveEventAction: (eventId: string) => Promise<void>;
  unsaveEventAction: (eventId: string) => Promise<void>;

  clearError: () => void;
  invalidateCache: () => void;
}

const DEFAULT_FILTERS: EventFilters = {
  dateFrom: new Date(),
  maxDistance: SEARCH_CONFIG.defaultRadius,
  sortBy: 'date',
  sortOrder: 'asc',
};

// ============================================================================
// Store
// ============================================================================

export const useEventsStore = create<EventsState>()(
  immer((set, get) => ({
    // Initial state
    discoveryEvents: [],
    discoveryFilters: DEFAULT_FILTERS,
    discoveryPagination: {
      page: 1,
      totalPages: 1,
      hasNextPage: false,
    },
    isLoadingDiscovery: false,

    myOrganizedEvents: [],
    myParticipatingEvents: [],
    isLoadingMyEvents: false,

    savedEvents: [],
    savedEventIds: new Set(),
    isLoadingSaved: false,

    currentEvent: null,
    isLoadingCurrentEvent: false,
    isParticipating: false,

    eventsCache: new Map(),
    lastFetched: {
      discovery: null,
      myEvents: null,
      saved: null,
    },

    error: null,

    // Fetch discovery events
    fetchDiscoveryEvents: async (userLocation, reset = true) => {
      const { discoveryFilters, lastFetched } = get();

      // Check cache
      const now = Date.now();
      if (
        !reset &&
        lastFetched.discovery &&
        now - lastFetched.discovery < CACHE_CONFIG.eventListTTL
      ) {
        return;
      }

      set((state) => {
        state.isLoadingDiscovery = true;
        if (reset) {
          state.discoveryPagination.page = 1;
        }
      });

      try {
        const result = await searchEvents(
          discoveryFilters,
          { page: reset ? 1 : get().discoveryPagination.page, limit: SEARCH_CONFIG.eventsPerPage },
          userLocation
        );

        console.log('fetchDiscoveryEvents result:', result.data.length, 'events');

        set((state) => {
          state.discoveryEvents = result.data;
          console.log('Store updated with', result.data.length, 'events');
          state.discoveryPagination = {
            page: result.page,
            totalPages: result.totalPages,
            hasNextPage: result.hasNextPage,
          };
          state.isLoadingDiscovery = false;
          state.lastFetched.discovery = now;

          // Update cache
          for (const event of result.data) {
            state.eventsCache.set(event.id, { event, timestamp: now });
          }
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to fetch events';
          state.isLoadingDiscovery = false;
        });
      }
    },

    // Load more discovery events (pagination)
    loadMoreDiscoveryEvents: async (userLocation) => {
      const { discoveryPagination, isLoadingDiscovery } = get();

      if (isLoadingDiscovery || !discoveryPagination.hasNextPage) {
        return;
      }

      set((state) => {
        state.isLoadingDiscovery = true;
        state.discoveryPagination.page += 1;
      });

      try {
        const result = await searchEvents(
          get().discoveryFilters,
          { page: get().discoveryPagination.page, limit: SEARCH_CONFIG.eventsPerPage },
          userLocation
        );

        set((state) => {
          state.discoveryEvents = [...state.discoveryEvents, ...result.data];
          state.discoveryPagination.hasNextPage = result.hasNextPage;
          state.isLoadingDiscovery = false;

          // Update cache
          const now = Date.now();
          for (const event of result.data) {
            state.eventsCache.set(event.id, { event, timestamp: now });
          }
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to load more events';
          state.isLoadingDiscovery = false;
        });
      }
    },

    // Set discovery filters
    setDiscoveryFilters: (filters) => {
      set((state) => {
        state.discoveryFilters = { ...state.discoveryFilters, ...filters };
        state.lastFetched.discovery = null; // Invalidate cache
      });
    },

    // Reset discovery filters to defaults
    resetDiscoveryFilters: () => {
      set((state) => {
        state.discoveryFilters = DEFAULT_FILTERS;
        state.lastFetched.discovery = null;
      });
    },

    // Fetch user's organized and participating events
    fetchMyEvents: async () => {
      set((state) => {
        state.isLoadingMyEvents = true;
      });

      try {
        const [organized, participating] = await Promise.all([
          getEventsByOrganizer('me', { page: 1, limit: 50 }),
          getEventsParticipating('me', { page: 1, limit: 50 }),
        ]);

        set((state) => {
          state.myOrganizedEvents = organized.data;
          state.myParticipatingEvents = participating.data;
          state.isLoadingMyEvents = false;
          state.lastFetched.myEvents = Date.now();
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to fetch my events';
          state.isLoadingMyEvents = false;
        });
      }
    },

    // Fetch saved events
    fetchSavedEvents: async () => {
      set((state) => {
        state.isLoadingSaved = true;
      });

      try {
        const { events } = await getSavedEvents();

        set((state) => {
          state.savedEvents = events;
          state.savedEventIds = new Set(events.map((e) => e.id));
          state.isLoadingSaved = false;
          state.lastFetched.saved = Date.now();
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to fetch saved events';
          state.isLoadingSaved = false;
        });
      }
    },

    // Fetch event by ID (with cache)
    fetchEventById: async (eventId) => {
      const { eventsCache } = get();
      const now = Date.now();

      // Check cache first
      const cached = eventsCache.get(eventId);
      if (cached && now - cached.timestamp < CACHE_CONFIG.eventListTTL) {
        set((state) => {
          state.currentEvent = cached.event;
        });
        return cached.event;
      }

      set((state) => {
        state.isLoadingCurrentEvent = true;
      });

      try {
        const { event, error } = await getEventById(eventId);

        if (error || !event) {
          set((state) => {
            state.error = error?.message ?? 'Event not found';
            state.isLoadingCurrentEvent = false;
          });
          return null;
        }

        // Check participation status
        const participating = await isUserParticipating(eventId);
        const saved = await isEventSaved(eventId);

        set((state) => {
          state.currentEvent = event;
          state.isParticipating = participating;
          state.isLoadingCurrentEvent = false;
          state.eventsCache.set(eventId, { event, timestamp: now });

          if (saved) {
            state.savedEventIds.add(eventId);
          }
        });

        return event;
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to fetch event';
          state.isLoadingCurrentEvent = false;
        });
        return null;
      }
    },

    // Create new event
    createNewEvent: async (input) => {
      try {
        const { event, error } = await createEvent(input);

        if (error || !event) {
          return { event: null, error: error?.message ?? 'Failed to create event' };
        }

        set((state) => {
          state.myOrganizedEvents = [event, ...state.myOrganizedEvents];
          state.eventsCache.set(event.id, { event, timestamp: Date.now() });
        });

        return { event };
      } catch (error) {
        return {
          event: null,
          error: error instanceof Error ? error.message : 'Failed to create event',
        };
      }
    },

    // Update existing event
    updateExistingEvent: async (eventId, input) => {
      try {
        const { event, error } = await updateEvent(eventId, input);

        if (error || !event) {
          return { error: error?.message ?? 'Failed to update event' };
        }

        set((state) => {
          // Update in cache
          state.eventsCache.set(eventId, { event, timestamp: Date.now() });

          // Update in lists
          const orgIdx = state.myOrganizedEvents.findIndex((e) => e.id === eventId);
          if (orgIdx !== -1) {
            state.myOrganizedEvents[orgIdx] = event;
          }

          if (state.currentEvent?.id === eventId) {
            state.currentEvent = event;
          }
        });

        return {};
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to update event',
        };
      }
    },

    // Join event (optimistic update)
    joinEventAction: async (eventId, message) => {
      // Optimistic update
      set((state) => {
        state.isParticipating = true;
        if (state.currentEvent?.id === eventId) {
          state.currentEvent.currentParticipants += 1;
        }
      });

      try {
        const { error } = await joinEvent(eventId, message);

        if (error) {
          // Rollback on error
          set((state) => {
            state.isParticipating = false;
            if (state.currentEvent?.id === eventId) {
              state.currentEvent.currentParticipants -= 1;
            }
          });
          return { error: error.message };
        }

        // Refresh my events
        get().fetchMyEvents();
        return {};
      } catch (error) {
        // Rollback on error
        set((state) => {
          state.isParticipating = false;
          if (state.currentEvent?.id === eventId) {
            state.currentEvent.currentParticipants -= 1;
          }
        });
        return {
          error: error instanceof Error ? error.message : 'Failed to join event',
        };
      }
    },

    // Leave event (optimistic update)
    leaveEventAction: async (eventId) => {
      // Optimistic update
      set((state) => {
        state.isParticipating = false;
        if (state.currentEvent?.id === eventId) {
          state.currentEvent.currentParticipants = Math.max(
            0,
            state.currentEvent.currentParticipants - 1
          );
        }
      });

      try {
        const { error } = await leaveEvent(eventId);

        if (error) {
          // Rollback on error
          set((state) => {
            state.isParticipating = true;
            if (state.currentEvent?.id === eventId) {
              state.currentEvent.currentParticipants += 1;
            }
          });
          return { error: error.message };
        }

        // Refresh my events
        get().fetchMyEvents();
        return {};
      } catch (error) {
        // Rollback on error
        set((state) => {
          state.isParticipating = true;
          if (state.currentEvent?.id === eventId) {
            state.currentEvent.currentParticipants += 1;
          }
        });
        return {
          error: error instanceof Error ? error.message : 'Failed to leave event',
        };
      }
    },

    // Save event to favorites (optimistic update)
    saveEventAction: async (eventId) => {
      // Optimistic update
      set((state) => {
        state.savedEventIds.add(eventId);
      });

      try {
        await saveEvent(eventId);
        // Refresh saved events
        get().fetchSavedEvents();
      } catch (error) {
        // Rollback on error
        set((state) => {
          state.savedEventIds.delete(eventId);
        });
      }
    },

    // Unsave event (optimistic update)
    unsaveEventAction: async (eventId) => {
      // Optimistic update
      set((state) => {
        state.savedEventIds.delete(eventId);
        state.savedEvents = state.savedEvents.filter((e) => e.id !== eventId);
      });

      try {
        await unsaveEvent(eventId);
      } catch (error) {
        // Rollback on error - refetch
        get().fetchSavedEvents();
      }
    },

    // Clear error
    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },

    // Invalidate all caches
    invalidateCache: () => {
      set((state) => {
        state.eventsCache.clear();
        state.lastFetched = {
          discovery: null,
          myEvents: null,
          saved: null,
        };
      });
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectDiscoveryEvents = (state: EventsState) => state.discoveryEvents;
export const selectIsLoadingDiscovery = (state: EventsState) => state.isLoadingDiscovery;
export const selectDiscoveryFilters = (state: EventsState) => state.discoveryFilters;
export const selectHasMoreEvents = (state: EventsState) => state.discoveryPagination.hasNextPage;

export const selectMyOrganizedEvents = (state: EventsState) => state.myOrganizedEvents;
export const selectMyParticipatingEvents = (state: EventsState) => state.myParticipatingEvents;

export const selectCurrentEvent = (state: EventsState) => state.currentEvent;
export const selectIsParticipating = (state: EventsState) => state.isParticipating;

export const selectIsEventSaved = (eventId: string) => (state: EventsState) =>
  state.savedEventIds.has(eventId);
