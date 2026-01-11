/**
 * Interests Selection Screen
 * Onboarding step for selecting user interests
 */

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { ACTIVITY_CATEGORIES, PROFILE_CONFIG, THEME_COLORS } from '@/constants';
import { useAuthStore } from '@/stores';
import { updateInterests } from '@/services/supabase/profiles.service';

// ============================================================================
// Component
// ============================================================================

export default function InterestsScreen() {
  const [selected, setSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setOnboardingCompleted = useAuthStore((state) => state.setOnboardingCompleted);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const setPendingInterests = useAuthStore((state) => state.setPendingInterests);
  const session = useAuthStore((state) => state.session);

  const toggleInterest = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= PROFILE_CONFIG.maxInterests) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleContinue = async () => {
    if (selected.length < PROFILE_CONFIG.minInterests) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if we have an active session (email verified)
      if (session) {
        // Session exists - save to database
        const { error: updateError } = await updateInterests(selected);

        if (updateError) {
          console.error('Failed to update interests:', updateError);
          setError(updateError.message || 'Не удалось сохранить интересы');
          return;
        }

        await refreshProfile();
      } else {
        // No session (email not verified) - save locally
        // Will be synced after email verification
        setPendingInterests(selected);
      }

      setOnboardingCompleted();
      router.replace('/(tabs)');
    } catch (e) {
      console.error('Unexpected error:', e);
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  const canContinue = selected.length >= PROFILE_CONFIG.minInterests;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.step}>Шаг 1 из 1</Text>
        <Text style={styles.title}>Что тебе интересно?</Text>
        <Text style={styles.subtitle}>
          Выбери минимум {PROFILE_CONFIG.minInterests} категории, чтобы мы могли
          показывать релевантные встречи
        </Text>
      </View>

      {/* Categories */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.categoriesContainer}
        showsVerticalScrollIndicator={false}
      >
        {ACTIVITY_CATEGORIES.map((category) => {
          const isSelected = selected.includes(category.id);

          return (
            <View key={category.id} style={styles.categorySection}>
              {/* Parent Category */}
              <Pressable
                onPress={() => toggleInterest(category.id)}
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
              {isSelected && category.subcategories && (
                <View style={styles.subcategoriesContainer}>
                  {category.subcategories.map((sub) => {
                    const isSubSelected = selected.includes(sub.id);

                    return (
                      <Pressable
                        key={sub.id}
                        onPress={() => toggleInterest(sub.id)}
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
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <Text style={styles.selectedCount}>
          Выбрано: {selected.length}
          {selected.length < PROFILE_CONFIG.minInterests &&
            ` (минимум ${PROFILE_CONFIG.minInterests})`}
        </Text>
        <Button
          onPress={handleContinue}
          disabled={!canContinue}
          isLoading={isLoading}
          fullWidth
          size="lg"
        >
          Продолжить
        </Button>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.surface,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  step: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  categoriesContainer: {
    padding: 24,
    paddingTop: 8,
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
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  subcategoryText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    fontWeight: '500',
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
    backgroundColor: THEME_COLORS.surface,
  },
  selectedCount: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: THEME_COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
