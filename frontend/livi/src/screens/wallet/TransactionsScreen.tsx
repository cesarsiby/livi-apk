import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { walletApi } from '../../features/wallet/walletApi';
import type { WalletTransaction, TransactionListResponse } from '../../features/wallet/types';
import { Card, EmptyState, Money, Skeleton, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

function normalize(response: TransactionListResponse): WalletTransaction[] {
  if (Array.isArray(response)) return response;
  return response.data ?? response.items ?? response.transactions ?? [];
}

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, constat C8/C9) : `{item.type} ·
// {item.status}` affichait la valeur technique brute du statut, et cet
// écran avait sa propre fonction money() locale (une 4e implémentation du
// même formateur dans l'app). StatusBadge + Money remplacent les deux.
export function TransactionsScreen({ navigation }: any) {
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      setItems(normalize(await walletApi.listTransactions({ page: 1, limit: 50 })));
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les transactions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.loadingList}>
        <Text style={styles.title}>Transactions</Text>
        <Skeleton height={90} radius={radius.xl} />
        <Skeleton height={90} radius={radius.xl} />
        <Skeleton height={90} radius={radius.xl} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Transactions</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      }
      ListEmptyComponent={<EmptyState icon="🧾" title="Aucune transaction" description="Vos paiements, ventes et retraits apparaîtront ici." />}
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate('TransactionDetails', { transactionId: item.id })}>
          <Card style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.reference} numberOfLines={1}>{item.description || item.reference || 'Transaction'}</Text>
              <StatusBadge domain="escrow" status={item.status} />
            </View>
            <View style={styles.top}>
              <Text style={styles.meta}>{item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : ''}</Text>
              <Money amount={item.amount} currency={item.currency} size="sm" />
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[3], flexGrow: 1 },
  loadingList: { flex: 1, backgroundColor: colors.dark, padding: spacing[5], gap: spacing[3] },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary, marginBottom: spacing[2] },
  card: { padding: spacing[4], gap: spacing[2], marginBottom: spacing[3] },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  reference: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, flex: 1 },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  error: { color: colors.red, fontFamily: fonts.body },
});
