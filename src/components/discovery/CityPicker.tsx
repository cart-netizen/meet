/**
 * City Picker Component
 * Bottom sheet for selecting city
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  const [tempSelectedCity, setTempSelectedCity] = useState<City | null>(selectedCity);

  // Reset temp selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempSelectedCity(selectedCity);
      setSearchQuery('');
    }
  }, [isOpen, selectedCity]);

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) {
      return RUSSIAN_CITIES;
    }
    const query = searchQuery.toLowerCase().trim();
    return RUSSIAN_CITIES.filter((city) =>
      city.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleCityPress = (city: City) => {
    setTempSelectedCity(city);
  };

  const handleConfirm = () => {
    if (tempSelectedCity) {
      onSelect(tempSelectedCity);
    }
    onClose();
    setSearchQuery('');
  };

  const handleClose = () => {
    onClose();
    setSearchQuery('');
  };

  const renderCity = ({ item }: { item: City }) => {
    const isSelected = tempSelectedCity?.id === item.id;
    return (
      <Pressable
        style={[styles.cityRow, isSelected && styles.cityRowSelected]}
        onPress={() => handleCityPress(item)}
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

  const hasChanged = tempSelectedCity?.id !== selectedCity?.id;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Выберите город</Text>
            <Pressable onPress={handleClose}>
              <Text style={styles.closeButton}>Отмена</Text>
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

          {/* Footer with Confirm Button */}
          <View style={styles.footer}>
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedLabel}>Выбрано:</Text>
              <Text style={styles.selectedCity}>
                {tempSelectedCity?.name ?? 'Не выбран'}
              </Text>
            </View>
            <Pressable
              style={[
                styles.confirmButton,
                !tempSelectedCity && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!tempSelectedCity}
            >
              <Text style={styles.confirmButtonText}>
                {hasChanged ? 'Подтвердить' : 'Готово'}
              </Text>
            </Pressable>
          </View>
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
    minHeight: 400,
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
    color: THEME_COLORS.textSecondary,
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
    paddingBottom: 8,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
    backgroundColor: THEME_COLORS.surface,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    marginBottom: 2,
  },
  selectedCity: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  confirmButton: {
    backgroundColor: THEME_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: THEME_COLORS.border,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
