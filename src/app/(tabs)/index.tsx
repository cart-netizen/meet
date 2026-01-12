/**
 * Discovery Screen
 * Main screen for discovering events nearby
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui';
import { EventCard } from '@/components/events/EventCard';
import { FilterSheet } from '@/components/discovery/FilterSheet';
import { SEARCH_CONFIG, THEME_COLORS } from '@/constants';
import {
  selectCategories,
  selectDiscoveryEvents,
  selectDiscoveryFilters,
  selectEffectiveCity,
  selectEffectiveLocation,
  selectHasMoreEvents,
  selectIsLoadingDiscovery,
  useCategoriesStore,
  useEventsStore,
  useLocationStore,
} from '@/stores';
import type { Event, EventFilters } from '@/types';

// ============================================================================
// Component
// ============================================================================

export default function DiscoveryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Store selectors
  const events = useEventsStore(selectDiscoveryEvents);
  const filters = useEventsStore(selectDiscoveryFilters);
  const isLoading = useEventsStore(selectIsLoadingDiscovery);
  const hasMore = useEventsStore(selectHasMoreEvents);
  const fetchEvents = useEventsStore((state) => state.fetchDiscoveryEvents);
  const loadMore = useEventsStore((state) => state.loadMoreDiscoveryEvents);
  const setFilters = useEventsStore((state) => state.setDiscoveryFilters);
  const resetFilters = useEventsStore((state) => state.resetDiscoveryFilters);

  const location = useLocationStore(selectEffectiveLocation);
  const city = useLocationStore(selectEffectiveCity);
  const getCurrentLocation = useLocationStore((state) => state.getCurrentLocation);
  const categories = useCategoriesStore(selectCategories);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      await getCurrentLocation();
      await fetchEvents(location ?? undefined, true);
    };
    init();
  }, []);

  // Refetch on filter change
  useEffect(() => {
    fetchEvents(location ?? undefined, true);
  }, [filters]);

  const handleRefresh = useCallback(async () => {
    await fetchEvents(location ?? undefined, true);
  }, [location, fetchEvents]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMore(location ?? undefined);
    }
  }, [hasMore, isLoading, location, loadMore]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      // Debounced search
      const timeout = setTimeout(() => {
        setFilters({ search: query || undefined });
      }, 300);
      return () => clearTimeout(timeout);
    },
    [setFilters]
  );

  const handleCategoryPress = useCallback(
    (categoryId: string | null) => {
      setFilters({
        categoryId: filters.categoryId === categoryId ? undefined : categoryId ?? undefined,
      });
    },
    [filters.categoryId, setFilters]
  );

  const handleEventPress = useCallback((event: Event) => {
    router.push(`/event/${event.id}`);
  }, []);

  const renderEvent = useCallback(
    ({ item }: { item: Event }) => (
      <EventCard event={item} onPress={() => handleEventPress(item)} />
    ),
    [handleEventPress]
  );

  const activeFiltersCount =
    (filters.categoryId ? 1 : 0) +
    (filters.maxDistance !== SEARCH_CONFIG.defaultRadius ? 1 : 0) +
    (filters.isFree ? 1 : 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.locationRow}>
          <Text style={styles.locationLabel}>Встречи в</Text>
          <Pressable style={styles.locationButton}>
            <Text style={styles.locationText}>{city?.name ?? 'Москва'}</Text>
            <Text style={styles.locationArrow}>▼</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Поиск встреч..."
              placeholderTextColor={THEME_COLORS.textMuted}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => handleSearch('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            style={styles.filterButton}
            onPress={() => setIsFilterOpen(true)}
          >
            <Text style={styles.filterIcon}>⚙️</Text>
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Categories horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          <Pressable
            style={[
              styles.categoryChip,
              !filters.categoryId && styles.categoryChipSelected,
            ]}
            onPress={() => handleCategoryPress(null)}
          >
            <Text
              style={[
                styles.categoryChipText,
                !filters.categoryId && styles.categoryChipTextSelected,
              ]}
            >
              Все
            </Text>
          </Pressable>
          {categories.map((category) => {
            const isSelected = filters.categoryId === category.id;
            return (
              <Pressable
                key={category.id}
                style={[
                  styles.categoryChip,
                  isSelected && {
                    backgroundColor: `${category.color}20`,
                    borderColor: category.color,
                  },
                ]}
                onPress={() => handleCategoryPress(category.id)}
              >
                <Text style={styles.categoryChipIcon}>{category.icon}</Text>
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && { color: category.color },
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewModeContainer}>
        <Pressable
          style={[
            styles.viewModeButton,
            viewMode === 'list' && styles.viewModeButtonActive,
          ]}
          onPress={() => setViewMode('list')}
        >
          <Text
            style={[
              styles.viewModeText,
              viewMode === 'list' && styles.viewModeTextActive,
            ]}
          >
            Список
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.viewModeButton,
            viewMode === 'map' && styles.viewModeButtonActive,
          ]}
          onPress={() => setViewMode('map')}
        >
          <Text
            style={[
              styles.viewModeText,
              viewMode === 'map' && styles.viewModeTextActive,
            ]}
          >
            Карта
          </Text>
        </Pressable>
      </View>

      {/* Events List */}
      {viewMode === 'list' ? (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>Встречи не найдены</Text>
                <Text style={styles.emptyText}>
                  Попробуйте изменить фильтры или создайте свою встречу
                </Text>
                <Pressable
                  style={styles.createButton}
                  onPress={() => router.push('/event/create')}
                >
                  <Text style={styles.createButtonText}>Создать встречу</Text>
                </Pressable>
              </View>
            ) : null
          }
          ListFooterComponent={
            isLoading && events.length > 0 ? (
              <ActivityIndicator
                style={styles.loadingFooter}
                color={THEME_COLORS.primary}
              />
            ) : null
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          <Text style={styles.mapPlaceholder}>
            Карта будет доступна после интеграции Yandex Maps
          </Text>
        </View>
      )}

      {/* FAB for creating event */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/event/create')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      {/* Filter Sheet */}
      <FilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setIsFilterOpen(false);
        }}
        onReset={() => {
          resetFilters();
          setIsFilterOpen(false);
        }}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  locationArrow: {
    fontSize: 10,
    color: THEME_COLORS.textMuted,
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  clearIcon: {
    fontSize: 16,
    color: THEME_COLORS.textMuted,
    padding: 4,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  filterIcon: {
    fontSize: 20,
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  categoriesContainer: {
    paddingVertical: 4,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: `${THEME_COLORS.primary}15`,
    borderColor: THEME_COLORS.primary,
  },
  categoryChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME_COLORS.textSecondary,
  },
  categoryChipTextSelected: {
    color: THEME_COLORS.primary,
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: THEME_COLORS.divider,
    borderRadius: 8,
    margin: 16,
    marginBottom: 8,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: THEME_COLORS.surface,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME_COLORS.textMuted,
  },
  viewModeTextActive: {
    color: THEME_COLORS.text,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
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
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingFooter: {
    paddingVertical: 16,
  },
  mapContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLORS.divider,
  },
  mapPlaceholder: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
  },
});
