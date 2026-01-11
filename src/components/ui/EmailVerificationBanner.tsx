/**
 * Email Verification Banner
 * Shows a banner prompting user to verify their email
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { THEME_COLORS } from '@/constants';
import { useAuthStore } from '@/stores';

interface EmailVerificationBannerProps {
  message?: string;
  onResend?: () => void;
}

export function EmailVerificationBanner({
  message = 'Для выполнения этого действия необходимо подтвердить email',
  onResend,
}: EmailVerificationBannerProps) {
  const user = useAuthStore((state) => state.user);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>📧</Text>
      </View>
      <Text style={styles.title}>Подтвердите email</Text>
      <Text style={styles.message}>{message}</Text>
      {user?.email && (
        <Text style={styles.email}>{user.email}</Text>
      )}
      <Text style={styles.hint}>
        Проверьте папку "Входящие" и "Спам".{'\n'}
        После подтверждения войдите в аккаунт заново.
      </Text>
      <View style={styles.actions}>
        {onResend && (
          <Pressable style={styles.resendButton} onPress={onResend}>
            <Text style={styles.resendButtonText}>Отправить повторно</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.loginButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.loginButtonText}>Войти</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: THEME_COLORS.surface,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME_COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.primary,
    marginBottom: 16,
  },
  hint: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  resendButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: THEME_COLORS.primary,
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.primary,
  },
  loginButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: THEME_COLORS.primary,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
