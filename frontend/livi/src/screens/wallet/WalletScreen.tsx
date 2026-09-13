import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useWalletStore } from '../../features/wallet/walletStore';
import { walletApi } from '../../features/wallet/walletApi';
import { useAuth } from '../../features/auth/AuthProvider';
import type { WalletTransaction, TransactionListResponse } from '../../features/wallet/types';
import { EmptyState, Money, QuickAction, SectionHeader, Skeleton, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// ═══════════════════════════════════════════════════════════════
// LIVI 2.0 — Wallet (RAPPORT_UXUI_SESSION21)
//
// CORRECTIF CRITIQUE post-livraison initiale (constat C0-quater) :
// GET /escrow/balance (routes/escrow.js) ne renvoie JAMAIS balance,
// available_balance ni pending_balance — la version précédente de cet
// écran, livrée plus tôt cette session, affichait donc "0 FCFA"
// disponible pour tout le monde, tout le temps. Les vrais champs sont
// available_amount / locked_amount / owed_total (vendeur/transporteur) ou
// available_amount ('0' fixe) / locked_amount / active_order_count
// (acheteur) — un acheteur n'a structurellement PAS de solde retirable,
// seulement des fonds en cours de protection. L'écran distingue donc
// maintenant les deux cas plutôt que d'afficher la même carte pour tous.
// ═══════════════════════════════════════════════════════════════

function normalizeTransactions(response: TransactionListResponse): WalletTransaction[] {
  if (Array.isArray(response)) return response;
  return response.data ?? response.items ?? response.transactions ?? [];
}

export function WalletScreen({ navigation }: any) {
  const { user } = useAuth();
  const isPayable = user?.role === 'vendor' || user?.role === 'transporter';
  const { wallet, loading: walletLoading, error, refresh } = useWalletStore();
  const [recent, setRecent] = useState<WalletTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setTxLoading(true);
    try {
      const res = await walletApi.listTransactions({ page: 1, limit: 5 });
      setRecent(normalizeTransactions(res));
    } catch {
      // L'aperçu reste vide plutôt que de bloquer tout l'écran Wallet.
    } finally {
      setTxLoading(false);
      setRefreshing(false);
    }
    await refresh();
  }, [refresh]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const currency = wallet?.currency ?? 'FCFA';
  const available = Number(wallet?.available_amount ?? 0);
  const locked = Number(wallet?.locked_amount ?? 0);
  const owed = wallet?.owed_total != null ? Number(wallet.owed_total) : null;
  const activeOrders = wallet?.active_order_count;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
    >
      <Text style={styles.title}>Wallet</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {walletLoading && !wallet ? (
        <Skeleton height={140} radius={radius.xl} />
      ) : isPayable ? (
        // Vendeur / transporteur : available_amount est un vrai solde retirable.
        <View style={styles.balanceCard}>
          <Text style={styles.label}>Solde disponible</Text>
          <Money amount={available} currency={currency} size="xl" color={colors.gold} style={styles.balance} />
          {locked > 0 || owed ? (
            <View style={styles.pendingRow}>
              {locked > 0 ? (
                <Text style={styles.pendingLabel}>
                  <Money amount={locked} currency={currency} size="sm" color={colors.textPrimary} /> en attente de libération
                </Text>
              ) : null}
              {owed ? (
                <Text style={styles.pendingLabel}>
                  <Money amount={owed} currency={currency} size="sm" color={colors.textPrimary} /> dû au total
                </Text>
              ) : null}
              <Text style={styles.pendingHelper}>Les fonds en attente sont protégés jusqu'à la confirmation de réception par l'acheteur.</Text>
            </View>
          ) : null}
        </View>
      ) : (
        // Acheteur : pas de solde retirable (available_amount vaut toujours
        // '0' pour ce rôle côté serveur) — le nombre qui compte est ce qui
        // est actuellement protégé par l'escrow, pas un "disponible" fictif.
        <View style={styles.balanceCard}>
          <Text style={styles.label}>Fonds actuellement protégés</Text>
          <Money amount={locked} currency={currency} size="xl" color={colors.gold} style={styles.balance} />
          <Text style={styles.pendingHelper}>
            {locked > 0
              ? `Répartis sur ${activeOrders ?? 'vos'} commande${activeOrders && activeOrders > 1 ? 's' : ''} en cours — l'argent est reversé au vendeur dès que vous confirmez la réception.`
              : "Aucune somme en cours de protection pour l'instant."}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {isPayable ? (
          <>
            <QuickAction icon="↗️" label="Retirer" onPress={() => navigation.navigate('Withdraw')} />
            <QuickAction icon="🧾" label="Retraits" onPress={() => navigation.navigate('WithdrawalDetails')} />
            <QuickAction icon="🔒" label="Protection" onPress={() => navigation.navigate('Escrow')} />
          </>
        ) : (
          <>
            <QuickAction icon="🔒" label="Protection" onPress={() => navigation.navigate('Escrow')} />
            <QuickAction icon="↘️" label="Déposer" onPress={() => navigation.navigate('Deposit')} />
            <QuickAction icon="↩️" label="Remboursements" onPress={() => navigation.navigate('Refunds')} />
          </>
        )}
      </View>

      <View>
        <SectionHeader title="Transactions récentes" actionLabel="Tout voir" onAction={() => navigation.navigate('Transactions')} />
        {txLoading ? (
          <View style={{ gap: spacing[2] }}>
            <Skeleton height={64} radius={radius.md} />
            <Skeleton height={64} radius={radius.md} />
          </View>
        ) : recent.length === 0 ? (
          <EmptyState icon="🧾" title="Aucune transaction pour l'instant" description="Vos paiements, ventes et retraits apparaîtront ici dès qu'il y en aura." />
        ) : (
          <View style={{ gap: spacing[2] }}>
            {recent.map(tx => (
              <Pressable key={tx.id} style={styles.txRow} onPress={() => navigation.navigate('TransactionDetails', { transactionId: tx.id })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDescription} numberOfLines={1}>{tx.description || tx.reference || 'Transaction'}</Text>
                  <Text style={styles.txDate}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString('fr-FR') : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Money amount={tx.amount} currency={tx.currency ?? currency} size="sm" />
                  <StatusBadge domain="escrow" status={tx.status} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.note}>Le solde et l'historique proviennent directement de nos serveurs, à jour en temps réel.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[5], paddingBottom: spacing[12] },
  title: { fontFamily: fonts.brand, fontSize: fontSize['3xl'], color: colors.textPrimary },
  error: { color: colors.red, fontFamily: fonts.body },
  balanceCard: { padding: spacing[6], borderRadius: radius.xl, backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.goldBorder, gap: spacing[1] },
  label: { fontFamily: fonts.body, color: colors.textMuted, fontSize: fontSize.xs },
  balance: { marginTop: spacing[1] },
  pendingRow: { marginTop: spacing[4], paddingTop: spacing[4], borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  pendingLabel: { fontFamily: fonts.body, color: colors.textPrimary, fontSize: fontSize.sm },
  pendingHelper: { fontFamily: fonts.body, color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: spacing[3] },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], gap: spacing[3] },
  txDescription: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: fontSize.sm },
  txDate: { fontFamily: fonts.body, color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  note: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18, fontFamily: fonts.body, textAlign: 'center' },
});
