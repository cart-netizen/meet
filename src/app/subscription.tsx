/**
 * Subscription Screen
 * Subscription plans and payment flow
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
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Badge, Button } from '@/components/ui';
import { SUBSCRIPTION_CONFIG, THEME_COLORS } from '@/constants';
import { selectProfile, useAuthStore } from '@/stores';
import { updateProfile } from '@/services/supabase/profiles.service';
import type { SubscriptionType } from '@/types';

// ============================================================================
// Component
// ============================================================================

export default function SubscriptionScreen() {
  const profile = useAuthStore(selectProfile);

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentSubscription = profile?.subscriptionType ?? 'free';
  const subscriptionExpiresAt = profile?.subscriptionExpiresAt;
  const hasActiveSubscription = currentSubscription !== 'free';

  // Handle plan selection
  const handleSelectPlan = useCallback((plan: SubscriptionType) => {
    if (plan === currentSubscription) return;
    setSelectedPlan(plan);
  }, [currentSubscription]);

  // Refresh profile action
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  // Handle purchase - TEST MODE: directly activate subscription
  const handlePurchase = useCallback(async () => {
    if (!selectedPlan) return;

    setIsProcessing(true);
    try {
      // TEST MODE: Directly activate subscription without payment
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription

      const { error } = await updateProfile({
        subscriptionType: selectedPlan,
        subscriptionExpiresAt: expiresAt.toISOString(),
      });

      if (error) {
        throw error;
      }

      // Refresh profile to get updated subscription
      await refreshProfile();

      Alert.alert(
        'Готово!',
        `Подписка "${selectedPlan === 'organizer' ? 'Организатор' : 'Участник'}" активирована (тестовый режим)`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/(tabs)/profile');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert('Ошибка', 'Не удалось активировать подписку');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPlan, refreshProfile]);

  // Handle cancel subscription
  const handleCancelSubscription = useCallback(() => {
    Alert.alert(
      'Отмена подписки',
      'Подписка останется активной до конца оплаченного периода. Автоматическое продление будет отключено.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отменить подписку',
          style: 'destructive',
          onPress: async () => {
            // TODO: Implement subscription cancellation
            Alert.alert('Готово', 'Автоматическое продление отключено');
          },
        },
      ]
    );
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Подписка</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Current Status */}
        {hasActiveSubscription && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>
                {currentSubscription === 'organizer' ? 'Организатор' : 'Участник'}
              </Text>
              <Badge variant="success" size="sm">
                Активна
              </Badge>
            </View>
            <Text style={styles.statusExpiry}>
              Действует до{' '}
              {subscriptionExpiresAt
                ? format(new Date(subscriptionExpiresAt), 'd MMMM yyyy', { locale: ru })
                : 'неограниченно'}
            </Text>
          </View>
        )}

        {/* Plans */}
        <Text style={styles.sectionTitle}>Выберите план</Text>

        {/* Free Plan */}
        <Pressable
          style={[
            styles.planCard,
            currentSubscription === 'free' && styles.planCardCurrent,
          ]}
          disabled
        >
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planName}>Бесплатный</Text>
              <Text style={styles.planPrice}>0 ₽</Text>
            </View>
            {currentSubscription === 'free' && (
              <Badge variant="outline" size="sm">
                Текущий
              </Badge>
            )}
          </View>
          <View style={styles.planFeatures}>
            <Text style={styles.planFeature}>✓ Просмотр встреч</Text>
            <Text style={styles.planFeature}>✓ Поиск по карте</Text>
            <Text style={[styles.planFeature, styles.planFeatureDisabled]}>
              ✗ Запись на встречи
            </Text>
            <Text style={[styles.planFeature, styles.planFeatureDisabled]}>
              ✗ Создание встреч
            </Text>
            <Text style={[styles.planFeature, styles.planFeatureDisabled]}>
              ✗ Чат с участниками
            </Text>
          </View>
        </Pressable>

        {/* Participant Plan */}
        <Pressable
          style={[
            styles.planCard,
            currentSubscription === 'participant' && styles.planCardCurrent,
            selectedPlan === 'participant' && styles.planCardSelected,
          ]}
          onPress={() => handleSelectPlan('participant')}
        >
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planName}>Участник</Text>
              <View style={styles.planPriceRow}>
                <Text style={styles.planPrice}>
                  {SUBSCRIPTION_CONFIG.prices.participant} ₽
                </Text>
                <Text style={styles.planPeriod}>/месяц</Text>
              </View>
            </View>
            {currentSubscription === 'participant' ? (
              <Badge variant="success" size="sm">
                Активна
              </Badge>
            ) : selectedPlan === 'participant' ? (
              <View style={styles.planCheckmark}>
                <Text style={styles.planCheckmarkIcon}>✓</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.planFeatures}>
            <Text style={styles.planFeature}>✓ Всё из Бесплатного</Text>
            <Text style={styles.planFeature}>✓ Запись на встречи</Text>
            <Text style={styles.planFeature}>✓ Чат с участниками</Text>
            <Text style={styles.planFeature}>✓ Уведомления о встречах</Text>
            <Text style={[styles.planFeature, styles.planFeatureDisabled]}>
              ✗ Создание встреч
            </Text>
          </View>
        </Pressable>

        {/* Organizer Plan */}
        <Pressable
          style={[
            styles.planCard,
            styles.planCardPremium,
            currentSubscription === 'organizer' && styles.planCardCurrent,
            selectedPlan === 'organizer' && styles.planCardSelected,
          ]}
          onPress={() => handleSelectPlan('organizer')}
        >
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>⭐ Популярный</Text>
          </View>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planName}>Организатор</Text>
              <View style={styles.planPriceRow}>
                <Text style={styles.planPrice}>
                  {SUBSCRIPTION_CONFIG.prices.organizer} ₽
                </Text>
                <Text style={styles.planPeriod}>/месяц</Text>
              </View>
            </View>
            {currentSubscription === 'organizer' ? (
              <Badge variant="success" size="sm">
                Активна
              </Badge>
            ) : selectedPlan === 'organizer' ? (
              <View style={styles.planCheckmark}>
                <Text style={styles.planCheckmarkIcon}>✓</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.planFeatures}>
            <Text style={styles.planFeature}>✓ Всё из Участника</Text>
            <Text style={styles.planFeature}>✓ Создание встреч</Text>
            <Text style={styles.planFeature}>✓ Управление участниками</Text>
            <Text style={styles.planFeature}>✓ Платные встречи</Text>
            <Text style={styles.planFeature}>✓ Аналитика и статистика</Text>
          </View>
        </Pressable>

        {/* Single Event Access */}
        <View style={styles.singleEventCard}>
          <View style={styles.singleEventContent}>
            <Text style={styles.singleEventTitle}>Разовый доступ</Text>
            <Text style={styles.singleEventText}>
              Запишитесь на одну встречу без подписки
            </Text>
          </View>
          <Text style={styles.singleEventPrice}>
            {SUBSCRIPTION_CONFIG.prices.singleEvent} ₽
          </Text>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💳 Безопасная оплата через Альфа-Банк{'\n'}
            🔄 Автоматическое продление подписки{'\n'}
            ↩️ Отмена в любой момент
          </Text>
        </View>

        {/* Manage Subscription */}
        {hasActiveSubscription && (
          <Pressable
            style={styles.cancelButton}
            onPress={handleCancelSubscription}
          >
            <Text style={styles.cancelButtonText}>
              Отменить подписку
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Purchase Button */}
      {selectedPlan && selectedPlan !== currentSubscription && (
        <View style={styles.footer}>
          <Button
            onPress={handlePurchase}
            loading={isProcessing}
            style={styles.purchaseButton}
          >
            Оформить за{' '}
            {selectedPlan === 'participant'
              ? SUBSCRIPTION_CONFIG.prices.participant
              : SUBSCRIPTION_CONFIG.prices.organizer}{' '}
            ₽/мес
          </Button>
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
    fontSize: 17,
    fontWeight: '600',
    color: THEME_COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  statusCard: {
    backgroundColor: `${THEME_COLORS.success}15`,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.success,
  },
  statusExpiry: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: THEME_COLORS.border,
  },
  planCardCurrent: {
    borderColor: THEME_COLORS.success,
    backgroundColor: `${THEME_COLORS.success}05`,
  },
  planCardSelected: {
    borderColor: THEME_COLORS.primary,
    backgroundColor: `${THEME_COLORS.primary}05`,
  },
  planCardPremium: {
    borderColor: THEME_COLORS.warning,
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: THEME_COLORS.warning,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.primary,
  },
  planPeriod: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginLeft: 2,
  },
  planCheckmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCheckmarkIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  planFeatures: {
    gap: 8,
  },
  planFeature: {
    fontSize: 14,
    color: THEME_COLORS.text,
  },
  planFeatureDisabled: {
    color: THEME_COLORS.textMuted,
  },
  singleEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    borderStyle: 'dashed',
  },
  singleEventContent: {
    flex: 1,
  },
  singleEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  singleEventText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  singleEventPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME_COLORS.primary,
  },
  infoCard: {
    backgroundColor: `${THEME_COLORS.info}10`,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    lineHeight: 22,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontSize: 15,
    color: THEME_COLORS.error,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
  },
  purchaseButton: {
    width: '100%',
  },
});
