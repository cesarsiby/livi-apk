import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme';

type Props = {
  icon?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Élément affiché avant le chevron, ex. un <Badge /> ou un point "non lu" */
  right?: React.ReactNode;
  danger?: boolean;
};

/**
 * Ligne "icône + titre + sous-titre + chevron" — le pattern était
 * réimplémenté à la main dans ProfileScreen, SellerDashboardScreen,
 * TransporterDashboardScreen et BuyerDashboardScreen, à chaque fois avec
 * de légères variations de padding/couleur. Un seul composant désormais.
 */
export function ActionRow({ icon, title, subtitle, onPress, right, danger }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, danger && styles.dangerText]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[3], gap: spacing[3] },
  pressed: { opacity: 0.6 },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.dark4, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: fontSize.lg },
  title: { fontFamily: fonts.bodySemibold, fontSize: fontSize.base, color: colors.textPrimary },
  dangerText: { color: colors.red },
  subtitle: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: fontSize.xl, color: colors.textMuted, marginLeft: spacing[1] },
});
