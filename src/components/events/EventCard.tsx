/**
 * Event Card Component
 * Displays event information in a card format
 */

import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Avatar, Badge } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import { useCategoriesStore } from '@/stores';
import type { Event, GeoPoint } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface EventCardProps {
  event: Event;
  userLocation?: GeoPoint;
  onPress?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const EventCard = memo(function EventCard({
  event,
  userLocation,
  onPress,
}: EventCardProps) {
  const getCategoryById = useCategoriesStore((state) => state.getCategoryById);
  const category = event.category ?? getCategoryById(event.categoryId);
  const spotsLeft =
    event.maxParticipants !== null
      ? event.maxParticipants - event.currentParticipants
      : null;

  const distance = userLocation
    ? calculateDistance(userLocation, event.location)
    : null;

  const formattedDate = formatEventDate(event.startsAt);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {/* Category and Date */}
      <View style={styles.topRow}>
        {category && (
          <Badge
            variant="primary"
            size="sm"
            style={{
              backgroundColor: `${category.color}20`,
            }}
          >
            <Text style={{ color: category.color }}>
              {category.icon} {category.name}
            </Text>
          </Badge>
        )}
        <Text style={styles.date}>{formattedDate}</Text>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

      {/* Location */}
      <View style={styles.locationRow}>
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.locationText} numberOfLines={1}>
          {event.placeName ?? event.address}
        </Text>
        {distance !== null && (
          <Text style={styles.distance}>
            {distance < 1
              ? `${Math.round(distance * 1000)} м`
              : `${distance.toFixed(1)} км`}
          </Text>
        )}
      </View>

      {/* Organizer and Participants */}
      <View style={styles.bottomRow}>
        <View style={styles.organizerInfo}>
          <Avatar
            source={
              event.organizer?.avatarUrl
                ? { uri: event.organizer.avatarUrl }
                : null
            }
            name={event.organizer?.displayName}
            size="sm"
          />
          <View style={styles.organizerDetails}>
            <Text style={styles.organizerName} numberOfLines={1}>
              {event.organizer?.displayName ?? 'Организатор'}
            </Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingStar}>⭐</Text>
              <Text style={styles.ratingText}>
                {event.organizer?.rating?.toFixed(1) ?? '5.0'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.participantsInfo}>
          <Text style={styles.participantsIcon}>👥</Text>
          <Text style={styles.participantsText}>
            {event.currentParticipants}
            {event.maxParticipants && `/${event.maxParticipants}`}
          </Text>
          {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0 && (
            <Text style={styles.spotsLeft}>(осталось {spotsLeft})</Text>
          )}
          {spotsLeft === 0 && (
            <Badge variant="warning" size="sm">
              Мест нет
            </Badge>
          )}
        </View>
      </View>

      {/* Entry Fee Badge */}
      {event.entryFee > 0 && (
        <View style={styles.feeBadge}>
          <Text style={styles.feeText}>{event.entryFee} ₽</Text>
        </View>
      )}

      {/* Requires Approval Badge */}
      {event.requiresApproval && (
        <View style={styles.approvalBadge}>
          <Text style={styles.approvalText}>🔒 Модерация</Text>
        </View>
      )}
    </Pressable>
  );
});

// ============================================================================
// Helpers
// ============================================================================

function formatEventDate(date: Date): string {
  if (isToday(date)) {
    return `Сегодня, ${format(date, 'HH:mm')}`;
  }
  if (isTomorrow(date)) {
    return `Завтра, ${format(date, 'HH:mm')}`;
  }
  return format(date, 'd MMM, HH:mm', { locale: ru });
}

function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  date: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  distance: {
    fontSize: 13,
    color: THEME_COLORS.textMuted,
    marginLeft: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  organizerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  organizerDetails: {
    marginLeft: 10,
    flex: 1,
  },
  organizerName: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME_COLORS.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    fontSize: 12,
    marginRight: 2,
  },
  ratingText: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  participantsText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    fontWeight: '500',
  },
  spotsLeft: {
    fontSize: 12,
    color: THEME_COLORS.warning,
    marginLeft: 4,
  },
  feeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: `${THEME_COLORS.secondary}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  feeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME_COLORS.secondary,
  },
  approvalBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  approvalText: {
    fontSize: 11,
    color: THEME_COLORS.textMuted,
  },
});
