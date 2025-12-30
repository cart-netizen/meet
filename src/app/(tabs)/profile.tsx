/**
 * Profile Screen
 * User profile and settings
 */

import { useCallback } from 'react';
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

import { Avatar, Badge, Button } from '@/components/ui';
import { SUBSCRIPTION_CONFIG, THEME_COLORS } from '@/constants';
import { selectProfile, useAuthStore } from '@/stores';

// ============================================================================
// Component
// ============================================================================

export default function ProfileScreen() {
  const profile = useAuthStore(selectProfile);
  const signOut = useAuthStore((state) => state.signOut);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти из аккаунта?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  }, [signOut]);

  const hasSubscription = profile?.subscriptionType !== 'free';
  const isOrganizer = profile?.subscriptionType === 'organizer';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.header}>
          <Avatar
            source={profile?.avatarUrl ? { uri: profile.avatarUrl } : null}
            name={profile?.displayName}
            size="xl"
          />
          <Text style={styles.displayName}>{profile?.displayName}</Text>
          <Text style={styles.city}>{profile?.city}</Text>

          {/* Subscription Badge */}
          <View style={styles.subscriptionBadge}>
            {hasSubscription ? (
              <Badge
                variant={isOrganizer ? 'primary' : 'secondary'}
                size="md"
              >
                {isOrganizer ? '⭐ Организатор' : '✓ Участник'}
              </Badge>
            ) : (
              <Badge variant="outline" size="md">
                Бесплатный план
              </Badge>
            )}
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.eventsOrganized ?? 0}</Text>
              <Text style={styles.statLabel}>организовано</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.eventsAttended ?? 0}</Text>
              <Text style={styles.statLabel}>посещено</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                ⭐ {profile?.rating?.toFixed(1) ?? '5.0'}
              </Text>
              <Text style={styles.statLabel}>{profile?.reviewsCount ?? 0} отзывов</Text>
            </View>
          </View>
        </View>

        {/* Subscription Card */}
        {!hasSubscription && (
          <Pressable
            style={styles.subscriptionCard}
            onPress={() => router.push('/subscription')}
          >
            <View style={styles.subscriptionCardContent}>
              <Text style={styles.subscriptionCardTitle}>
                Разблокируйте все возможности
              </Text>
              <Text style={styles.subscriptionCardText}>
                Записывайтесь на встречи, создавайте свои и общайтесь с участниками
              </Text>
              <View style={styles.subscriptionPricing}>
                <Text style={styles.subscriptionPrice}>
                  от {SUBSCRIPTION_CONFIG.prices.participant}₽
                </Text>
                <Text style={styles.subscriptionPeriod}>/мес</Text>
              </View>
            </View>
            <Text style={styles.subscriptionCardArrow}>→</Text>
          </Pressable>
        )}

        {/* Menu */}
        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Аккаунт</Text>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/profile/edit')}
          >
            <Text style={styles.menuItemIcon}>✏️</Text>
            <Text style={styles.menuItemText}>Редактировать профиль</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/profile/interests')}
          >
            <Text style={styles.menuItemIcon}>💫</Text>
            <Text style={styles.menuItemText}>Мои интересы</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/subscription')}
          >
            <Text style={styles.menuItemIcon}>💎</Text>
            <Text style={styles.menuItemText}>Подписка</Text>
            {hasSubscription && (
              <Badge variant="success" size="sm" style={styles.menuItemBadge}>
                Активна
              </Badge>
            )}
            <Text style={styles.menuItemArrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Настройки</Text>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/settings/notifications')}
          >
            <Text style={styles.menuItemIcon}>🔔</Text>
            <Text style={styles.menuItemText}>Уведомления</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/settings/privacy')}
          >
            <Text style={styles.menuItemIcon}>🔒</Text>
            <Text style={styles.menuItemText}>Конфиденциальность</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Поддержка</Text>

          <Pressable style={styles.menuItem}>
            <Text style={styles.menuItemIcon}>❓</Text>
            <Text style={styles.menuItemText}>Помощь</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </Pressable>

          <Pressable style={styles.menuItem}>
            <Text style={styles.menuItemIcon}>📝</Text>
            <Text style={styles.menuItemText}>Оставить отзыв</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </Pressable>
        </View>

        {/* Sign Out */}
        <Button
          variant="ghost"
          onPress={handleSignOut}
          style={styles.signOutButton}
        >
          <Text style={styles.signOutText}>Выйти из аккаунта</Text>
        </Button>

        {/* Version */}
        <Text style={styles.version}>Версия 1.0.0</Text>
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
  content: {
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    backgroundColor: THEME_COLORS.surface,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginTop: 16,
  },
  city: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
    marginTop: 4,
  },
  subscriptionBadge: {
    marginTop: 12,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME_COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: THEME_COLORS.divider,
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.primary,
    margin: 16,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
  },
  subscriptionCardContent: {
    flex: 1,
  },
  subscriptionCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subscriptionCardText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
    lineHeight: 20,
  },
  subscriptionPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  subscriptionPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subscriptionPeriod: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 2,
  },
  subscriptionCardArrow: {
    fontSize: 24,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  menu: {
    backgroundColor: THEME_COLORS.surface,
    marginTop: 16,
    paddingTop: 8,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME_COLORS.textMuted,
    paddingHorizontal: 20,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemIcon: {
    fontSize: 20,
    width: 32,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  menuItemBadge: {
    marginRight: 8,
  },
  menuItemArrow: {
    fontSize: 20,
    color: THEME_COLORS.textMuted,
  },
  signOutButton: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  signOutText: {
    color: THEME_COLORS.error,
    fontSize: 16,
    fontWeight: '500',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: THEME_COLORS.textMuted,
    marginTop: 16,
  },
});
