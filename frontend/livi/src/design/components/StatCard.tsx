import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme';

type Trend = { value: string; positive?: boolean };
type Accent = 'gold' | 'green' | 'blue';

type Props = {
  label: string;
  value: string;
  icon?: string;
  trend?: Trend;
  accent?: Accent;
};

const ACCENT_COLOR: Record<Accent, string> = { gold: colors.gold, green: colors.green, blue: colors.blue };

/**
 * Chaque StatCard doit répondre à une question précise (revenu ? commandes ?
 * évolution ?) — pas être posée juste pour occuper l'espace. Voir
 * RAPPORT_UXUI_SESSION21_STRATEGIE.md §12 "Statistiques vraiment utiles".
 */
export function StatCard({ label, value, icon, trend, accent = 'gold' }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: ACCENT_COLOR[accent] }]} numberOfLines={1}>{value}</Text>
      {trend ? (
        <Text style={[styles.trend, { color: trend.positive ? colors.green : colors.textMuted }]}>
          {trend.positive ? '↑ ' : ''}{trend.value}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.dark3, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing[4], gap: 6, minWidth: 140 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: fontSize.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 1 },
  value: { fontFamily: fonts.brandSemibold, fontSize: fontSize.xl },
  trend: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs },
});
