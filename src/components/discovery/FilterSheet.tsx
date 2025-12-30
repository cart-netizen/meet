/**
 * Filter Sheet Component
 * Bottom sheet for filtering events
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';

import { Button } from '@/components/ui';
import { SEARCH_CONFIG, THEME_COLORS } from '@/constants';
import type { EventFilters } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: EventFilters;
  onApply: (filters: Partial<EventFilters>) => void;
  onReset: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function FilterSheet({
  isOpen,
  onClose,
  filters,
  onApply,
  onReset,
}: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<Partial<EventFilters>>({});

  useEffect(() => {
    setLocalFilters({
      maxDistance: filters.maxDistance,
      hasAvailableSpots: filters.hasAvailableSpots,
      isFree: filters.isFree,
      sortBy: filters.sortBy,
    });
  }, [filters, isOpen]);

  const handleApply = () => {
    onApply(localFilters);
  };

  const handleReset = () => {
    setLocalFilters({
      maxDistance: SEARCH_CONFIG.defaultRadius,
      hasAvailableSpots: undefined,
      isFree: undefined,
      sortBy: 'date',
    });
    onReset();
  };

  const distanceValue = localFilters.maxDistance ?? SEARCH_CONFIG.defaultRadius;

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
            <Text style={styles.title}>Фильтры</Text>
            <Pressable onPress={handleReset}>
              <Text style={styles.resetButton}>Сбросить</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            {/* Distance */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Расстояние</Text>
              <View style={styles.distanceRow}>
                <Text style={styles.distanceValue}>{distanceValue} км</Text>
              </View>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>1 км</Text>
                <View style={styles.sliderWrapper}>
                  {/* Simple implementation without external slider */}
                  <View style={styles.sliderTrack}>
                    <View
                      style={[
                        styles.sliderFill,
                        {
                          width: `${(distanceValue / SEARCH_CONFIG.maxRadius) * 100}%`,
                        },
                      ]}
                    />
                    <Pressable
                      style={[
                        styles.sliderThumb,
                        {
                          left: `${(distanceValue / SEARCH_CONFIG.maxRadius) * 100}%`,
                        },
                      ]}
                      onPress={() => {
                        // Toggle between preset values
                        const presets = SEARCH_CONFIG.radiusOptions;
                        const currentIndex = presets.indexOf(distanceValue);
                        const nextIndex = (currentIndex + 1) % presets.length;
                        setLocalFilters({
                          ...localFilters,
                          maxDistance: presets[nextIndex],
                        });
                      }}
                    />
                  </View>
                </View>
                <Text style={styles.sliderLabel}>{SEARCH_CONFIG.maxRadius} км</Text>
              </View>

              {/* Distance Presets */}
              <View style={styles.presetContainer}>
                {SEARCH_CONFIG.radiusOptions.slice(0, 5).map((value) => (
                  <Pressable
                    key={value}
                    style={[
                      styles.presetChip,
                      distanceValue === value && styles.presetChipSelected,
                    ]}
                    onPress={() =>
                      setLocalFilters({ ...localFilters, maxDistance: value })
                    }
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        distanceValue === value && styles.presetChipTextSelected,
                      ]}
                    >
                      {value} км
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Параметры</Text>

              <Pressable
                style={styles.optionRow}
                onPress={() =>
                  setLocalFilters({
                    ...localFilters,
                    hasAvailableSpots: !localFilters.hasAvailableSpots,
                  })
                }
              >
                <Text style={styles.optionText}>Только со свободными местами</Text>
                <View
                  style={[
                    styles.checkbox,
                    localFilters.hasAvailableSpots && styles.checkboxChecked,
                  ]}
                >
                  {localFilters.hasAvailableSpots && (
                    <Text style={styles.checkboxIcon}>✓</Text>
                  )}
                </View>
              </Pressable>

              <Pressable
                style={styles.optionRow}
                onPress={() =>
                  setLocalFilters({
                    ...localFilters,
                    isFree: !localFilters.isFree,
                  })
                }
              >
                <Text style={styles.optionText}>Только бесплатные</Text>
                <View
                  style={[
                    styles.checkbox,
                    localFilters.isFree && styles.checkboxChecked,
                  ]}
                >
                  {localFilters.isFree && (
                    <Text style={styles.checkboxIcon}>✓</Text>
                  )}
                </View>
              </Pressable>
            </View>

            {/* Sorting */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Сортировка</Text>
              <View style={styles.sortOptions}>
                {[
                  { value: 'date', label: 'По дате' },
                  { value: 'distance', label: 'По расстоянию' },
                  { value: 'popularity', label: 'По популярности' },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.sortOption,
                      localFilters.sortBy === option.value &&
                        styles.sortOptionSelected,
                    ]}
                    onPress={() =>
                      setLocalFilters({
                        ...localFilters,
                        sortBy: option.value as 'date' | 'distance' | 'popularity',
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        localFilters.sortBy === option.value &&
                          styles.sortOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button variant="outline" onPress={onClose} style={styles.cancelButton}>
              Отмена
            </Button>
            <Button onPress={handleApply} style={styles.applyButton}>
              Применить
            </Button>
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
  resetButton: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 16,
  },
  distanceRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  distanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.primary,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderWrapper: {
    flex: 1,
    marginHorizontal: 12,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: THEME_COLORS.divider,
    borderRadius: 2,
  },
  sliderFill: {
    height: 4,
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 20,
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 10,
    marginLeft: -10,
  },
  sliderLabel: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    width: 40,
    textAlign: 'center',
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  presetChipSelected: {
    backgroundColor: `${THEME_COLORS.primary}15`,
    borderColor: THEME_COLORS.primary,
  },
  presetChipText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    fontWeight: '500',
  },
  presetChipTextSelected: {
    color: THEME_COLORS.primary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: THEME_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: THEME_COLORS.primary,
    borderColor: THEME_COLORS.primary,
  },
  checkboxIcon: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  sortOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: THEME_COLORS.background,
    alignItems: 'center',
  },
  sortOptionSelected: {
    backgroundColor: `${THEME_COLORS.primary}15`,
  },
  sortOptionText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    fontWeight: '500',
  },
  sortOptionTextSelected: {
    color: THEME_COLORS.primary,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
  },
  cancelButton: {
    flex: 1,
  },
  applyButton: {
    flex: 1,
  },
});
