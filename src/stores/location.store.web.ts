/**
 * Location Store - Web Version
 * Stub implementation for web platform (expo-location not supported)
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { RUSSIAN_CITIES, type City } from '@/constants/cities';
import type { GeoLocation, GeoPoint } from '@/types';

// ============================================================================
// Types
// ============================================================================

type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied';

interface LocationState {
  // State
  currentLocation: GeoLocation | null;
  lastKnownLocation: GeoPoint | null;
  nearestCity: City | null;
  selectedCity: City | null;
  permissionStatus: LocationPermissionStatus;
  isLoading: boolean;
  error: string | null;

  // Watch (not supported on web)
  watchSubscription: null;

  // Actions
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<GeoLocation | null>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
  setSelectedCity: (city: City) => void;
  updateUserLocation: () => Promise<void>;
}

// ============================================================================
// Store (Web Version - Location features not available)
// ============================================================================

export const useLocationStore = create<LocationState>()(
  immer((set) => ({
    // Initial state - default to first Russian city
    currentLocation: null,
    lastKnownLocation: RUSSIAN_CITIES[0]?.location ?? null,
    nearestCity: RUSSIAN_CITIES[0] ?? null,
    selectedCity: RUSSIAN_CITIES[0] ?? null,
    permissionStatus: 'denied',
    isLoading: false,
    error: 'Геолокация недоступна в веб-версии',
    watchSubscription: null,

    // Request location permission - not supported on web
    requestPermission: async () => {
      console.warn('Location permission not available on web');
      return false;
    },

    // Get current location - not supported on web
    getCurrentLocation: async () => {
      console.warn('Location not available on web');
      return null;
    },

    // Start watching location changes - not supported on web
    startWatching: async () => {
      console.warn('Location watching not available on web');
    },

    // Stop watching location - no-op on web
    stopWatching: () => {},

    // Set selected city manually - works on web
    setSelectedCity: (city) => {
      set((state) => {
        state.selectedCity = city;
        state.nearestCity = city;
        state.lastKnownLocation = city.location;
      });
    },

    // Update user's location in database - no-op on web
    updateUserLocation: async () => {
      console.warn('Location update not available on web');
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectCurrentLocation = (state: LocationState) => state.currentLocation;
export const selectLastKnownLocation = (state: LocationState) => state.lastKnownLocation;
export const selectNearestCity = (state: LocationState) => state.nearestCity;
export const selectSelectedCity = (state: LocationState) => state.selectedCity;
export const selectEffectiveCity = (state: LocationState) =>
  state.selectedCity ?? state.nearestCity ?? RUSSIAN_CITIES[0];
export const selectLocationPermissionGranted = (state: LocationState) =>
  state.permissionStatus === 'granted';
export const selectIsLoadingLocation = (state: LocationState) => state.isLoading;

/**
 * Get effective location for search (user location or selected city center)
 */
export const selectEffectiveLocation = (state: LocationState): GeoPoint | null => {
  if (state.lastKnownLocation) {
    return state.lastKnownLocation;
  }
  if (state.selectedCity) {
    return state.selectedCity.location;
  }
  if (state.nearestCity) {
    return state.nearestCity.location;
  }
  return RUSSIAN_CITIES[0]?.location ?? null;
};
