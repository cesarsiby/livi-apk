import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { liveApi } from '../../features/live/liveApi';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function CreatorToolsScreen() {
  const [sub, setSub] = useState<any[]>([]);
  useEffect(() => { liveApi.vendorSubscriptions().then((d) => setSub(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  return (
    <View style={s.c}>
      <Text style={s.h}>Creator Tools</Text>
      <Card style={s.card}>
        <Text style={s.big}>{sub.length}</Text>
        <Text style={s.meta}>Abonnés</Text>
      </Card>
      <Text style={s.body}>Créez du contenu, publiez vos vidéos et utilisez les produits LIVI associés.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, padding: spacing[5], gap: spacing[4], backgroundColor: colors.dark },
  h: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  card: { padding: spacing[5] },
  big: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.gold },
  meta: { fontFamily: fonts.body, color: colors.gray2 },
  body: { fontFamily: fonts.body, color: colors.gray2 },
});
