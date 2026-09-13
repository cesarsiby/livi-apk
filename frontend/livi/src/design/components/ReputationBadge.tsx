import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ratingsApi } from '../../features/ratings/ratingsApi';
import { colors, fonts, fontSize, spacing } from '../theme';

// V54 (RAPPORT — "SYSTÈME DE NOTATION"): "affichage de la réputation sur le
// profil" — GET /ratings/:userId existed with nothing anywhere rendering
// it. Renders nothing (not "0.0 ★ · 0 avis", which would look broken) until
// there's at least one rating — a person or shop with zero ratings isn't
// the same as one with a bad rating.
export function ReputationBadge({ userId, style }: { userId: string; style?: any }) {
  const [rep, setRep] = useState<{ average: number; count: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    ratingsApi.reputation(userId).then((r) => { if (!cancelled) setRep(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  if (!rep || rep.count === 0) return null;

  return (
    <View style={[styles.row, style]}>
      <Text style={styles.star}>★</Text>
      <Text style={styles.text}>{rep.average.toFixed(1)} · {rep.count} avis</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { color: colors.gold, fontSize: fontSize.base },
  text: { fontFamily: fonts.bodySemibold, color: colors.gray2, fontSize: fontSize.sm },
});
