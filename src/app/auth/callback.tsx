/**
 * Auth Callback Screen
 * Handles deep link callback from email verification
 */

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Linking from 'expo-linking';

import { supabase } from '@/services/supabase/client';
import { THEME_COLORS } from '@/constants';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the full URL to parse the hash fragment
        const url = await Linking.getInitialURL();

        if (url) {
          // Parse URL fragment (tokens come after #)
          const hashIndex = url.indexOf('#');
          if (hashIndex !== -1) {
            const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
            const access_token = hashParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token');

            if (access_token && refresh_token) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });

              if (sessionError) {
                setError(sessionError.message);
                return;
              }

              // Successfully authenticated - navigate to main app
              router.replace('/');
              return;
            }
          }
        }

        // Also check params from expo-router
        const accessToken = params.access_token as string;
        const refreshToken = params.refresh_token as string;

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setError(sessionError.message);
            return;
          }

          router.replace('/');
          return;
        }

        // No tokens found
        setError('No authentication tokens found');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [params]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Authentication Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={THEME_COLORS.primary} />
      <Text style={styles.text}>Verifying your email...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.background,
    padding: 24,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
  errorIcon: {
    fontSize: 48,
    color: THEME_COLORS.error,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
  },
});
