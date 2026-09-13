import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, fonts, fontSize, radius, shadow, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'green' | 'red' | 'blue';
type Size = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

const VARIANT_STYLES: Record<Variant, { bg: string; text: string; border?: string; shadowStyle?: object }> = {
  primary: { bg: colors.gold, text: colors.dark, shadowStyle: shadow.gold },
  secondary: { bg: colors.dark4, text: colors.gray2, border: colors.border },
  outline: { bg: 'transparent', text: colors.gray2, border: colors.border },
  ghost: { bg: 'transparent', text: colors.gray2 },
  green: { bg: colors.green, text: colors.dark, shadowStyle: shadow.green },
  red: { bg: colors.red, text: colors.white },
  blue: { bg: colors.blue, text: colors.white },
};

const SIZE_STYLES: Record<Size, { paddingV: number; paddingH: number; fontSize: number }> = {
  sm: { paddingV: spacing[2], paddingH: spacing[4], fontSize: fontSize.sm },
  md: { paddingV: spacing[3], paddingH: spacing[6], fontSize: fontSize.base },
  lg: { paddingV: spacing[4], paddingH: spacing[8], fontSize: fontSize.md },
  xl: { paddingV: spacing[5], paddingH: spacing[10], fontSize: fontSize.lg },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: Props) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        v.shadowStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[styles.text, { color: v.text, fontSize: s.fontSize }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontFamily: fonts.bodySemibold,
    fontWeight: '600',
  },
});
