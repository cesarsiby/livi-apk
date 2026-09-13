import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { transporterApi } from '../../features/transporter/transporterApi';
import { normalizeList } from '../../services/api/normalize';
import { Card, EmptyState, Skeleton, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, feuille de route priorité 1) : deux
// corrections.
// - Constat C0 : GET /transporter/history renvoie un tableau brut
//   (routes/compatibility.js, `ok(res, rows)`, SELECT * FROM shipments) —
//   corrigé avec normalizeList().
// - La table shipments n'a pas de colonne `reference` — `tracking_code`
//   est le vrai identifiant lisible. `status` passe maintenant par
//   StatusBadge (domaine "delivery", aligné sur le vrai enum shipments.status).
export function DeliveryHistoryScreen({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const r = await transporterApi.history({ limit: 50 });
      setItems(normalizeList<any>(r, ['missions', 'deliveries', 'history', 'data']));
    } catch (e: any) { setError(e?.message ?? "Impossible de charger l'historique."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={s.list}>
        <Skeleton height={90} radius={radius.lg} />
        <Skeleton height={90} radius={radius.lg} />
      </View>
    );
  }

  return (
    <FlatList
      style={s.screen}
      data={items}
      keyExtractor={(x, i) => String(x.id ?? i)}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListEmptyComponent={<EmptyState icon="🗂️" title="Aucune livraison terminée" description={error || 'Vos livraisons passées apparaîtront ici.'} />}
      renderItem={({ item }) => (
        <Pressable onPress={() => item.id && navigation.navigate('MissionDetails', { missionId: item.id })}>
          <Card style={s.card}>
            <View style={s.row}>
              <Text style={s.title}>{item.tracking_code ?? `Livraison #${String(item.id ?? '').slice(0, 8)}`}</Text>
              <StatusBadge domain="delivery" status={item.status} />
            </View>
            <Text style={s.meta}>{item.delivered_at ? new Date(item.delivered_at).toLocaleDateString('fr-FR') : 'Date inconnue'}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  card: { padding: spacing[4], gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  title: { fontSize: fontSize.base, fontFamily: fonts.brandSemibold, color: colors.textPrimary, flexShrink: 1 },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
});
