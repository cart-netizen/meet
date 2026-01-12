/**
 * Events Map Screen
 * Displays all events on an interactive map
 * Falls back to a placeholder in Expo Go
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Badge } from '@/components/ui';
import { getCategoryById, THEME_COLORS } from '@/constants';
import { useEventsStore, useLocationStore } from '@/stores';
import type { Event } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

// ============================================================================
// Constants
// ============================================================================

const MOSCOW_REGION: Region = {
  latitude: 55.7558,
  longitude: 37.6173,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

// ============================================================================
// Component
// ============================================================================

export default function EventsMapScreen() {
  const events = useEventsStore((state) => state.events);
  const fetchEvents = useEventsStore((state) => state.fetchEvents);
  const userLocation = useLocationStore((state) => state.location);

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if running in Expo Go - must be inside component
  const isExpoGo = Constants.appOwnership === 'expo';
  const isMapAvailable = !isExpoGo && Platform.OS !== 'web';

  // Dynamically load react-native-maps only when available
  const mapComponents = useMemo(() => {
    if (!isMapAvailable) return null;

    try {
      const maps = require('react-native-maps');
      return {
        MapView: maps.default,
        Marker: maps.Marker,
        Callout: maps.Callout,
        PROVIDER_GOOGLE: maps.PROVIDER_GOOGLE,
      };
    } catch {
      return null;
    }
  }, [isMapAvailable]);

  // Fetch events on mount
  useEffect(() => {
    async function loadEvents() {
      setIsLoading(true);
      try {
        await fetchEvents();
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setIsLoading(false);
      }
    }
    void loadEvents();
  }, [fetchEvents]);

  // Filter events with valid locations
  const eventsWithLocation = useMemo(
    () => (events ?? []).filter((event) => event.location != null),
    [events]
  );

  // Calculate initial region based on user location or events
  const initialRegion = useMemo<Region>(() => {
    if (userLocation) {
      return {
        ...userLocation,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    if (eventsWithLocation.length > 0) {
      const avgLat =
        eventsWithLocation.reduce((sum, e) => sum + e.location!.latitude, 0) /
        eventsWithLocation.length;
      const avgLon =
        eventsWithLocation.reduce((sum, e) => sum + e.location!.longitude, 0) /
        eventsWithLocation.length;

      return {
        latitude: avgLat,
        longitude: avgLon,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      };
    }

    return MOSCOW_REGION;
  }, [userLocation, eventsWithLocation]);

  // Handle marker press
  const handleMarkerPress = useCallback((event: Event) => {
    setSelectedEvent(event);
  }, []);

  // Handle navigate to event
  const handleNavigateToEvent = useCallback((eventId: string) => {
    setSelectedEvent(null);
    router.push(`/event/${eventId}`);
  }, []);

  // Get marker color based on category
  const getMarkerColor = useCallback((categoryId: string) => {
    const category = getCategoryById(categoryId);
    return category?.color ?? THEME_COLORS.primary;
  }, []);

  // Fallback for Web and Expo Go
  if (!mapComponents) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>События на карте</Text>
          <Badge variant="secondary" size="sm">
            {eventsWithLocation.length} событий
          </Badge>
        </View>
        <View style={styles.fallback}>
          <Text style={styles.fallbackIcon}>🗺️</Text>
          <Text style={styles.fallbackText}>
            {isExpoGo
              ? 'Карты недоступны в Expo Go'
              : 'Карта недоступна в веб-версии'}
          </Text>
          {isExpoGo && (
            <Text style={styles.fallbackHint}>
              Для использования карт создайте development build
            </Text>
          )}
          <Pressable
            style={styles.fallbackButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.fallbackButtonText}>Смотреть список</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { MapView: MapViewComponent, Marker: MarkerComponent, Callout: CalloutComponent, PROVIDER_GOOGLE } = mapComponents;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>События на карте</Text>
        <Badge variant="secondary" size="sm">
          {eventsWithLocation.length} событий
        </Badge>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapViewComponent
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton
          showsCompass
        >
          {eventsWithLocation.map((event) => {
            const category = getCategoryById(event.categoryId);
            return (
              <MarkerComponent
                key={event.id}
                coordinate={event.location!}
                pinColor={getMarkerColor(event.categoryId)}
                onPress={() => handleMarkerPress(event)}
              >
                <View style={styles.customMarker}>
                  <Text style={styles.customMarkerIcon}>
                    {category?.icon ?? '📍'}
                  </Text>
                </View>
                <CalloutComponent tooltip onPress={() => handleNavigateToEvent(event.id)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.calloutDate}>
                      {format(event.startsAt, "d MMM, HH:mm", { locale: ru })}
                    </Text>
                    <Text style={styles.calloutHint}>Нажмите для подробностей</Text>
                  </View>
                </CalloutComponent>
              </MarkerComponent>
            );
          })}
        </MapViewComponent>

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Загрузка событий...</Text>
          </View>
        )}
      </View>

      {/* Selected Event Card */}
      {selectedEvent && (
        <Pressable
          style={styles.eventCard}
          onPress={() => handleNavigateToEvent(selectedEvent.id)}
        >
          <View style={styles.eventCardHeader}>
            <View
              style={[
                styles.eventCardCategory,
                { backgroundColor: getMarkerColor(selectedEvent.categoryId) },
              ]}
            >
              <Text style={styles.eventCardCategoryIcon}>
                {getCategoryById(selectedEvent.categoryId)?.icon ?? '📍'}
              </Text>
            </View>
            <View style={styles.eventCardContent}>
              <Text style={styles.eventCardTitle} numberOfLines={1}>
                {selectedEvent.title}
              </Text>
              <Text style={styles.eventCardDate}>
                {format(selectedEvent.startsAt, "EEEE, d MMMM в HH:mm", { locale: ru })}
              </Text>
            </View>
            <Pressable
              style={styles.eventCardClose}
              onPress={() => setSelectedEvent(null)}
            >
              <Text style={styles.eventCardCloseText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.eventCardFooter}>
            <Text style={styles.eventCardAddress} numberOfLines={1}>
              📍 {selectedEvent.placeName ?? selectedEvent.address}
            </Text>
            <Text style={styles.eventCardParticipants}>
              👥 {selectedEvent.currentParticipants}/{selectedEvent.maxParticipants}
            </Text>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: THEME_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME_COLORS.text,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  customMarkerIcon: {
    fontSize: 20,
  },
  callout: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
    maxWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  calloutDate: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginBottom: 4,
  },
  calloutHint: {
    fontSize: 11,
    color: THEME_COLORS.primary,
    marginTop: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
  eventCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventCardCategory: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCardCategoryIcon: {
    fontSize: 22,
  },
  eventCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  eventCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  eventCardDate: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  eventCardClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME_COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCardCloseText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
  eventCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
  },
  eventCardAddress: {
    flex: 1,
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  eventCardParticipants: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginLeft: 12,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fallbackIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  fallbackText: {
    fontSize: 18,
    color: THEME_COLORS.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackHint: {
    fontSize: 14,
    color: THEME_COLORS.textMuted,
    marginBottom: 24,
    textAlign: 'center',
  },
  fallbackButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 12,
  },
  fallbackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
