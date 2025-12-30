/**
 * Button Component
 * Primary button component with multiple variants
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { THEME_COLORS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// ============================================================================
// Component
// ============================================================================

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  const containerStyles: ViewStyle[] = [
    styles.base,
    styles[`${variant}Container` as keyof typeof styles] as ViewStyle,
    styles[`${size}Container` as keyof typeof styles] as ViewStyle,
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.text,
    styles[`${variant}Text` as keyof typeof styles] as TextStyle,
    styles[`${size}Text` as keyof typeof styles] as TextStyle,
    isDisabled && styles.disabledText,
    textStyle,
  ].filter(Boolean) as TextStyle[];

  return (
    <Pressable
      style={({ pressed }) => [
        ...containerStyles,
        pressed && !isDisabled && styles.pressed,
      ]}
      disabled={isDisabled}
      {...props}
    >
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? '#FFFFFF' : THEME_COLORS.primary}
          />
        ) : (
          <>
            {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
            <Text style={textStyles}>{children}</Text>
            {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
          </>
        )}
      </View>
    </Pressable>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants - Container
  primaryContainer: {
    backgroundColor: THEME_COLORS.primary,
  },
  secondaryContainer: {
    backgroundColor: THEME_COLORS.secondary,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: THEME_COLORS.primary,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  destructiveContainer: {
    backgroundColor: THEME_COLORS.error,
  },

  // Variants - Text
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: THEME_COLORS.primary,
  },
  ghostText: {
    color: THEME_COLORS.primary,
  },
  destructiveText: {
    color: '#FFFFFF',
  },

  // Sizes - Container
  smContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mdContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lgContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
  },

  // Sizes - Text
  text: {
    fontWeight: '600',
  },
  smText: {
    fontSize: 14,
  },
  mdText: {
    fontSize: 16,
  },
  lgText: {
    fontSize: 18,
  },

  disabledText: {
    opacity: 0.7,
  },

  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
