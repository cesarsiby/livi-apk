import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { buyerApi } from '../../features/buyer/buyerApi';
import { normalizeList } from '../../services/api/normalize';
import { Card, EmptyState, Money, Skeleton, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, feuille de route priorité 1) : deux
// corrections.
// - Constat C0 : GET /orders/refunds renvoie un tableau brut (routes/
//   compatibility.js, `ok(res, rows)`) — corrigé avec normalizeList().
// - La requête SQL réelle (`SELECT e.id, e.order_id, e.amount,
//   e.shipping_fee, e.status, e.refunded_at FROM escrow_transactions…`) ne
//   renvoie NI reference/order_reference, NI reason, NI created_at. Ces
//   champs étaient lus quand même et affichaient "—" en permanence. Retiré
//   le "Motif" (aucune donnée ne peut jamais l'alimenter) plutôt que de
//   garder un champ structurellement toujours vide ; utilisé order_id et
//   refunded_at, les vrais champs disponibles.
export function RefundsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    buyerApi.refunds()
      .then((r) => setItems(normalizeList<any>(r, ['refunds', 'data'])))
      .catch(() => setItems([]))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={s.list}>
        <Skeleton height={100} radius={radius.xl} />
        <Skeleton height={100} radius={radius.xl} />
      </View>
    );
  }

  return (
    <FlatList
      style={s.screen}
      data={items}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListEmptyComponent={<EmptyState icon="↩️" title="Aucun remboursement" description="Les remboursements liés à vos commandes apparaîtront ici." />}
      renderItem={({ item }) => (
        <Card style={s.card}>
          <View style={s.row}>
            <Text style={s.title}>Commande #{String(item.order_id ?? item.id ?? '').slice(0, 8)}</Text>
            <StatusBadge domain="escrow" status={item.status} />
          </View>
          <Money amount={item.amount} currency={item.currency ?? 'FCFA'} size="sm" color={colors.gold} />
          {item.refunded_at ? <Text style={s.meta}>Remboursé le {new Date(item.refunded_at).toLocaleDateString('fr-FR')}</Text> : null}
        </Card>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  card: { padding: spacing[4], gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.brandSemibold, fontSize: fontSize.base, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
});
