/**
 * Root Layout
 * Main application layout with navigation and providers
 */

import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import * as Linking from 'expo-linking';

import { THEME_COLORS } from '@/constants';
import { useAuthStore, useCategoriesStore } from '@/stores';
import { validateEnv } from '@/config/env';
import { supabase } from '@/services/supabase/client';

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
  const initializeCategories = useCategoriesStore((state) => state.initialize);
  const categoriesInitialized = useCategoriesStore((state) => state.isInitialized);

  useEffect(() => {
    // Validate environment
    const { isValid, missing } = validateEnv();
    if (!isValid) {
      console.warn('Missing environment variables:', missing);
    }

    // Initialize auth and categories in parallel
    initialize();
    initializeCategories();

    // Handle deep links for auth callbacks
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;

      // Check if this is an auth callback
      if (url.includes('auth/callback')) {
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1) {
          const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');

          if (access_token && refresh_token) {
            try {
              await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              // Reinitialize to update auth state
              initialize();
              router.replace('/');
            } catch (error) {
              console.error('Failed to set session from deep link:', error);
            }
          }
        }
      }
    };

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [initialize, initializeCategories]);

  if (!isInitialized || !categoriesInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
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
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
            <Stack.Screen
              name="event/create"
              options={{
                headerShown: true,
                headerTitle: 'Новая встреча',
                presentation: 'modal',
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
            <Stack.Screen
              name="profile/[id]"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="chat/dm/[userId]"
              options={{
                headerShown: false,
              }}
            />
          </Stack>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
});
