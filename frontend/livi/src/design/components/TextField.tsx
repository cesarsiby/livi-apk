import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme';

type Props = TextInputProps & {
  label?: string;
  required?: boolean;
  error?: string;
  icon?: string; // emoji or short glyph, matches .input-wrap__icon pattern
};

export function TextField({ label, required, error, icon, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.redBorder : focused ? colors.goldBorder : colors.border;

  return (
    <View style={styles.group}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <View style={[styles.inputWrap, { borderColor }]}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, icon ? styles.inputWithIcon : null, style]}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing[2],
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  required: {
    color: colors.red,
  },
  inputWrap: {
    backgroundColor: colors.dark3,
    borderWidth: 1.5,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: fontSize.md,
    marginLeft: spacing[3],
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  inputWithIcon: {
    paddingLeft: spacing[2],
  },
  error: {
    color: colors.red,
    fontSize: fontSize.sm,
    fontFamily: fonts.body,
  },
});
