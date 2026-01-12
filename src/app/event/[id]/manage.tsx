/**
 * Event Management Screen
 * For organizers to manage participants and mark attendance
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Avatar, Badge, Button } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import { supabase } from '@/services/supabase/client';
import { getEventById, getEventParticipants } from '@/services/supabase/events.service';
import type { Event, EventParticipant } from '@/types';

// ============================================================================
// Types
// ============================================================================

type ParticipantStatus = 'pending' | 'approved' | 'declined' | 'cancelled' | 'attended' | 'no_show';

// ============================================================================
// Component
// ============================================================================

export default function EventManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');

  // Fetch event data
  useEffect(() => {
    async function loadEvent() {
      if (!id) return;

      setIsLoading(true);
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
        console.error('Failed to load event:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadEvent();
  }, [id]);

  // Filter participants
  const filteredParticipants =
    activeTab === 'pending'
      ? participants.filter((p) => p.status === 'pending')
      : participants;

  const pendingCount = participants.filter((p) => p.status === 'pending').length;

  // Update participant status
  const updateParticipantStatus = useCallback(
    async (participantId: string, status: ParticipantStatus) => {
      try {
        const { error } = await supabase
          .from('event_participants')
          .update({ status })
          .eq('id', participantId);

        if (error) throw error;

        // Update local state
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === participantId ? { ...p, status: status as EventParticipant['status'] } : p
          )
        );

        // Update event participant count if needed
        if (status === 'approved' || status === 'cancelled') {
          const eventResult = await getEventById(id!);
          if (eventResult.event) {
            setEvent(eventResult.event);
          }
        }
      } catch (error) {
        console.error('Failed to update participant:', error);
        Alert.alert('Ошибка', 'Не удалось обновить статус участника');
      }
    },
    [id]
  );

  // Approve participant
  const handleApprove = useCallback(
    (participant: EventParticipant) => {
      Alert.alert(
        'Подтвердить участие',
        `Подтвердить участие ${participant.user?.displayName}?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Подтвердить',
            onPress: () => updateParticipantStatus(participant.id, 'approved'),
          },
        ]
      );
    },
    [updateParticipantStatus]
  );

  // Reject participant
  const handleReject = useCallback(
    (participant: EventParticipant) => {
      Alert.alert(
        'Отклонить заявку',
        `Отклонить заявку ${participant.user?.displayName}?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Отклонить',
            style: 'destructive',
            onPress: () => updateParticipantStatus(participant.id, 'cancelled'),
          },
        ]
      );
    },
    [updateParticipantStatus]
  );

  // Mark attendance
  const handleMarkAttendance = useCallback(
    (participant: EventParticipant, attended: boolean) => {
      updateParticipantStatus(
        participant.id,
        attended ? 'attended' : 'no_show'
      );
    },
    [updateParticipantStatus]
  );

  // Check if event has started
  const eventHasStarted = event && new Date(event.startsAt) < new Date();
  const eventHasEnded = event && new Date(event.endsAt) < new Date();

  // Render participant item
  const renderParticipant = useCallback(
    ({ item }: { item: EventParticipant }) => {
      const statusBadge = getStatusBadge(item.status);

      return (
        <View style={styles.participantCard}>
          <Pressable
            style={styles.participantInfo}
            onPress={() => router.push(`/profile/${item.userId}`)}
          >
            <Avatar
              source={
                item.user?.avatarUrl ? { uri: item.user.avatarUrl } : null
              }
              name={item.user?.displayName}
              size="lg"
            />
            <View style={styles.participantDetails}>
              <Text style={styles.participantName}>
                {item.user?.displayName}
              </Text>
              <Text style={styles.participantJoined}>
                Записался {format(new Date(item.joinedAt), "d MMM в HH:mm", { locale: ru })}
              </Text>
            </View>
            {statusBadge && (
              <Badge variant={statusBadge.variant} size="sm">
                {statusBadge.label}
              </Badge>
            )}
          </Pressable>

          {/* Actions based on status and event state */}
          <View style={styles.participantActions}>
            {item.status === 'pending' && (
              <>
                <Pressable
                  style={[styles.actionButton, styles.actionButtonApprove]}
                  onPress={() => handleApprove(item)}
                >
                  <Text style={styles.actionButtonText}>✓</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.actionButtonReject]}
                  onPress={() => handleReject(item)}
                >
                  <Text style={styles.actionButtonText}>✗</Text>
                </Pressable>
              </>
            )}

            {item.status === 'approved' && eventHasStarted && !eventHasEnded && (
              <>
                <Pressable
                  style={[styles.actionButton, styles.actionButtonAttended]}
                  onPress={() => handleMarkAttendance(item, true)}
                >
                  <Text style={styles.actionButtonText}>✓ Пришёл</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.actionButtonNoShow]}
                  onPress={() => handleMarkAttendance(item, false)}
                >
                  <Text style={styles.actionButtonText}>✗ Не пришёл</Text>
                </Pressable>
              </>
            )}

            {item.status === 'approved' && eventHasEnded && (
              <Pressable
                style={[styles.actionButton, styles.actionButtonNoShow]}
                onPress={() => handleMarkAttendance(item, false)}
              >
                <Text style={styles.actionButtonText}>Отметить неявку</Text>
              </Pressable>
            )}
          </View>
        </View>
      );
    },
    [handleApprove, handleReject, handleMarkAttendance, eventHasStarted, eventHasEnded]
  );

  if (isLoading || !event) {
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            Управление
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {event.title}
          </Text>
        </View>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.push(`/event/${id}/edit`)}
        >
          <Text style={styles.headerIcon}>✏️</Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{event.currentParticipants}</Text>
          <Text style={styles.statLabel}>записано</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {participants.filter((p) => p.status === 'attended').length}
          </Text>
          <Text style={styles.statLabel}>пришли</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {participants.filter((p) => p.status === 'no_show').length}
          </Text>
          <Text style={styles.statLabel}>неявка</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'all' && styles.tabTextActive,
            ]}
          >
            Все ({participants.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'pending' && styles.tabTextActive,
            ]}
          >
            Ожидают ({pendingCount})
          </Text>
          {pendingCount > 0 && <View style={styles.tabBadge} />}
        </Pressable>
      </View>

      {/* Participants List */}
      <FlatList
        data={filteredParticipants}
        renderItem={renderParticipant}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'Нет заявок' : 'Нет участников'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'pending'
                ? 'Все заявки обработаны'
                : 'Пока никто не записался'}
            </Text>
          </View>
        }
      />

      {/* Bottom Actions */}
      {eventHasEnded && (
        <View style={styles.bottomBar}>
          <Button
            variant="outline"
            onPress={() => {
              const noShowParticipants = participants.filter(
                (p) => p.status === 'approved'
              );
              if (noShowParticipants.length === 0) {
                Alert.alert('Готово', 'Все участники отмечены');
                return;
              }
              Alert.alert(
                'Отметить неявку',
                `Отметить неявку для ${noShowParticipants.length} участников, которые не были отмечены как "пришёл"?`,
                [
                  { text: 'Отмена', style: 'cancel' },
                  {
                    text: 'Отметить',
                    onPress: async () => {
                      for (const p of noShowParticipants) {
                        await updateParticipantStatus(p.id, 'no_show');
                      }
                    },
                  },
                ]
              );
            }}
            style={styles.bottomButton}
          >
            Отметить все неявки
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusBadge(
  status: string
): { variant: 'primary' | 'success' | 'warning' | 'error' | 'secondary' | 'outline'; label: string } | null {
  switch (status) {
    case 'pending':
      return { variant: 'warning', label: 'Ожидает' };
    case 'approved':
      return { variant: 'success', label: 'Подтверждён' };
    case 'declined':
      return { variant: 'error', label: 'Отклонён' };
    case 'cancelled':
      return { variant: 'secondary', label: 'Отменён' };
    case 'attended':
      return { variant: 'primary', label: 'Присутствовал' };
    case 'no_show':
      return { variant: 'error', label: 'Неявка' };
    default:
      return null;
  }
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
    paddingVertical: 8,
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
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLORS.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: THEME_COLORS.divider,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabActive: {
    borderBottomColor: THEME_COLORS.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME_COLORS.textSecondary,
  },
  tabTextActive: {
    color: THEME_COLORS.primary,
    fontWeight: '600',
  },
  tabBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME_COLORS.error,
  },
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: 1,
    backgroundColor: THEME_COLORS.divider,
  },
  participantCard: {
    backgroundColor: THEME_COLORS.surface,
    padding: 16,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantDetails: {
    flex: 1,
    marginLeft: 12,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  participantJoined: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  participantActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingLeft: 68,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonApprove: {
    backgroundColor: `${THEME_COLORS.success}15`,
  },
  actionButtonReject: {
    backgroundColor: `${THEME_COLORS.error}15`,
  },
  actionButtonAttended: {
    backgroundColor: `${THEME_COLORS.primary}15`,
  },
  actionButtonNoShow: {
    backgroundColor: `${THEME_COLORS.warning}15`,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
  },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
  },
  bottomButton: {
    width: '100%',
  },
});
