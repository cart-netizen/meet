/**
 * Event Participants Screen
 * Shows list of participants who joined the event
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Badge, Button } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import { selectProfile, useAuthStore } from '@/stores';
import { getEventById, getEventParticipants } from '@/services/supabase/events.service';
import type { Event, EventParticipant } from '@/types';

// ============================================================================
// Component
// ============================================================================

export default function ParticipantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore(selectProfile);

  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isOrganizer = event?.organizerId === profile?.id;

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      const [eventResult, participantsResult] = await Promise.all([
        getEventById(id),
        getEventParticipants(id),
      ]);

      if (eventResult.event) {
        setEvent(eventResult.event);
      }
      if (participantsResult.participants) {
        setParticipants(participantsResult.participants);
      }
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Navigate to user profile
  const handleUserPress = useCallback((userId: string) => {
    router.push(`/profile/${userId}`);
  }, []);

  // Start chat with participant (organizer only)
  const handleStartChat = useCallback((userId: string) => {
    router.push(`/chat/dm/${userId}`);
  }, []);

  // Render participant item
  const renderParticipant = useCallback(
    ({ item }: { item: EventParticipant }) => (
      <Pressable
        style={styles.participantItem}
        onPress={() => handleUserPress(item.userId)}
      >
        <Avatar
          source={item.user?.avatarUrl ? { uri: item.user.avatarUrl } : null}
          name={item.user?.displayName}
          size="lg"
        />
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>
            {item.user?.displayName ?? 'Участник'}
          </Text>
          <View style={styles.participantMeta}>
            {item.user?.rating && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingStar}>★</Text>
                <Text style={styles.ratingText}>
                  {item.user.rating.toFixed(1)}
                </Text>
              </View>
            )}
            {item.status === 'pending' && (
              <Badge variant="warning" size="sm">
                Ожидает
              </Badge>
            )}
            {item.status === 'approved' && (
              <Badge variant="success" size="sm">
                Подтверждён
              </Badge>
            )}
          </View>
        </View>
        {isOrganizer && item.userId !== profile?.id && (
          <Pressable
            style={styles.chatButton}
            onPress={() => handleStartChat(item.userId)}
          >
            <Text style={styles.chatIcon}>💬</Text>
          </Pressable>
        )}
        <Text style={styles.arrowIcon}>›</Text>
      </Pressable>
    ),
    [handleUserPress, handleStartChat, isOrganizer, profile?.id]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Участники</Text>
          <Text style={styles.headerSubtitle}>
            {participants.length} из {event?.maxParticipants ?? '∞'}
          </Text>
        </View>
      </View>

      {/* Participants List */}
      <FlatList
        data={participants}
        renderItem={renderParticipant}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>Пока нет участников</Text>
            <Text style={styles.emptyText}>
              Будьте первым, кто запишется на эту встречу
            </Text>
          </View>
        }
      />
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: THEME_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: THEME_COLORS.text,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  listContent: {
    flexGrow: 1,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: THEME_COLORS.surface,
  },
  participantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  participantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingStar: {
    fontSize: 14,
    color: '#FFB800',
  },
  ratingText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  chatButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chatIcon: {
    fontSize: 20,
  },
  arrowIcon: {
    fontSize: 20,
    color: THEME_COLORS.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: THEME_COLORS.divider,
    marginLeft: 76,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
