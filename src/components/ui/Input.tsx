/**
 * Input Component
 * Text input with validation and error states
 */

import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { THEME_COLORS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      containerStyle,
      isPassword = false,
      secureTextEntry,
      editable = true,
      style,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const hasError = Boolean(error);
    const isSecure = isPassword && !showPassword;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}

        <View
          style={[
            styles.inputContainer,
            isFocused && styles.inputFocused,
            hasError && styles.inputError,
            !editable && styles.inputDisabled,
          ]}
        >
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon && styles.inputWithLeftIcon,
              (rightIcon || isPassword) && styles.inputWithRightIcon,
              style,
            ]}
            placeholderTextColor={THEME_COLORS.textMuted}
            secureTextEntry={secureTextEntry ?? isSecure}
            editable={editable}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {isPassword && (
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.iconRight}
            >
              <Text style={styles.showHideText}>
                {showPassword ? 'Скрыть' : 'Показать'}
              </Text>
            </Pressable>
          )}

          {rightIcon && !isPassword && (
            <View style={styles.iconRight}>{rightIcon}</View>
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {hint && !error && <Text style={styles.hintText}>{hint}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME_COLORS.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: THEME_COLORS.border,
  },
  inputFocused: {
    borderColor: THEME_COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: THEME_COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  inputDisabled: {
    backgroundColor: THEME_COLORS.divider,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  iconLeft: {
    paddingLeft: 14,
  },
  iconRight: {
    paddingRight: 14,
  },
  showHideText: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: THEME_COLORS.error,
    marginTop: 4,
    marginLeft: 4,
  },
  hintText: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 4,
    marginLeft: 4,
  },
});
