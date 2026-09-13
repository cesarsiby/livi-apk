import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Card } from './Card';
import { colors, fonts, fontSize, radius, spacing } from '../theme';

type Props = {
  title: string;
  helperText: string;
  pin: string;
  qrPayload: string;
  expiresAt?: string;
};

function formatExpiry(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} à ${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

// Shown to the Seller (seller_pickup) and the Buyer (buyer_delivery) so they
// can present their code — as a QR to scan, or the 6-digit PIN read aloud —
// to the Transporter. Purely presentational: the screen using this owns the
// fetch/loading/error handling and only renders this once a proof is loaded.
export function ProofDisplay({ title, helperText, pin, qrPayload, expiresAt }: Props) {
  const expiry = formatExpiry(expiresAt);
  return (
    <Card style={styles.card}>
      <Text style={styles.title} maxFontSizeMultiplier={1.6}>{title}</Text>
      <View style={styles.qrWrap}>
        <QRCode value={qrPayload} size={176} backgroundColor={colors.white} color={colors.dark} />
      </View>
      <Text style={styles.pinLabel} maxFontSizeMultiplier={1.6}>Code à 6 chiffres</Text>
      <Text style={styles.pin} maxFontSizeMultiplier={1.3} selectable numberOfLines={1} adjustsFontSizeToFit>
        {pin}
      </Text>
      <Text style={styles.helper} maxFontSizeMultiplier={1.8}>{helperText}</Text>
      {expiry ? (
        <Text style={styles.expiry} maxFontSizeMultiplier={1.8}>Valable jusqu'au {expiry}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing[2] },
  title: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
    color: colors.white,
    textAlign: 'center',
  },
  qrWrap: {
    backgroundColor: colors.white,
    padding: spacing[3],
    borderRadius: radius.md,
    marginVertical: spacing[2],
  },
  pinLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.gray2,
  },
  pin: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize['3xl'],
    letterSpacing: 6,
    color: colors.gold,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.gray2,
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  expiry: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.gray,
    textAlign: 'center',
  },
});
