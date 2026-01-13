/**
 * Edit Interests Screen
 * Allows user to select their interests
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
import { THEME_COLORS } from '@/constants';
import { selectProfile, useAuthStore, useCategoriesStore } from '@/stores';
import { updateInterests } from '@/services/supabase/profiles.service';

// ============================================================================
// Component
// ============================================================================

export default function InterestsScreen() {
  const profile = useAuthStore(selectProfile);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const categories = useCategoriesStore((state) => state.categories);

  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    profile?.interests ?? []
  );
  const [isSaving, setIsSaving] = useState(false);

  // Toggle interest selection
  const handleToggleInterest = useCallback((interest: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest);
      }
      if (prev.length >= 10) {
        Alert.alert('Максимум', 'Можно выбрать не более 10 интересов');
        return prev;
      }
      return [...prev, interest];
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

  // Create list of interests from categories
  const allInterests = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
  }));

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
          Выберите до 10 интересов, чтобы мы могли рекомендовать вам подходящие
          встречи
        </Text>

        <View style={styles.interestsList}>
          {allInterests.map((interest) => {
            const isSelected = selectedInterests.includes(interest.name);
            return (
              <Pressable
                key={interest.id}
                style={[
                  styles.interestItem,
                  isSelected && styles.interestItemSelected,
                  isSelected && { borderColor: interest.color },
                ]}
                onPress={() => handleToggleInterest(interest.name)}
              >
                <Text style={styles.interestIcon}>{interest.icon}</Text>
                <Text
                  style={[
                    styles.interestName,
                    isSelected && { color: interest.color },
                  ]}
                >
                  {interest.name}
                </Text>
                {isSelected && (
                  <View
                    style={[
                      styles.checkmark,
                      { backgroundColor: interest.color },
                    ]}
                  >
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.selectedCount}>
          Выбрано: {selectedInterests.length}/10
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
  },
  description: {
    fontSize: 15,
    color: THEME_COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  interestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: THEME_COLORS.border,
    gap: 6,
  },
  interestItemSelected: {
    backgroundColor: THEME_COLORS.background,
  },
  interestIcon: {
    fontSize: 18,
  },
  interestName: {
    fontSize: 15,
    color: THEME_COLORS.text,
    fontWeight: '500',
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
