/**
 * Event Detail Screen
 * Full event information with actions
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Avatar, Badge, Button } from '@/components/ui';
import { EventMap } from '@/components/map';
import { THEME_COLORS } from '@/constants';
import { selectProfile, useAuthStore, useCategoriesStore, useEventsStore } from '@/stores';
import { getEventById, getEventParticipants, joinEvent, leaveEvent } from '@/services/supabase/events.service';
import { scheduleEventReminder, cancelEventNotifications } from '@/services/notifications/push.service';
import type { Event, Participant, Profile } from '@/types';

// ============================================================================
// Component
// ============================================================================

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore(selectProfile);
  const session = useAuthStore((state) => state.session);
  const getCategoryById = useCategoriesStore((state) => state.getCategoryById);

  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [organizer, setOrganizer] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Check participation status
  const myParticipation = participants.find((p) => p.userId === profile?.id);
  const isOrganizer = event?.organizerId === profile?.id;
  const isParticipating = !!myParticipation;
  const hasAvailableSpots =
    event && event.currentParticipants < event.maxParticipants;
  const canJoin = !isOrganizer && !isParticipating && hasAvailableSpots;

  // Fetch event data
  useEffect(() => {
    async function fetchEvent() {
      if (!id) return;

      setIsLoading(true);
      try {
        // Fetch event and participants in parallel
        const [eventResult, participantsResult] = await Promise.all([
          getEventById(id),
          getEventParticipants(id),
        ]);

        // Check for errors
        if (eventResult.error || !eventResult.event) {
          Alert.alert(
            'Ошибка',
            eventResult.error?.message ?? 'Встреча не найдена',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }

        setEvent(eventResult.event);
        // Use organizer from event data (fetched via join)
        if (eventResult.event.organizer) {
          setOrganizer({
            id: eventResult.event.organizer.id,
            displayName: eventResult.event.organizer.displayName,
            avatarUrl: eventResult.event.organizer.avatarUrl ?? null,
            rating: eventResult.event.organizer.rating,
            eventsOrganized: eventResult.event.organizer.eventsOrganized ?? 0,
          } as Profile);
        }

        if (participantsResult.participants) {
          setParticipants(participantsResult.participants);
        }
      } catch (error) {
        console.error('Failed to fetch event:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить информацию о встрече');
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvent();
  }, [id]);

  // Handle join event
  const handleJoin = useCallback(async () => {
    if (!event || !profile) return;

    // Check email verification (session exists only when email is verified)
    if (!session) {
      Alert.alert(
        'Подтвердите email',
        'Для записи на встречи необходимо подтвердить email. Проверьте почту и перейдите по ссылке в письме.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Войти',
            onPress: () => router.push('/(auth)/login'),
          },
        ]
      );
      return;
    }

    // Check subscription
    if (profile.subscriptionType === 'free') {
      Alert.alert(
        'Требуется подписка',
        'Для записи на встречи необходима подписка Участник или Организатор',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Оформить подписку',
            onPress: () => router.push('/subscription'),
          },
        ]
      );
      return;
    }

    setIsJoining(true);
    try {
      const result = await joinEvent(event.id);

      if (result.error) {
        Alert.alert('Ошибка', result.error.message);
        return;
      }

      // Schedule reminder
      await scheduleEventReminder(event.id, event.title, event.startsAt, 60);

      // Refresh event data
      const [eventResult, participantsResult] = await Promise.all([
        getEventById(event.id),
        getEventParticipants(event.id),
      ]);

      console.log('After join - participants:', participantsResult.participants?.length);

      if (eventResult.event) {
        setEvent(eventResult.event);
      }
      if (participantsResult.participants) {
        setParticipants(participantsResult.participants);
      }

      Alert.alert('Готово!', 'Вы записались на встречу');
    } catch (error) {
      console.error('Failed to join event:', error);
      Alert.alert('Ошибка', 'Не удалось записаться на встречу');
    } finally {
      setIsJoining(false);
    }
  }, [event, profile, session]);

  // Handle leave event
  const handleLeave = useCallback(async () => {
    if (!event) return;

    Alert.alert(
      'Отменить запись',
      'Вы уверены, что хотите отменить участие?',
      [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да, отменить',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            try {
              await leaveEvent(event.id);

              // Cancel scheduled notifications
              await cancelEventNotifications(event.id);

              // Refresh event data
              const [eventResult, participantsResult] = await Promise.all([
                getEventById(event.id),
                getEventParticipants(event.id),
              ]);
              if (eventResult.event) {
                setEvent(eventResult.event);
              }
              if (participantsResult.participants) {
                setParticipants(participantsResult.participants);
              }
            } catch (error) {
              console.error('Failed to leave event:', error);
              Alert.alert('Ошибка', 'Не удалось отменить запись');
            } finally {
              setIsLeaving(false);
            }
          },
        },
      ]
    );
  }, [event]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!event) return;

    try {
      await Share.share({
        title: event.title,
        message: `${event.title}\n\n${format(event.startsAt, "d MMMM в HH:mm", { locale: ru })}\n${event.address}\n\nПрисоединяйся!`,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  }, [event]);

  // Navigate to chat
  const handleOpenChat = useCallback(() => {
    if (!event) return;
    router.push(`/event/${event.id}/chat`);
  }, [event]);

  // Navigate to participants
  const handleViewParticipants = useCallback(() => {
    if (!event) return;
    router.push(`/event/${event.id}/participants`);
  }, [event]);

  if (isLoading || !event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const category = getCategoryById(event.categoryId);
  const isPastEvent = new Date(event.startsAt) < new Date();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton} onPress={handleShare}>
            <Text style={styles.headerIcon}>↗</Text>
          </Pressable>
          {isOrganizer && (
            <Pressable
              style={styles.headerButton}
              onPress={() => router.push(`/event/${event.id}/edit`)}
            >
              <Text style={styles.headerIcon}>✏️</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Category & Title */}
        <View style={styles.categoryRow}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: category?.color ?? THEME_COLORS.primary },
            ]}
          >
            <Text style={styles.categoryIcon}>{category?.icon ?? '📍'}</Text>
          </View>
          <Text style={styles.categoryName}>{category?.name ?? 'Встреча'}</Text>
        </View>

        <Text style={styles.title}>{event.title}</Text>

        {/* Status Badges */}
        <View style={styles.badges}>
          {isPastEvent && (
            <Badge variant="secondary" size="sm">
              Завершено
            </Badge>
          )}
          {isParticipating && !isPastEvent && (
            <Badge variant="success" size="sm">
              Вы участвуете
            </Badge>
          )}
          {isOrganizer && (
            <Badge variant="primary" size="sm">
              Организатор
            </Badge>
          )}
          {!hasAvailableSpots && !isPastEvent && (
            <Badge variant="warning" size="sm">
              Мест нет
            </Badge>
          )}
        </View>

        {/* Date & Time */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Дата и время</Text>
              <Text style={styles.infoValue}>
                {format(event.startsAt, "EEEE, d MMMM", { locale: ru })}
              </Text>
              <Text style={styles.infoSecondary}>
                {format(event.startsAt, "HH:mm", { locale: ru })} -{' '}
                {format(event.endsAt, "HH:mm", { locale: ru })}
              </Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Место проведения</Text>
              {event.placeName && (
                <Text style={styles.infoValue}>{event.placeName}</Text>
              )}
              <Text style={styles.infoSecondary}>{event.address}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <Pressable style={styles.infoRow} onPress={handleViewParticipants}>
            <Text style={styles.infoIcon}>👥</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Участники</Text>
              <Text style={styles.infoValue}>
                {participants.length}
              </Text>
            </View>
            <Text style={styles.infoArrow}>›</Text>
          </Pressable>
        </View>

        {/* Location Map */}
        {event.location && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>На карте</Text>
            <EventMap
              height={200}
              markers={[
                {
                  id: event.id,
                  location: event.location,
                  title: event.placeName ?? event.title,
                  description: event.address,
                },
              ]}
              initialRegion={{
                ...event.location,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            />
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Описание</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        {/* Organizer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Организатор</Text>
          <Pressable
            style={styles.organizerCard}
            onPress={() => router.push(`/profile/${organizer?.id}`)}
          >
            <Avatar
              source={organizer?.avatarUrl ? { uri: organizer.avatarUrl } : null}
              name={organizer?.displayName}
              size="lg"
            />
            <View style={styles.organizerInfo}>
              <Text style={styles.organizerName}>{organizer?.displayName}</Text>
              <View style={styles.organizerStats}>
                <Text style={styles.organizerStat}>
                  ⭐ {organizer?.rating?.toFixed(1) ?? '5.0'}
                </Text>
                <Text style={styles.organizerStatDot}>•</Text>
                <Text style={styles.organizerStat}>
                  {organizer?.eventsOrganized ?? 0} встреч
                </Text>
              </View>
            </View>
            <Text style={styles.organizerArrow}>›</Text>
          </Pressable>
        </View>

        {/* Participants Preview */}
        {participants.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Участники</Text>
              <Pressable onPress={handleViewParticipants}>
                <Text style={styles.sectionLink}>Все →</Text>
              </Pressable>
            </View>
            <View style={styles.participantsPreview}>
              {participants.slice(0, 5).map((participant, index) => (
                <View
                  key={participant.id}
                  style={[
                    styles.participantAvatar,
                    { marginLeft: index > 0 ? -12 : 0 },
                  ]}
                >
                  <Avatar
                    source={
                      participant.user?.avatarUrl
                        ? { uri: participant.user.avatarUrl }
                        : null
                    }
                    name={participant.user?.displayName}
                    size="md"
                  />
                </View>
              ))}
              {participants.length > 5 && (
                <View style={[styles.participantAvatar, { marginLeft: -12 }]}>
                  <View style={styles.moreParticipants}>
                    <Text style={styles.moreParticipantsText}>
                      +{participants.length - 5}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Price */}
        {event.entryFee > 0 && (
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Стоимость участия</Text>
            <Text style={styles.priceValue}>{event.entryFee} ₽</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      {!isPastEvent && (
        <View style={styles.bottomBar}>
          {event.allowChat && (isParticipating || isOrganizer) && (
            <Pressable style={styles.chatButton} onPress={handleOpenChat}>
              <Text style={styles.chatIcon}>💬</Text>
            </Pressable>
          )}

          {canJoin && (
            <Button
              onPress={handleJoin}
              loading={isJoining}
              style={styles.actionButton}
            >
              Записаться
            </Button>
          )}

          {isParticipating && !isOrganizer && (
            <Button
              variant="outline"
              onPress={handleLeave}
              loading={isLeaving}
              style={styles.actionButton}
            >
              Отменить запись
            </Button>
          )}

          {isOrganizer && (
            <Button
              onPress={() => router.push(`/event/${event.id}/manage`)}
              style={styles.actionButton}
            >
              Управление
            </Button>
          )}
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: THEME_COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 20,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME_COLORS.textSecondary,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.text,
    lineHeight: 32,
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 20,
    width: 32,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  infoSecondary: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  infoArrow: {
    fontSize: 20,
    color: THEME_COLORS.textMuted,
    marginLeft: 8,
  },
  infoDivider: {
    height: 1,
    backgroundColor: THEME_COLORS.divider,
    marginVertical: 16,
    marginLeft: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    fontWeight: '500',
  },
  description: {
    fontSize: 15,
    color: THEME_COLORS.textSecondary,
    lineHeight: 22,
  },
  organizerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
  },
  organizerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  organizerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizerStat: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  organizerStatDot: {
    marginHorizontal: 6,
    color: THEME_COLORS.textMuted,
  },
  organizerArrow: {
    fontSize: 20,
    color: THEME_COLORS.textMuted,
  },
  participantsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    borderWidth: 2,
    borderColor: THEME_COLORS.background,
    borderRadius: 22,
  },
  moreParticipants: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreParticipantsText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME_COLORS.textSecondary,
  },
  priceCard: {
    backgroundColor: `${THEME_COLORS.primary}15`,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME_COLORS.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
    gap: 12,
  },
  chatButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  chatIcon: {
    fontSize: 24,
  },
  actionButton: {
    flex: 1,
  },
});
