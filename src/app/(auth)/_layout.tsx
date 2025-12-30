/**
 * Auth Layout
 * Layout for authentication screens
 */

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/stores';
import { THEME_COLORS } from '@/constants';

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);

  // Redirect authenticated users
  if (user) {
    if (hasCompletedOnboarding) {
      return <Redirect href="/(tabs)" />;
    }
    return <Redirect href="/(auth)/onboarding/interests" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: THEME_COLORS.surface },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="onboarding/interests" />
      <Stack.Screen name="onboarding/location" />
    </Stack>
  );
}
