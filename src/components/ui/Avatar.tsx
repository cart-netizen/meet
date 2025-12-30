/**
 * Avatar Component
 * User avatar with fallback initials
 */

import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { THEME_COLORS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  source?: { uri: string } | null;
  name?: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

// ============================================================================
// Component
// ============================================================================

export function Avatar({ source, name, size = 'md', style }: AvatarProps) {
  const sizeValue = SIZES[size];
  const fontSize = sizeValue * 0.4;

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const backgroundColor = name
    ? getColorFromString(name)
    : THEME_COLORS.textMuted;

  if (source?.uri) {
    return (
      <Image
        source={source}
        style={[
          styles.image,
          { width: sizeValue, height: sizeValue, borderRadius: sizeValue / 2 },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius: sizeValue / 2,
          backgroundColor,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const SIZES: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

function getColorFromString(str: string): string {
  const colors = [
    '#8B5CF6', // purple
    '#10B981', // green
    '#F59E0B', // orange
    '#3B82F6', // blue
    '#EC4899', // pink
    '#EF4444', // red
    '#6366F1', // indigo
    '#14B8A6', // teal
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length] ?? colors[0];
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  image: {
    backgroundColor: THEME_COLORS.divider,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
