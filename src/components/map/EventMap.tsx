/**
 * EventMap Component
 * Map component for displaying and selecting event locations
 * Uses react-native-maps with fallback for web and Expo Go
 */

import { useCallback, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';

import { THEME_COLORS } from '@/constants';
import type { GeoPoint } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface EventMapMarker {
  id: string;
  location: GeoPoint;
  title: string;
  description?: string;
  color?: string;
}

export interface EventMapProps {
  /** Initial region to display */
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  /** Markers to display on the map */
  markers?: EventMapMarker[];
  /** Selected location (for location picker) */
  selectedLocation?: GeoPoint | null;
  /** Whether to allow selecting location by tap */
  selectable?: boolean;
  /** Callback when location is selected */
  onLocationSelect?: (location: GeoPoint) => void;
  /** Callback when marker is pressed */
  onMarkerPress?: (marker: EventMapMarker) => void;
  /** Map height */
  height?: number;
  /** Show user location */
  showUserLocation?: boolean;
}

// ============================================================================
// Check if running in Expo Go
// ============================================================================

const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally load react-native-maps (not available in Expo Go)
let MapView: typeof import('react-native-maps').default | null = null;
let Marker: typeof import('react-native-maps').Marker | null = null;
let PROVIDER_GOOGLE: typeof import('react-native-maps').PROVIDER_GOOGLE | undefined = undefined;

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch (error) {
    console.warn('react-native-maps not available:', error);
  }
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_REGION = {
  latitude: 55.7558,
  longitude: 37.6173,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

const MOSCOW_REGION = {
  latitude: 55.7558,
  longitude: 37.6173,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// ============================================================================
// Component
// ============================================================================

export function EventMap({
  initialRegion,
  markers = [],
  selectedLocation,
  selectable = false,
  onLocationSelect,
  onMarkerPress,
  height = 300,
  showUserLocation = false,
}: EventMapProps) {
  const mapRef = useRef<InstanceType<typeof import('react-native-maps').default> | null>(null);
  const [region, setRegion] = useState(initialRegion ?? DEFAULT_REGION);

  // Handle map press for location selection
  const handleMapPress = useCallback(
    (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      if (!selectable || !onLocationSelect) return;

      const { latitude, longitude } = event.nativeEvent.coordinate;
      onLocationSelect({ latitude, longitude });
    },
    [selectable, onLocationSelect]
  );

  // Handle marker press
  const handleMarkerPress = useCallback(
    (marker: EventMapMarker) => {
      if (onMarkerPress) {
        onMarkerPress(marker);
      }
    },
    [onMarkerPress]
  );

  // Center on Moscow button
  const handleCenterMoscow = useCallback(() => {
    mapRef.current?.animateToRegion(MOSCOW_REGION);
  }, []);

  // Fallback for Web and Expo Go
  if (Platform.OS === 'web' || isExpoGo || !MapView || !Marker) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackIcon}>🗺️</Text>
          <Text style={styles.fallbackText}>
            {isExpoGo
              ? 'Карты недоступны в Expo Go'
              : 'Карта недоступна в веб-версии'}
          </Text>
          {selectedLocation && (
            <Text style={styles.fallbackCoordinates}>
              📍 {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
            </Text>
          )}
          {markers.length > 0 && (
            <Text style={styles.fallbackMarkers}>
              {markers.length} мест{markers.length === 1 ? 'о' : markers.length < 5 ? 'а' : ''}
            </Text>
          )}
          {isExpoGo && (
            <Text style={styles.fallbackHint}>
              Для использования карт создайте development build
            </Text>
          )}
        </View>
      </View>
    );
  }

  const MapViewComponent = MapView;
  const MarkerComponent = Marker;

  return (
    <View style={[styles.container, { height }]}>
      <MapViewComponent
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion ?? DEFAULT_REGION}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={showUserLocation}
        showsCompass
        onPress={handleMapPress}
        onRegionChangeComplete={setRegion}
      >
        {/* Selected location marker */}
        {selectedLocation && (
          <MarkerComponent
            coordinate={selectedLocation}
            pinColor={THEME_COLORS.primary}
            title="Выбранное место"
          />
        )}

        {/* Event markers */}
        {markers.map((marker) => (
          <MarkerComponent
            key={marker.id}
            coordinate={marker.location}
            pinColor={marker.color ?? THEME_COLORS.primary}
            title={marker.title}
            description={marker.description}
            onPress={() => handleMarkerPress(marker)}
          />
        ))}
      </MapViewComponent>

      {/* Controls overlay */}
      <View style={styles.controls}>
        <Pressable style={styles.controlButton} onPress={handleCenterMoscow}>
          <Text style={styles.controlButtonText}>📍</Text>
        </Pressable>
      </View>

      {/* Selection hint */}
      {selectable && !selectedLocation && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Нажмите на карту, чтобы выбрать место
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: THEME_COLORS.surface,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlButtonText: {
    fontSize: 20,
  },
  hint: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLORS.surfaceVariant,
    padding: 20,
  },
  fallbackIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  fallbackText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
  },
  fallbackCoordinates: {
    fontSize: 13,
    color: THEME_COLORS.text,
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fallbackMarkers: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    marginTop: 8,
  },
  fallbackHint: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    marginTop: 16,
    textAlign: 'center',
  },
});
