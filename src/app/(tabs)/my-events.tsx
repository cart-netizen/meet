/**
 * My Events Screen
 * User's organized and participating events
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

import { EventCard } from '@/components/events/EventCard';
import { THEME_COLORS } from '@/constants';
import {
  selectIsLoadingDiscovery,
  selectMyOrganizedEvents,
  selectMyParticipatingEvents,
  useEventsStore,
} from '@/stores';
import type { Event } from '@/types';

// ============================================================================
// Component
// ============================================================================

export default function MyEventsScreen() {
  const [activeTab, setActiveTab] = useState<'participating' | 'organized'>('participating');

  const organizedEvents = useEventsStore(selectMyOrganizedEvents);
  const participatingEvents = useEventsStore(selectMyParticipatingEvents);
  const isLoading = useEventsStore((state) => state.isLoadingMyEvents);
  const fetchMyEvents = useEventsStore((state) => state.fetchMyEvents);

  const events = activeTab === 'organized' ? organizedEvents : participatingEvents;

  useEffect(() => {
    fetchMyEvents();
  }, [fetchMyEvents]);

  const handleRefresh = useCallback(() => {
    fetchMyEvents();
  }, [fetchMyEvents]);

  const handleEventPress = useCallback((event: Event) => {
    router.push(`/event/${event.id}`);
  }, []);

  const renderEvent = useCallback(
    ({ item }: { item: Event }) => (
      <EventCard event={item} onPress={() => handleEventPress(item)} />
    ),
    [handleEventPress]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Мои встречи</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'participating' && styles.tabActive]}
          onPress={() => setActiveTab('participating')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'participating' && styles.tabTextActive,
            ]}
          >
            Участвую ({participatingEvents.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'organized' && styles.tabActive]}
          onPress={() => setActiveTab('organized')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'organized' && styles.tabTextActive,
            ]}
          >
            Организую ({organizedEvents.length})
          </Text>
        </Pressable>
      </View>

      {/* Events List */}
      <FlatList
        data={events}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'organized' ? '📅' : '🎉'}
            </Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'organized'
                ? 'Вы ещё не организовали встреч'
                : 'Вы ещё не записались на встречи'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'organized'
                ? 'Создайте свою первую встречу и найдите единомышленников'
                : 'Найдите интересные встречи рядом с вами'}
            </Text>
            <Pressable
              style={styles.actionButton}
              onPress={() =>
                activeTab === 'organized'
                  ? router.push('/event/create')
                  : router.push('/(tabs)')
              }
            >
              <Text style={styles.actionButtonText}>
                {activeTab === 'organized' ? 'Создать встречу' : 'Найти встречи'}
              </Text>
            </Pressable>
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
  header: {
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME_COLORS.text,
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
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
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
  listContent: {
    padding: 16,
    flexGrow: 1,
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
