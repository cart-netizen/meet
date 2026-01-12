/**
 * LocationPicker Component
 * Combined address search and map picker for selecting event locations
 */

import { useCallback, useState, useEffect } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Input } from '@/components/ui';
import { EventMap } from './EventMap';
import { THEME_COLORS } from '@/constants';
import {
  getPlaceSuggestions,
  reverseGeocode,
  type PlaceSuggestion,
} from '@/services/location/yandex-maps.service';
import type { GeoPoint } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface LocationPickerProps {
  /** Current address */
  address: string;
  /** Current location coordinates */
  location: GeoPoint | null;
  /** Place name */
  placeName?: string;
  /** Callback when address changes */
  onAddressChange: (address: string) => void;
  /** Callback when location changes */
  onLocationChange: (location: GeoPoint | null) => void;
  /** Callback when place name changes */
  onPlaceNameChange?: (placeName: string) => void;
  /** User's current location for better suggestions */
  userLocation?: GeoPoint | null;
  /** Map height */
  mapHeight?: number;
}

// ============================================================================
// Component
// ============================================================================

export function LocationPicker({
  address,
  location,
  placeName,
  onAddressChange,
  onLocationChange,
  onPlaceNameChange,
  userLocation,
  mapHeight = 250,
}: LocationPickerProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Fetch suggestions when address changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (address.length >= 3) {
        try {
          const results = await getPlaceSuggestions(
            address,
            userLocation ?? undefined
          );
          setSuggestions(results);
        } catch (error) {
          console.error('Failed to fetch suggestions:', error);
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    };

    // Debounce the search
    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [address, userLocation]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(
    (suggestion: PlaceSuggestion) => {
      onAddressChange(suggestion.address);
      onLocationChange(suggestion.location);
      if (onPlaceNameChange) {
        onPlaceNameChange(suggestion.title);
      }
      setSuggestions([]);
      Keyboard.dismiss();
    },
    [onAddressChange, onLocationChange, onPlaceNameChange]
  );

  // Handle map location selection
  const handleMapLocationSelect = useCallback(
    async (newLocation: GeoPoint) => {
      onLocationChange(newLocation);

      // Reverse geocode to get address
      setIsReverseGeocoding(true);
      try {
        const result = await reverseGeocode(newLocation);
        if (result) {
          onAddressChange(result.address);
          if (onPlaceNameChange && result.placeName) {
            onPlaceNameChange(result.placeName);
          }
        }
      } catch (error) {
        console.error('Failed to reverse geocode:', error);
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [onAddressChange, onLocationChange, onPlaceNameChange]
  );

  // Toggle map visibility
  const handleToggleMap = useCallback(() => {
    setShowMap((prev) => !prev);
    Keyboard.dismiss();
  }, []);

  return (
    <View style={styles.container}>
      {/* Address Input */}
      <Input
        value={address}
        onChangeText={onAddressChange}
        placeholder="Введите адрес..."
      />

      {/* Toggle map button */}
      <Pressable style={styles.mapToggle} onPress={handleToggleMap}>
        <Text style={styles.mapToggleText}>
          {showMap ? '🗺️ Скрыть карту' : '🗺️ Показать на карте'}
        </Text>
      </Pressable>

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleSelectSuggestion(suggestion)}
            >
              <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
              <Text style={styles.suggestionSubtitle}>{suggestion.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Map */}
      {showMap && (
        <View style={styles.mapContainer}>
          <EventMap
            height={mapHeight}
            selectedLocation={location}
            selectable
            onLocationSelect={handleMapLocationSelect}
            showUserLocation
            initialRegion={
              location
                ? {
                    ...location,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }
                : userLocation
                ? {
                    ...userLocation,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }
                : undefined
            }
          />
          {isReverseGeocoding && (
            <View style={styles.geocodingOverlay}>
              <Text style={styles.geocodingText}>Определение адреса...</Text>
            </View>
          )}
        </View>
      )}

      {/* Location Confirmation */}
      {location && (
        <View style={styles.confirmation}>
          <Text style={styles.confirmationIcon}>✓</Text>
          <View style={styles.confirmationContent}>
            <Text style={styles.confirmationTitle}>Координаты определены</Text>
            <Text style={styles.confirmationCoords}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>
        </View>
      )}

      {/* Place Name Input */}
      {onPlaceNameChange && (
        <View style={styles.placeNameContainer}>
          <Text style={styles.label}>Название места (необязательно)</Text>
          <Input
            value={placeName ?? ''}
            onChangeText={onPlaceNameChange}
            placeholder="Например: Кофейня Surf"
          />
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
    gap: 12,
  },
  mapToggle: {
    paddingVertical: 14,
    backgroundColor: THEME_COLORS.surfaceVariant,
    borderRadius: 12,
    alignItems: 'center',
  },
  mapToggleText: {
    fontSize: 15,
    color: THEME_COLORS.text,
    fontWeight: '500',
  },
  suggestions: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME_COLORS.text,
    marginBottom: 2,
  },
  suggestionSubtitle: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  geocodingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geocodingText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  confirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${THEME_COLORS.success}15`,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  confirmationIcon: {
    fontSize: 18,
    color: THEME_COLORS.success,
  },
  confirmationContent: {
    flex: 1,
  },
  confirmationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME_COLORS.success,
  },
  confirmationCoords: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  placeNameContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
});
