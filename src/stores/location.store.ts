/**
 * Location Store
 * Manages user location state and permissions
 */

import * as Location from 'expo-location';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { getNearestCity, RUSSIAN_CITIES, type City } from '@/constants/cities';
import { updateLocation } from '@/services/supabase/profiles.service';
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

  // Watch
  watchSubscription: Location.LocationSubscription | null;

  // Actions
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<GeoLocation | null>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
  setSelectedCity: (city: City) => void;
  updateUserLocation: () => Promise<void>;
}

// ============================================================================
// Store
// ============================================================================

export const useLocationStore = create<LocationState>()(
  immer((set, get) => ({
    // Initial state
    currentLocation: null,
    lastKnownLocation: null,
    nearestCity: null,
    selectedCity: null,
    permissionStatus: 'undetermined',
    isLoading: false,
    error: null,
    watchSubscription: null,

    // Request location permission
    requestPermission: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === 'granted';

        set((state) => {
          state.permissionStatus = granted ? 'granted' : 'denied';
          state.isLoading = false;
        });

        return granted;
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to request permission';
          state.isLoading = false;
          state.permissionStatus = 'denied';
        });
        return false;
      }
    },

    // Get current location
    getCurrentLocation: async () => {
      const { permissionStatus } = get();

      if (permissionStatus !== 'granted') {
        const granted = await get().requestPermission();
        if (!granted) {
          return null;
        }
      }

      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const geoLocation: GeoLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: location.timestamp,
        };

        // Find nearest city
        const nearestCity = getNearestCity({
          latitude: geoLocation.latitude,
          longitude: geoLocation.longitude,
        });

        set((state) => {
          state.currentLocation = geoLocation;
          state.lastKnownLocation = {
            latitude: geoLocation.latitude,
            longitude: geoLocation.longitude,
          };
          state.nearestCity = nearestCity ?? null;
          state.isLoading = false;
        });

        return geoLocation;
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to get location';
          state.isLoading = false;
        });
        return null;
      }
    },

    // Start watching location changes
    startWatching: async () => {
      const { permissionStatus, watchSubscription } = get();

      if (watchSubscription) {
        return; // Already watching
      }

      if (permissionStatus !== 'granted') {
        const granted = await get().requestPermission();
        if (!granted) {
          return;
        }
      }

      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 100, // Update every 100 meters
            timeInterval: 60000, // Update every minute at most
          },
          (location) => {
            const geoLocation: GeoLocation = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
              altitude: location.coords.altitude,
              heading: location.coords.heading,
              speed: location.coords.speed,
              timestamp: location.timestamp,
            };

            const nearestCity = getNearestCity({
              latitude: geoLocation.latitude,
              longitude: geoLocation.longitude,
            });

            set((state) => {
              state.currentLocation = geoLocation;
              state.lastKnownLocation = {
                latitude: geoLocation.latitude,
                longitude: geoLocation.longitude,
              };
              state.nearestCity = nearestCity ?? null;
            });
          }
        );

        set((state) => {
          state.watchSubscription = subscription;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to watch location';
        });
      }
    },

    // Stop watching location
    stopWatching: () => {
      const { watchSubscription } = get();
      if (watchSubscription) {
        watchSubscription.remove();
        set((state) => {
          state.watchSubscription = null;
        });
      }
    },

    // Set selected city manually
    setSelectedCity: (city) => {
      set((state) => {
        state.selectedCity = city;
        state.lastKnownLocation = city.location;
      });
    },

    // Update user's location in database
    updateUserLocation: async () => {
      const { currentLocation } = get();

      if (!currentLocation) {
        return;
      }

      try {
        await updateLocation({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        });
      } catch (error) {
        console.error('Failed to update user location:', error);
      }
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
