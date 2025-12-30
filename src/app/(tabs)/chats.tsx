/**
 * Chats Screen
 * List of event chats
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
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Avatar } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import {
  selectMyParticipatingEvents,
  selectMyOrganizedEvents,
  useEventsStore,
} from '@/stores';
import type { Event } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface ChatItem extends Event {
  lastMessageAt?: Date;
  unreadCount?: number;
}

// ============================================================================
// Component
// ============================================================================

export default function ChatsScreen() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const participatingEvents = useEventsStore(selectMyParticipatingEvents);
  const organizedEvents = useEventsStore(selectMyOrganizedEvents);
  const fetchMyEvents = useEventsStore((state) => state.fetchMyEvents);

  // Combine and filter events with chat enabled
  const chats: ChatItem[] = [
    ...participatingEvents,
    ...organizedEvents,
  ]
    .filter((event) => event.allowChat)
    .filter((event, index, self) => self.findIndex((e) => e.id === event.id) === index)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  useEffect(() => {
    fetchMyEvents();
  }, [fetchMyEvents]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMyEvents();
    setIsRefreshing(false);
  }, [fetchMyEvents]);

  const handleChatPress = useCallback((event: Event) => {
    router.push(`/event/${event.id}/chat`);
  }, []);

  const renderChat = useCallback(
    ({ item }: { item: ChatItem }) => (
      <Pressable style={styles.chatItem} onPress={() => handleChatPress(item)}>
        <View style={styles.chatAvatar}>
          {item.category?.icon ? (
            <Text style={styles.categoryIcon}>{item.category.icon}</Text>
          ) : (
            <Avatar name={item.title} size="lg" />
          )}
        </View>
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.chatTime}>
              {formatChatTime(item.lastMessageAt ?? item.startsAt)}
            </Text>
          </View>
          <View style={styles.chatFooter}>
            <Text style={styles.chatPreview} numberOfLines={1}>
              {formatEventDate(item.startsAt)} · {item.currentParticipants} участников
            </Text>
            {item.unreadCount && item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    ),
    [handleChatPress]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Чаты</Text>
      </View>

      {/* Chats List */}
      <FlatList
        data={chats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Пока нет чатов</Text>
            <Text style={styles.emptyText}>
              Чаты появятся, когда вы запишетесь на встречи с включённым чатом
            </Text>
            <Pressable
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)')}
            >
              <Text style={styles.actionButtonText}>Найти встречи</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatChatTime(date: Date): string {
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return 'Вчера';
  }
  return format(date, 'd MMM', { locale: ru });
}

function formatEventDate(date: Date): string {
  if (isToday(date)) {
    return `Сегодня в ${format(date, 'HH:mm')}`;
  }
  return format(date, 'd MMM в HH:mm', { locale: ru });
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
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME_COLORS.text,
  },
  listContent: {
    flexGrow: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: THEME_COLORS.surface,
  },
  chatAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryIcon: {
    fontSize: 28,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 13,
    color: THEME_COLORS.textMuted,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatPreview: {
    flex: 1,
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginRight: 8,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  separator: {
    height: 1,
    backgroundColor: THEME_COLORS.divider,
    marginLeft: 84,
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
    marginBottom: 24,
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
