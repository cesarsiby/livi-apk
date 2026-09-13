import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, fontSize, spacing } from '../theme';
import { Button } from './Button';

type Props = {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

/**
 * État vide standard de l'app. Règle LIVI 2.0 : jamais de page blanche, et
 * jamais de nouvelle donnée fictive juste pour "remplir" un écran — voir
 * RAPPORT_UXUI_SESSION21_STRATEGIE.md §7. Quand les données réelles
 * manquent, ceci est la réponse.
 */
export function EmptyState({ icon = '📦', title, description, actionLabel, onAction, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="outline" size="md" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[12], paddingHorizontal: spacing[6], gap: spacing[2] },
  icon: { fontSize: 40, marginBottom: spacing[2] },
  title: { fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, color: colors.textPrimary, textAlign: 'center' },
  description: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  action: { marginTop: spacing[4] },
});
