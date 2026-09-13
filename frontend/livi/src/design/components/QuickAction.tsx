import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme';

type Props = {
  icon: string;
  label: string;
  badge?: string;
  onPress?: () => void;
};

/**
 * Tuile compacte icône + libellé, pensée pour une rangée de 3-4 raccourcis
 * (accueil, dashboards). Différent d'ActionRow (ligne pleine largeur pour
 * des listes) — QuickAction est pour une grille dense d'actions fréquentes.
 */
export function QuickAction({ icon, label, badge, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, alignItems: 'center', gap: spacing[2] },
  pressed: { opacity: 0.7 },
  iconWrap: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: fontSize.xl },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: radius.full, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.dark },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
});
