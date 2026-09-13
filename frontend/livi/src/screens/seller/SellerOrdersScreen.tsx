import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { sellerApi, SellerOrder } from '../../features/seller/sellerApi';
import { normalizeList } from '../../services/api/normalize';
import { EmptyState, OrderCard, Skeleton } from '../../design/components';
import { colors, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21) : deux corrections + alignement design
// system sur le même écran.
// - Constat C0 : `r?.orders ?? r?.data ?? []` ne fonctionnait jamais (GET
//   /vendor/orders renvoie un tableau brut une fois déballé) — remplacé par
//   normalizeList().
// - Constat C0-bis : `item.total` est toujours undefined, la vraie colonne
//   est total_amount — le type SellerOrder déclarait déjà les deux, seul
//   l'écran lisait le mauvais champ. OrderCard applique déjà le bon repli.
export function SellerOrdersScreen({ navigation }: any) {
  const [items, setItems] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback((isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    sellerApi.orders({ limit: 50 })
      .then((r) => setItems(normalizeList<SellerOrder>(r, ['orders', 'data'])))
      .catch((e) => setError(e?.message ?? 'Erreur de chargement.'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.loadingList}>
        <Skeleton height={110} radius={radius.xl} />
        <Skeleton height={110} radius={radius.xl} />
        <Skeleton height={110} radius={radius.xl} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(x) => String(x.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListEmptyComponent={
        <EmptyState
          icon="📦"
          title="Aucune commande pour l'instant"
          description={error || 'Les commandes reçues sur votre boutique apparaîtront ici.'}
        />
      }
      renderItem={({ item }) => (
        <OrderCard order={item as any} onPress={() => navigation.navigate('SellerOrderDetails', { orderId: item.id })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  loadingList: { flex: 1, backgroundColor: colors.dark, padding: spacing[4], gap: spacing[3] },
});
