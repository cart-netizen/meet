/**
 * Edit Interests Screen
 * Allows user to select their interests with subcategories
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { PROFILE_CONFIG, THEME_COLORS } from '@/constants';
import { selectCategories, selectProfile, useAuthStore, useCategoriesStore } from '@/stores';
import { updateInterests } from '@/services/supabase/profiles.service';

// ============================================================================
// Component
// ============================================================================

export default function InterestsScreen() {
  const profile = useAuthStore(selectProfile);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const categories = useCategoriesStore(selectCategories);

  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    profile?.interests ?? []
  );
  const [isSaving, setIsSaving] = useState(false);

  // Toggle interest selection (by ID)
  const handleToggleInterest = useCallback((id: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= PROFILE_CONFIG.maxInterests) {
        Alert.alert('Максимум', `Можно выбрать не более ${PROFILE_CONFIG.maxInterests} интересов`);
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  // Save interests
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const { error } = await updateInterests(selectedInterests);

      if (error) {
        Alert.alert('Ошибка', error.message);
        return;
      }

      await refreshProfile();
      Alert.alert('Готово', 'Интересы обновлены', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to save interests:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить интересы');
    } finally {
      setIsSaving(false);
    }
  }, [selectedInterests, refreshProfile]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Мои интересы</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Выберите до {PROFILE_CONFIG.maxInterests} интересов, чтобы мы могли рекомендовать вам подходящие
          встречи
        </Text>

        {/* Categories with subcategories */}
        {categories.map((category) => {
          const isSelected = selectedInterests.includes(category.id);

          return (
            <View key={category.id} style={styles.categorySection}>
              {/* Parent Category */}
              <Pressable
                onPress={() => handleToggleInterest(category.id)}
                style={[
                  styles.categoryCard,
                  isSelected && styles.categoryCardSelected,
                  { borderColor: isSelected ? category.color : THEME_COLORS.border },
                ]}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text
                  style={[
                    styles.categoryName,
                    isSelected && { color: category.color },
                  ]}
                >
                  {category.name}
                </Text>
                {isSelected && (
                  <View
                    style={[
                      styles.checkmark,
                      { backgroundColor: category.color },
                    ]}
                  >
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </Pressable>

              {/* Subcategories (shown if parent selected) */}
              {isSelected && category.subcategories && category.subcategories.length > 0 && (
                <View style={styles.subcategoriesContainer}>
                  {category.subcategories.map((sub) => {
                    const isSubSelected = selectedInterests.includes(sub.id);

                    return (
                      <Pressable
                        key={sub.id}
                        onPress={() => handleToggleInterest(sub.id)}
                        style={[
                          styles.subcategoryChip,
                          isSubSelected && {
                            backgroundColor: `${category.color}20`,
                            borderColor: category.color,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.subcategoryText,
                            isSubSelected && { color: category.color },
                          ]}
                        >
                          {sub.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.selectedCount}>
          Выбрано: {selectedInterests.length}/{PROFILE_CONFIG.maxInterests}
        </Text>

        <Button
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          style={styles.saveButton}
        >
          Сохранить
        </Button>
      </ScrollView>
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    textAlign: 'center',
  },
  headerRight: {
    width: 44,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  description: {
    fontSize: 15,
    color: THEME_COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: THEME_COLORS.border,
    padding: 16,
  },
  categoryCardSelected: {
    backgroundColor: '#F9FAFB',
  },
  categoryIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  subcategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginLeft: 16,
    gap: 8,
  },
  subcategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME_COLORS.surface,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  subcategoryText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    fontWeight: '500',
  },
  selectedCount: {
    textAlign: 'center',
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginTop: 24,
  },
  saveButton: {
    marginTop: 24,
  },
});
