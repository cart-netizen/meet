/**
 * Root Layout
 * Main application layout with navigation and providers
 */

import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';

import { THEME_COLORS } from '@/constants';
import { useAuthStore } from '@/stores';
import { validateEnv } from '@/config/env';

// ============================================================================
// Theme Configuration
// ============================================================================

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: THEME_COLORS.primary,
    secondary: THEME_COLORS.secondary,
    error: THEME_COLORS.error,
    background: THEME_COLORS.background,
    surface: THEME_COLORS.surface,
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
  },
};

// ============================================================================
// Component
// ============================================================================

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    // Validate environment
    const { isValid, missing } = validateEnv();
    if (!isValid) {
      console.warn('Missing environment variables:', missing);
    }

    // Initialize auth
    initialize();
  }, [initialize]);

  if (!isInitialized) {
    return null; // Or a splash screen
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: THEME_COLORS.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="event/[id]"
              options={{
                headerShown: true,
                headerTitle: '',
                headerBackTitle: 'Назад',
                headerTransparent: true,
              }}
            />
            <Stack.Screen
              name="event/create"
              options={{
                headerShown: true,
                headerTitle: 'Новая встреча',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="user/[id]"
              options={{
                headerShown: true,
                headerTitle: 'Профиль',
                headerBackTitle: 'Назад',
              }}
            />
            <Stack.Screen
              name="subscription"
              options={{
                headerShown: true,
                headerTitle: 'Подписка',
                presentation: 'modal',
              }}
            />
          </Stack>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
