/**
 * Badge Component
 * Small status indicators and labels
 */

import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { THEME_COLORS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

// ============================================================================
// Component
// ============================================================================

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  style,
}: BadgeProps) {
  const containerStyles: ViewStyle[] = [
    styles.base,
    styles[`${variant}Container` as keyof typeof styles] as ViewStyle,
    styles[`${size}Container` as keyof typeof styles] as ViewStyle,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textStyle = [
    styles.text,
    styles[`${variant}Text` as keyof typeof styles],
    styles[`${size}Text` as keyof typeof styles],
  ];

  return (
    <View style={containerStyles}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={textStyle}>{children}</Text>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 100,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '500',
  },

  // Size variants
  smContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  smText: {
    fontSize: 11,
  },
  mdContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mdText: {
    fontSize: 13,
  },

  // Color variants - Container
  defaultContainer: {
    backgroundColor: THEME_COLORS.divider,
  },
  primaryContainer: {
    backgroundColor: `${THEME_COLORS.primary}20`,
  },
  secondaryContainer: {
    backgroundColor: `${THEME_COLORS.secondary}20`,
  },
  successContainer: {
    backgroundColor: '#D1FAE5',
  },
  warningContainer: {
    backgroundColor: '#FEF3C7',
  },
  destructiveContainer: {
    backgroundColor: '#FEE2E2',
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },

  // Color variants - Text
  defaultText: {
    color: THEME_COLORS.textSecondary,
  },
  primaryText: {
    color: THEME_COLORS.primary,
  },
  secondaryText: {
    color: THEME_COLORS.secondary,
  },
  successText: {
    color: '#059669',
  },
  warningText: {
    color: '#D97706',
  },
  destructiveText: {
    color: THEME_COLORS.error,
  },
  outlineText: {
    color: THEME_COLORS.textSecondary,
  },
});
