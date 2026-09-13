import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { walletApi } from '../../features/wallet/walletApi';
import type { Withdrawal, WithdrawalListResponse } from '../../features/wallet/types';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

function normalize(response: WithdrawalListResponse): Withdrawal[] {
  if (Array.isArray(response)) return response;
  return response.data ?? response.items ?? response.withdrawals ?? [];
}

function money(value?: number, currency?: string) {
  if (typeof value !== 'number') return '—';
  const formatted = new Intl.NumberFormat('fr-FR').format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

export function WithdrawalDetailsScreen({ route }: any) {
  const withdrawalId = route.params?.withdrawalId as string | undefined;
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [detail, setDetail] = useState<Withdrawal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      if (withdrawalId) setDetail(await walletApi.getWithdrawal(withdrawalId));
      else setItems(normalize(await walletApi.listWithdrawals({ page: 1, limit: 50 })));
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les retraits.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [withdrawalId]);

  useEffect(() => { load(); }, [load]);

  if (withdrawalId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Détail du retrait</Text>
        {loading ? <ActivityIndicator color={colors.gold} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {detail ? (
          <Card style={styles.card}>
            <Text style={styles.amount}>{money(detail.amount, detail.currency)}</Text>
            <Text style={styles.line}>Référence : {detail.reference ?? detail.id}</Text>
            <Text style={styles.line}>Statut : {detail.status ?? '—'}</Text>
            <Text style={styles.line}>Frais : {money(detail.fee, detail.currency)}</Text>
            <Text style={styles.line}>Net : {money(detail.net_amount, detail.currency)}</Text>
            <Text style={styles.line}>Créé le : {detail.created_at ?? '—'}</Text>
            <Text style={styles.line}>Mis à jour le : {detail.updated_at ?? '—'}</Text>
            {detail.failure_reason ? <Text style={styles.line}>Motif : {detail.failure_reason}</Text> : null}
          </Card>
        ) : null}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Retraits</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={colors.gold} /> : null}
        </>
      }
      ListEmptyComponent={!loading ? <Text style={styles.empty}>Aucun retrait retourné par le serveur.</Text> : null}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Text style={styles.amount}>{money(item.amount, item.currency)}</Text>
          <Text style={styles.line}>Référence : {item.reference ?? item.id}</Text>
          <Text style={styles.line}>Statut : {item.status ?? '—'}</Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[3] },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary, marginBottom: spacing[2] },
  card: { padding: spacing[4], gap: spacing[2], marginBottom: spacing[3] },
  amount: { fontSize: fontSize.xl, fontFamily: fonts.brandSemibold, color: colors.gold },
  line: { fontFamily: fonts.body, color: colors.gray2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing[8], fontFamily: fonts.body },
  error: { color: colors.red, fontFamily: fonts.body },
});
