/**
 * Auth Layout
 * Layout for authentication screens
 */

import { Redirect, Stack, useSegments } from 'expo-router';

import { useAuthStore } from '@/stores';
import { THEME_COLORS } from '@/constants';

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const segments = useSegments();

  // Check if we're already on an onboarding screen
  const isOnOnboarding = segments.includes('onboarding');

  // Redirect authenticated users
  if (user) {
    if (hasCompletedOnboarding) {
      return <Redirect href="/(tabs)" />;
    }
    // Only redirect to onboarding if not already there
    if (!isOnOnboarding) {
      return <Redirect href="/(auth)/onboarding/interests" />;
    }
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
      <Stack.Screen name="onboarding/interests" />
    </Stack>
  );
}
