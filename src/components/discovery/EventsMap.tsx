/**
 * Events Map Component
 * Displays events on an interactive map with clustering
 */

import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
  Platform,
} from 'react-native';

import { getCategoryById, THEME_COLORS } from '@/constants';
import { calculateBounds } from '@/services/location/yandex-maps.service';
import type { Event, GeoPoint } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface EventsMapProps {
  events: Event[];
  userLocation?: GeoPoint | null;
  onEventPress?: (event: Event) => void;
  onMapPress?: (location: GeoPoint) => void;
  selectedEventId?: string;
}

interface MapMarker {
  id: string;
  location: GeoPoint;
  event: Event;
}

interface Cluster {
  id: string;
  location: GeoPoint;
  events: Event[];
  count: number;
}

// ============================================================================
// Component
// ============================================================================

export const EventsMap = memo(function EventsMap({
  events,
  userLocation,
  onEventPress,
  onMapPress,
  selectedEventId,
}: EventsMapProps) {
  const [mapRegion, setMapRegion] = useState(() => {
    const allPoints = events.map((e) => e.location);
    if (userLocation) {
      allPoints.push(userLocation);
    }
    const { center, delta } = calculateBounds(allPoints);
    return {
      ...center,
      ...delta,
    };
  });

  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);

  // Cluster events for performance
  const { markers, clusters } = useMemo(() => {
    return clusterEvents(events, mapRegion.latitudeDelta);
  }, [events, mapRegion.latitudeDelta]);

  const handleMarkerPress = useCallback(
    (marker: MapMarker) => {
      onEventPress?.(marker.event);
    },
    [onEventPress]
  );

  const handleClusterPress = useCallback((cluster: Cluster) => {
    setSelectedCluster(cluster);
  }, []);

  // For now, render a placeholder since Yandex Maps requires native integration
  // In production, this would use react-native-yamap
  return (
    <View style={styles.container}>
      {/* Map Placeholder */}
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapGrid}>
          {/* Render markers as dots on placeholder */}
          {markers.map((marker) => {
            const category = getCategoryById(marker.event.categoryId);
            const isSelected = marker.event.id === selectedEventId;

            return (
              <Pressable
                key={marker.id}
                style={[
                  styles.markerDot,
                  {
                    left: `${((marker.location.longitude - mapRegion.longitude + mapRegion.longitudeDelta / 2) / mapRegion.longitudeDelta) * 100}%`,
                    top: `${((mapRegion.latitude + mapRegion.latitudeDelta / 2 - marker.location.latitude) / mapRegion.latitudeDelta) * 100}%`,
                    backgroundColor: category?.color ?? THEME_COLORS.primary,
                    transform: [{ scale: isSelected ? 1.3 : 1 }],
                  },
                ]}
                onPress={() => handleMarkerPress(marker)}
              >
                <Text style={styles.markerIcon}>{category?.icon ?? '📍'}</Text>
              </Pressable>
            );
          })}

          {/* Render clusters */}
          {clusters.map((cluster) => (
            <Pressable
              key={cluster.id}
              style={[
                styles.clusterDot,
                {
                  left: `${((cluster.location.longitude - mapRegion.longitude + mapRegion.longitudeDelta / 2) / mapRegion.longitudeDelta) * 100}%`,
                  top: `${((mapRegion.latitude + mapRegion.latitudeDelta / 2 - cluster.location.latitude) / mapRegion.latitudeDelta) * 100}%`,
                },
              ]}
              onPress={() => handleClusterPress(cluster)}
            >
              <Text style={styles.clusterText}>{cluster.count}</Text>
            </Pressable>
          ))}

          {/* User location */}
          {userLocation && (
            <View
              style={[
                styles.userLocation,
                {
                  left: `${((userLocation.longitude - mapRegion.longitude + mapRegion.longitudeDelta / 2) / mapRegion.longitudeDelta) * 100}%`,
                  top: `${((mapRegion.latitude + mapRegion.latitudeDelta / 2 - userLocation.latitude) / mapRegion.latitudeDelta) * 100}%`,
                },
              ]}
            />
          )}
        </View>

        <Text style={styles.placeholderText}>
          Карта Yandex Maps{'\n'}
          (требуется интеграция SDK)
        </Text>
      </View>

      {/* Map Controls */}
      <View style={styles.controls}>
        <Pressable
          style={styles.controlButton}
          onPress={() =>
            setMapRegion((r) => ({
              ...r,
              latitudeDelta: r.latitudeDelta / 2,
              longitudeDelta: r.longitudeDelta / 2,
            }))
          }
        >
          <Text style={styles.controlIcon}>+</Text>
        </Pressable>
        <Pressable
          style={styles.controlButton}
          onPress={() =>
            setMapRegion((r) => ({
              ...r,
              latitudeDelta: r.latitudeDelta * 2,
              longitudeDelta: r.longitudeDelta * 2,
            }))
          }
        >
          <Text style={styles.controlIcon}>−</Text>
        </Pressable>
        {userLocation && (
          <Pressable
            style={[styles.controlButton, styles.locationButton]}
            onPress={() =>
              setMapRegion((r) => ({
                ...r,
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }))
            }
          >
            <Text style={styles.controlIcon}>◎</Text>
          </Pressable>
        )}
      </View>

      {/* Selected Event Card */}
      {selectedEventId && (
        <View style={styles.selectedCard}>
          {events
            .filter((e) => e.id === selectedEventId)
            .map((event) => {
              const category = getCategoryById(event.categoryId);
              return (
                <Pressable
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => onEventPress?.(event)}
                >
                  <View
                    style={[
                      styles.eventCardBadge,
                      { backgroundColor: category?.color ?? THEME_COLORS.primary },
                    ]}
                  >
                    <Text style={styles.eventCardIcon}>{category?.icon ?? '📍'}</Text>
                  </View>
                  <View style={styles.eventCardContent}>
                    <Text style={styles.eventCardTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.eventCardSubtitle} numberOfLines={1}>
                      {event.placeName ?? event.address}
                    </Text>
                  </View>
                  <Text style={styles.eventCardArrow}>›</Text>
                </Pressable>
              );
            })}
        </View>
      )}

      {/* Cluster Popup */}
      {selectedCluster && (
        <View style={styles.clusterPopup}>
          <View style={styles.clusterPopupHeader}>
            <Text style={styles.clusterPopupTitle}>
              {selectedCluster.count} встреч рядом
            </Text>
            <Pressable onPress={() => setSelectedCluster(null)}>
              <Text style={styles.clusterPopupClose}>✕</Text>
            </Pressable>
          </View>
          {selectedCluster.events.slice(0, 3).map((event) => {
            const category = getCategoryById(event.categoryId);
            return (
              <Pressable
                key={event.id}
                style={styles.clusterEventItem}
                onPress={() => {
                  setSelectedCluster(null);
                  onEventPress?.(event);
                }}
              >
                <Text style={styles.clusterEventIcon}>{category?.icon ?? '📍'}</Text>
                <Text style={styles.clusterEventTitle} numberOfLines={1}>
                  {event.title}
                </Text>
              </Pressable>
            );
          })}
          {selectedCluster.events.length > 3 && (
            <Text style={styles.clusterMore}>
              +{selectedCluster.events.length - 3} ещё
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

// ============================================================================
// Clustering Logic
// ============================================================================

function clusterEvents(
  events: Event[],
  zoomLevel: number
): { markers: MapMarker[]; clusters: Cluster[] } {
  const clusterRadius = zoomLevel * 0.5; // Adjust based on zoom
  const markers: MapMarker[] = [];
  const clusters: Cluster[] = [];
  const processed = new Set<string>();

  for (const event of events) {
    if (processed.has(event.id)) continue;

    // Find nearby events
    const nearby = events.filter(
      (e) =>
        !processed.has(e.id) &&
        Math.abs(e.location.latitude - event.location.latitude) < clusterRadius &&
        Math.abs(e.location.longitude - event.location.longitude) < clusterRadius
    );

    if (nearby.length > 2) {
      // Create cluster
      const centerLat = nearby.reduce((sum, e) => sum + e.location.latitude, 0) / nearby.length;
      const centerLon = nearby.reduce((sum, e) => sum + e.location.longitude, 0) / nearby.length;

      clusters.push({
        id: `cluster-${event.id}`,
        location: { latitude: centerLat, longitude: centerLon },
        events: nearby,
        count: nearby.length,
      });

      nearby.forEach((e) => processed.add(e.id));
    } else {
      // Single marker
      markers.push({
        id: event.id,
        location: event.location,
        event,
      });
      processed.add(event.id);
    }
  }

  return { markers, clusters };
}

// ============================================================================
// Styles
// ============================================================================

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.divider,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EEF4',
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholderText: {
    fontSize: 14,
    color: THEME_COLORS.textMuted,
    textAlign: 'center',
  },
  markerDot: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -20,
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerIcon: {
    fontSize: 20,
  },
  clusterDot: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -24,
    marginTop: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  clusterText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userLocation: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME_COLORS.info,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginLeft: -8,
    marginTop: -8,
    shadowColor: THEME_COLORS.info,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  controls: {
    position: 'absolute',
    top: 16,
    right: 16,
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
    elevation: 2,
  },
  locationButton: {
    marginTop: 8,
  },
  controlIcon: {
    fontSize: 24,
    color: THEME_COLORS.text,
    fontWeight: '300',
  },
  selectedCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  eventCardBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCardIcon: {
    fontSize: 24,
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
  eventCardSubtitle: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  eventCardArrow: {
    fontSize: 24,
    color: THEME_COLORS.textMuted,
  },
  clusterPopup: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  clusterPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clusterPopupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  clusterPopupClose: {
    fontSize: 18,
    color: THEME_COLORS.textMuted,
    padding: 4,
  },
  clusterEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  clusterEventIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  clusterEventTitle: {
    flex: 1,
    fontSize: 14,
    color: THEME_COLORS.text,
  },
  clusterMore: {
    fontSize: 13,
    color: THEME_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
