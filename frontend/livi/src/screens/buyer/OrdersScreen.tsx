import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ordersApi, Order } from '../../features/orders/ordersApi';
import { normalizeList } from '../../services/api/normalize';
import { EmptyState, OrderCard, Skeleton } from '../../design/components';
import { colors, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, constat C0 — CORRECTIF CRITIQUE) :
// `r?.orders ?? r?.data ?? []` ne fonctionnait jamais — GET /orders renvoie
// un tableau brut une fois déballé par apiRequest() (voir routes/orders.js,
// `ok(res, rows)`), donc `.orders` et `.data` valaient toujours undefined
// et cet écran affichait "Aucune commande" en permanence, quel que soit le
// véritable historique de l'acheteur. Remplacé par normalizeList(), qui
// vérifie d'abord si la réponse est déjà un tableau. Passage à OrderCard +
// StatusBadge au passage plutôt que le statut technique brut affiché tel
// quel ("Statut : shipping").
export function OrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    ordersApi.list({ limit: 30 })
      .then((r) => setOrders(normalizeList<Order>(r, ['orders', 'data'])))
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
      data={orders}
      keyExtractor={(x) => String(x.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListEmptyComponent={
        <EmptyState
          icon="📦"
          title="Aucune commande pour l'instant"
          description="Vos commandes en cours et passées apparaîtront ici."
          actionLabel="Parcourir le catalogue"
          onAction={() => navigation.navigate('Catalogue')}
        />
      }
      renderItem={({ item }) => (
        <OrderCard order={item} onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  loadingList: { flex: 1, backgroundColor: colors.dark, padding: spacing[4], gap: spacing[3] },
});
