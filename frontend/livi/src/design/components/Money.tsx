import React from 'react';
import { Text, TextStyle } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

/**
 * Formateur monétaire unique de l'app. Avant LIVI 2.0, chaque écran
 * financier formatait ses montants à sa façon (Number(x).toLocaleString(),
 * parfois sans gérer null/NaN) — voir RAPPORT_UXUI_SESSION21_AUDIT.md,
 * constat C9. Tous les nouveaux écrans doivent passer par formatMoney()
 * ou <Money /> plutôt que réimplémenter le formatage.
 */
export function formatMoney(amount: number | string | null | undefined, currency: string = 'FCFA'): string {
  const n = Number(amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = Math.round(safe).toLocaleString('fr-FR');
  return `${formatted} ${currency}`;
}

type Props = {
  amount: number | string | null | undefined;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  style?: TextStyle;
};

const SIZE_MAP = { sm: fontSize.base, md: fontSize.xl, lg: fontSize['2xl'], xl: fontSize['4xl'] } as const;

export function Money({ amount, currency = 'FCFA', size = 'md', color = colors.textPrimary, style }: Props) {
  return (
    <Text style={[{ fontFamily: fonts.brandSemibold, fontSize: SIZE_MAP[size], color }, style]}>
      {formatMoney(amount, currency)}
    </Text>
  );
}
