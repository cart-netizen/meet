/**
 * Environment configuration
 * Centralized access to environment variables with validation
 */

import Constants from 'expo-constants';

interface EnvironmentConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  yandexMaps: {
    apiKey: string;
  };
  yookassa: {
    shopId: string;
  };
  app: {
    environment: 'development' | 'staging' | 'production';
    version: string;
    buildNumber: string;
  };
  features: {
    enableAnalytics: boolean;
    enableCrashReporting: boolean;
    enableDebugMode: boolean;
  };
}

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, fallback: string = ''): string {
  // Try Expo Constants first (for EAS builds)
  const expoExtra = Constants.expoConfig?.extra?.[key] as string | undefined;
  if (expoExtra) {
    return expoExtra;
  }

  // Try process.env (for development)
  const envValue = process.env[key];
  if (envValue) {
    return envValue;
  }

  return fallback;
}

/**
 * Determine current environment
 */
function getEnvironment(): 'development' | 'staging' | 'production' {
  const env = getEnvVar('EXPO_PUBLIC_APP_ENV', 'development');

  if (env === 'production' || env === 'staging') {
    return env;
  }

  return 'development';
}

/**
 * Validated environment configuration
 */
export const ENV: EnvironmentConfig = {
  supabase: {
    url: getEnvVar('EXPO_PUBLIC_SUPABASE_URL'),
    anonKey: getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  },
  yandexMaps: {
    apiKey: getEnvVar('EXPO_PUBLIC_YANDEX_MAPS_API_KEY'),
  },
  yookassa: {
    shopId: getEnvVar('EXPO_PUBLIC_YOOKASSA_SHOP_ID'),
  },
  app: {
    environment: getEnvironment(),
    version: Constants.expoConfig?.version ?? '1.0.0',
    buildNumber: Constants.expoConfig?.ios?.buildNumber ??
                 Constants.expoConfig?.android?.versionCode?.toString() ??
                 '1',
  },
  features: {
    enableAnalytics: getEnvironment() === 'production',
    enableCrashReporting: getEnvironment() !== 'development',
    enableDebugMode: getEnvironment() === 'development',
  },
};

/**
 * Validate required environment variables
 * Call this on app startup
 */
export function validateEnv(): { isValid: boolean; missing: string[] } {
  const required = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing = required.filter((key) => !getEnvVar(key));

  if (missing.length > 0 && ENV.app.environment === 'production') {
    console.error('Missing required environment variables:', missing);
  }

  return {
    isValid: missing.length === 0,
    missing,
  };
}

/**
 * Check if running in development mode
 */
export const isDev = ENV.app.environment === 'development';

/**
 * Check if running in production mode
 */
export const isProd = ENV.app.environment === 'production';

/**
 * Check if running in staging mode
 */
export const isStaging = ENV.app.environment === 'staging';
