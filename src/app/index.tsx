/**
 * App Entry Point
 * Redirects to the appropriate screen based on auth state
 */

import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores';

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  // Wait for auth initialization
  if (!isInitialized) {
    return null;
  }

  // Redirect based on auth state
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
