import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { sellerApi } from '../../features/seller/sellerApi';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function AnalyticsScreen() {
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    sellerApi.analytics(period).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [period]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.gold} /></View>;

  const m = data?.metrics ?? data?.summary ?? {};
  const products = data?.top_products ?? data?.products ?? [];
  const cards: [string, any][] = [['CA', m.revenue], ['Ventes', m.sales], ['Commandes', m.orders], ['Panier moyen', m.average_order_value]];
  const labels: Record<string, string> = { week: 'Semaine', month: 'Mois', all: 'Tout' };

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />} contentContainerStyle={s.container}>
      <Text style={s.title}>Statistiques vendeur</Text>
      <View style={s.tabs}>
        {['week', 'month', 'all'].map((p) => (
          <Pressable key={p} style={[s.tab, period === p && s.active]} onPress={() => setPeriod(p)}>
            <Text style={period === p ? s.activeText : s.tabText}>{labels[p]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.grid}>
        {cards.map(([a, b]) => (
          <Card key={String(a)} style={s.card}>
            <Text style={s.muted} maxFontSizeMultiplier={1.6} numberOfLines={2}>{a}</Text>
            <Text style={s.value} maxFontSizeMultiplier={1.6} numberOfLines={1} adjustsFontSizeToFit>{b == null ? '—' : String(b)}</Text>
          </Card>
        ))}
      </View>
      <Text style={s.section}>Meilleurs produits</Text>
      {products.length ? products.map((p: any, i: number) => (
        <Card key={String(p.id ?? i)} style={s.row}>
          <Text style={s.rank}>{p.rank ?? i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{p.name ?? 'Produit'}</Text>
            <Text style={s.muted}>{p.sales ?? 0} vente(s)</Text>
          </View>
          <Text style={s.amount}>{p.revenue == null ? '—' : `${Number(p.revenue).toLocaleString()} FCFA`}</Text>
        </Card>
      )) : <Text style={s.empty}>Aucune donnée pour cette période.</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  container: { padding: spacing[4], gap: spacing[3] },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  tabs: { flexDirection: 'row', gap: spacing[2] },
  tab: { padding: spacing[3], borderRadius: radius.md, backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border },
  active: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.gray2, fontFamily: fonts.bodyMedium },
  activeText: { color: colors.dark, fontFamily: fonts.bodyBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  card: { width: '47%', padding: spacing[4], minWidth: 130 },
  muted: { color: colors.gray2, fontFamily: fonts.body, flexShrink: 1, flexWrap: 'wrap' },
  value: { fontSize: fontSize.xl, fontFamily: fonts.brandSemibold, marginTop: 5, color: colors.gold, flexShrink: 1, flexWrap: 'wrap' },
  section: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, marginTop: spacing[3], color: colors.textPrimary },
  row: { padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rank: { fontFamily: fonts.bodyBold, color: colors.gold },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  amount: { fontFamily: fonts.bodyBold, color: colors.gold },
  empty: { padding: spacing[8], textAlign: 'center', color: colors.textMuted, fontFamily: fonts.body },
});
