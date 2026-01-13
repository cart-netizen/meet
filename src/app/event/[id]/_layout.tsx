/**
 * Event Detail Layout
 * Layout for event detail screens with shared header
 */

import { Stack } from 'expo-router';

import { THEME_COLORS } from '@/constants';

export default function EventDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Назад',
        contentStyle: { backgroundColor: THEME_COLORS.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: '',
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="chat"
        options={{
          headerTitle: 'Чат встречи',
        }}
      />
      <Stack.Screen
        name="manage"
        options={{
          headerTitle: 'Управление',
        }}
      />
      <Stack.Screen
        name="review"
        options={{
          headerTitle: 'Отзыв',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="participants"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
