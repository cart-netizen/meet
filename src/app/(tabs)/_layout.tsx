/**
 * Tabs Layout
 * Main navigation tabs for authenticated users
 */

import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { THEME_COLORS } from '@/constants';
import { useAuthStore } from '@/stores';

// ============================================================================
// Tab Icons
// ============================================================================

interface TabIconProps {
  icon: string;
  label: string;
  focused: boolean;
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabIconContainer}>
      <Text
        style={[
          styles.tabIcon,
          focused && styles.tabIconFocused,
        ]}
      >
        {icon}
      </Text>
      <Text
        style={[
          styles.tabLabel,
          focused && styles.tabLabelFocused,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function TabsLayout() {
  const user = useAuthStore((state) => state.user);
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);

  // Redirect unauthenticated users
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Redirect users who haven't completed onboarding
  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/onboarding/interests" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: THEME_COLORS.primary,
        tabBarInactiveTintColor: THEME_COLORS.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Встречи',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🔍" label="Встречи" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-events"
        options={{
          title: 'Мои',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📅" label="Мои" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Чаты',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="💬" label="Чаты" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" label="Профиль" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  tabBar: {
    height: 80,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.5,
  },
  tabIconFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME_COLORS.textMuted,
  },
  tabLabelFocused: {
    color: THEME_COLORS.primary,
    fontWeight: '600',
  },
});
