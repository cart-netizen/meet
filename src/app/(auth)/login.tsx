/**
 * Login Screen
 * User authentication with email and password
 */

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button, Input } from '@/components/ui';
import { THEME_COLORS, ERROR_MESSAGES } from '@/constants';
import { useAuthStore } from '@/stores';

// ============================================================================
// Validation Schema
// ============================================================================

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Введите email')
    .email(ERROR_MESSAGES.invalidEmail),
  password: z
    .string()
    .min(1, 'Введите пароль')
    .min(8, ERROR_MESSAGES.passwordTooShort),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ============================================================================
// Component
// ============================================================================

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    const result = await signIn({
      email: data.email,
      password: data.password,
    });

    setIsLoading(false);

    if (!result.success) {
      setError('root', {
        message: result.error ?? ERROR_MESSAGES.invalidCredentials,
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>MeetUp.local</Text>
          <Text style={styles.title}>Добро пожаловать!</Text>
          <Text style={styles.subtitle}>
            Войдите, чтобы найти интересные встречи рядом с вами
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {errors.root && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errors.root.message}</Text>
            </View>
          )}

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email"
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Пароль"
                placeholder="Минимум 8 символов"
                isPassword
                autoComplete="password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Забыли пароль?</Text>
            </Pressable>
          </Link>

          <Button
            onPress={handleSubmit(onSubmit)}
            isLoading={isLoading}
            fullWidth
            size="lg"
            style={styles.submitButton}
          >
            Войти
          </Button>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>или</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Login */}
        <View style={styles.socialButtons}>
          <Button
            variant="outline"
            fullWidth
            onPress={() => {
              // TODO: Implement Google login
            }}
          >
            Продолжить с Google
          </Button>
        </View>

        {/* Register Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Ещё нет аккаунта? </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Зарегистрироваться</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.primary,
    marginBottom: 24,
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
  form: {
    marginBottom: 24,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    color: THEME_COLORS.error,
    fontSize: 14,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: THEME_COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME_COLORS.border,
  },
  dividerText: {
    paddingHorizontal: 16,
    color: THEME_COLORS.textMuted,
    fontSize: 14,
  },
  socialButtons: {
    marginBottom: 32,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    fontWeight: '600',
  },
});
