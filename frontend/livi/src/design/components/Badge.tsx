import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius } from '../theme';

type Variant = 'gold' | 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'gray';

const VARIANT_STYLES: Record<Variant, { bg: string; text: string; border: string }> = {
  gold: { bg: colors.goldDim, text: colors.gold, border: colors.goldBorder },
  green: { bg: colors.greenDim, text: colors.green, border: colors.greenBorder },
  red: { bg: colors.redDim, text: colors.red, border: colors.redBorder },
  blue: { bg: colors.blueDim, text: colors.blue, border: colors.blueBorder },
  orange: { bg: colors.orangeDim, text: colors.orange, border: colors.orangeBorder },
  purple: { bg: colors.purpleDim, text: colors.purple, border: colors.purpleBorder },
  gray: { bg: 'rgba(138, 155, 176, 0.12)', text: colors.gray2, border: 'rgba(138, 155, 176, 0.2)' },
};

export function Badge({ label, variant = 'gray' }: { label: string; variant?: Variant }) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border }]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
  },
});
