/**
 * Register Screen
 * New user registration with email and password
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
import { THEME_COLORS, ERROR_MESSAGES, CITY_NAMES, RUSSIAN_CITIES } from '@/constants';
import { useAuthStore } from '@/stores';

// ============================================================================
// Validation Schema
// ============================================================================

const registerSchema = z
  .object({
    displayName: z
      .string()
      .min(2, ERROR_MESSAGES.displayNameTooShort)
      .max(50, 'Имя слишком длинное'),
    email: z
      .string()
      .min(1, 'Введите email')
      .email(ERROR_MESSAGES.invalidEmail),
    password: z
      .string()
      .min(1, 'Введите пароль')
      .min(8, ERROR_MESSAGES.passwordTooShort),
    confirmPassword: z.string().min(1, 'Подтвердите пароль'),
    city: z.string().min(1, 'Выберите город'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: ERROR_MESSAGES.passwordMismatch,
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

// ============================================================================
// Component
// ============================================================================

export default function RegisterScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const signUp = useAuthStore((state) => state.signUp);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      city: '',
    },
  });

  const selectedCity = watch('city');

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);

    const result = await signUp({
      email: data.email,
      password: data.password,
      displayName: data.displayName,
      city: data.city,
    });

    setIsLoading(false);

    if (!result.success) {
      if (result.error?.includes('already')) {
        setError('email', { message: ERROR_MESSAGES.emailAlreadyExists });
      } else {
        setError('root', { message: result.error ?? 'Ошибка регистрации' });
      }
    } else {
      router.replace('/(auth)/onboarding/interests');
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
          <Text style={styles.title}>Создать аккаунт</Text>
          <Text style={styles.subtitle}>
            Присоединяйтесь к сообществу единомышленников
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
            name="displayName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Имя"
                placeholder="Как вас зовут?"
                autoCapitalize="words"
                autoComplete="name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.displayName?.message}
              />
            )}
          />

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
                autoComplete="new-password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Подтвердите пароль"
                placeholder="Повторите пароль"
                isPassword
                autoComplete="new-password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          {/* City Selector */}
          <View style={styles.cityContainer}>
            <Text style={styles.label}>Город</Text>
            <Pressable
              style={[
                styles.citySelector,
                errors.city && styles.citySelectorError,
              ]}
              onPress={() => setShowCityPicker(!showCityPicker)}
            >
              <Text
                style={[
                  styles.citySelectorText,
                  !selectedCity && styles.citySelectorPlaceholder,
                ]}
              >
                {selectedCity || 'Выберите город'}
              </Text>
              <Text style={styles.citySelectorArrow}>
                {showCityPicker ? '▲' : '▼'}
              </Text>
            </Pressable>
            {errors.city && (
              <Text style={styles.errorText}>{errors.city.message}</Text>
            )}

            {showCityPicker && (
              <View style={styles.cityList}>
                <ScrollView
                  style={styles.cityListScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {RUSSIAN_CITIES.slice(0, 15).map((city) => (
                    <Pressable
                      key={city.id}
                      style={[
                        styles.cityItem,
                        selectedCity === city.name && styles.cityItemSelected,
                      ]}
                      onPress={() => {
                        setValue('city', city.name);
                        setShowCityPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.cityItemText,
                          selectedCity === city.name &&
                            styles.cityItemTextSelected,
                        ]}
                      >
                        {city.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <Button
            onPress={handleSubmit(onSubmit)}
            isLoading={isLoading}
            fullWidth
            size="lg"
            style={styles.submitButton}
          >
            Зарегистрироваться
          </Button>

          <Text style={styles.terms}>
            Регистрируясь, вы соглашаетесь с{' '}
            <Text style={styles.termsLink}>Условиями использования</Text> и{' '}
            <Text style={styles.termsLink}>Политикой конфиденциальности</Text>
          </Text>
        </View>

        {/* Login Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Уже есть аккаунт? </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Войти</Text>
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
  },
  header: {
    marginBottom: 24,
    marginTop: 48,
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
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME_COLORS.text,
    marginBottom: 6,
  },
  cityContainer: {
    marginBottom: 16,
    zIndex: 1000,
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME_COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: THEME_COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  citySelectorError: {
    borderColor: THEME_COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  citySelectorText: {
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  citySelectorPlaceholder: {
    color: THEME_COLORS.textMuted,
  },
  citySelectorArrow: {
    fontSize: 12,
    color: THEME_COLORS.textMuted,
  },
  cityList: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1001,
  },
  cityListScroll: {
    maxHeight: 200,
  },
  cityItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  cityItemSelected: {
    backgroundColor: `${THEME_COLORS.primary}10`,
  },
  cityItemText: {
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  cityItemTextSelected: {
    color: THEME_COLORS.primary,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: THEME_COLORS.error,
    marginTop: 4,
    marginLeft: 4,
  },
  submitButton: {
    marginTop: 8,
  },
  terms: {
    marginTop: 16,
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: THEME_COLORS.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingBottom: 32,
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
