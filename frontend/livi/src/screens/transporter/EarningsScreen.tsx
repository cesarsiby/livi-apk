import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { transporterApi } from '../../features/transporter/transporterApi';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function EarningsScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await transporterApi.earnings({ period: 'month' });
      setData(r?.data ?? r);
    } catch (e: any) { Alert.alert('Revenus', e?.message ?? 'Erreur.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.gold} /></View>;

  const rows = data?.payouts ?? [];

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />}
    >
      <Text style={s.title}>Mes revenus</Text>
      <View style={s.hero}>
        <Text style={s.muted}>Total versé ({data?.payout_count ?? 0} versement{Number(data?.payout_count ?? 0) > 1 ? 's' : ''})</Text>
        <Text style={s.amount}>{String(data?.gross_payable_xof ?? '—')} FCFA</Text>
      </View>
      <Text style={s.section}>Détail</Text>
      {!rows.length ? <Text style={s.muted}>Aucun versement pour l'instant.</Text> : rows.map((x: any, i: number) => (
        <Card key={String(x.id ?? i)} style={s.row}>
          <View>
            <Text style={s.bold}>Versement {x.reference ?? `#${i + 1}`}</Text>
            <Text style={s.muted}>{x.paid_at ?? x.created_at ?? '—'}</Text>
          </View>
          <Text style={s.bold}>{String(x.amount ?? '—')} {x.currency ?? 'FCFA'}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  hero: { backgroundColor: colors.dark3, borderRadius: radius.xl, padding: spacing[6], gap: 6, borderWidth: 1, borderColor: colors.goldBorder },
  amount: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.gold },
  section: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  row: { padding: spacing[4], flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  muted: { color: colors.textMuted, fontFamily: fonts.body },
});
