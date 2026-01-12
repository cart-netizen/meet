/**
 * City Picker Component
 * Bottom sheet for selecting city
 */

import React, { useState, useMemo } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RUSSIAN_CITIES, type City } from '@/constants/cities';
import { THEME_COLORS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

interface CityPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: City | null;
  onSelect: (city: City) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CityPicker({
  isOpen,
  onClose,
  selectedCity,
  onSelect,
}: CityPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) {
      return RUSSIAN_CITIES;
    }
    const query = searchQuery.toLowerCase().trim();
    return RUSSIAN_CITIES.filter((city) =>
      city.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelect = (city: City) => {
    onSelect(city);
    onClose();
    setSearchQuery('');
  };

  const renderCity = ({ item }: { item: City }) => {
    const isSelected = selectedCity?.id === item.id;
    return (
      <Pressable
        style={[styles.cityRow, isSelected && styles.cityRowSelected]}
        onPress={() => handleSelect(item)}
      >
        <View style={styles.cityInfo}>
          <Text style={[styles.cityName, isSelected && styles.cityNameSelected]}>
            {item.name}
          </Text>
          <Text style={styles.cityRegion}>{item.region}</Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Выберите город</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeButton}>Закрыть</Text>
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Поиск города..."
              placeholderTextColor={THEME_COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Cities List */}
          <FlatList
            data={filteredCities}
            renderItem={renderCity}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Город не найден</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: THEME_COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: THEME_COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  closeButton: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.background,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 12,
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  cityRowSelected: {
    backgroundColor: `${THEME_COLORS.primary}10`,
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME_COLORS.text,
    marginBottom: 2,
  },
  cityNameSelected: {
    color: THEME_COLORS.primary,
  },
  cityRegion: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  checkmark: {
    fontSize: 18,
    color: THEME_COLORS.primary,
    fontWeight: '600',
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
});
