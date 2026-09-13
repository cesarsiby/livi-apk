import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { walletApi } from '../../features/wallet/walletApi';
import type { WalletTransaction } from '../../features/wallet/types';
import { Card, Money, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function TransactionDetailsScreen({ route }: any) {
  const id = String(route.params.transactionId);
  const [item, setItem] = useState<WalletTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    walletApi.getTransaction(id).then(setItem).catch((e: any) => setError(e?.message ?? 'Impossible de charger la transaction.'));
  }, [id]);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!item) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Transaction</Text>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Money amount={item.amount} currency={item.currency} size="lg" />
          <StatusBadge domain="escrow" status={item.status} />
        </View>
        {!!item.description && <Text style={styles.line}>{item.description}</Text>}
        <View style={styles.divider} />
        <Text style={styles.label}>Référence</Text>
        <Text style={styles.line}>{item.reference ?? item.id}</Text>
        {item.created_at ? (
          <>
            <Text style={styles.label}>Créée le</Text>
            <Text style={styles.line}>{new Date(item.created_at).toLocaleString('fr-FR')}</Text>
          </>
        ) : null}
        {item.completed_at ? (
          <>
            <Text style={styles.label}>Terminée le</Text>
            <Text style={styles.line}>{new Date(item.completed_at).toLocaleString('fr-FR')}</Text>
          </>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[5], backgroundColor: colors.dark },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  card: { padding: spacing[5], gap: spacing[2] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[2] },
  label: { fontFamily: fonts.bodyMedium, color: colors.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing[2] },
  line: { fontFamily: fonts.body, color: colors.textPrimary },
  error: { color: colors.red, fontFamily: fonts.body },
});
