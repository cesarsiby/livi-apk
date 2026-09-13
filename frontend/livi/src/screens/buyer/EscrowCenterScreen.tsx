import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { escrowApi } from '../../features/escrow/escrowApi';
import { useAuth } from '../../features/auth/AuthProvider';
import { normalizeList } from '../../services/api/normalize';
import { EmptyState, Money, Skeleton, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// ═══════════════════════════════════════════════════════════════
// LIVI 2.0 — Centre de protection / Escrow (RAPPORT_UXUI_SESSION21)
//
// Trois corrections sur cet écran :
// - Constat C0 : GET /escrow/transactions renvoie un tableau brut
//   (routes/escrow.js, `ok(res, rows)`) — `t?.transactions ?? t?.data ?? []`
//   ne fonctionnait jamais. Corrigé avec normalizeList().
// - Constat C0-quater (le même bug que Wallet, découvert en le corrigeant) :
//   escrowApi.dashboard() et escrowApi.balance() appellent tous les deux
//   /escrow/balance — c'est littéralement le MÊME appel réseau fait deux
//   fois en parallèle. Les vrais champs sont available_amount/locked_amount/
//   owed_total (vendeur/transporteur) ou available_amount/locked_amount/
//   active_order_count (acheteur), jamais locked_balance/escrow_balance/
//   balance qui étaient lus ici.
// - Chaque transaction escrow (id, order_id, amount, shipping_fee, status,
//   created_at) n'a ni `reference` ni `type` réel — `{x.type} · {x.status}`
//   affichait donc une valeur technique brute suivie de "—". Remplacé par
//   StatusBadge + numéro de commande.
//
// Ce total est le MÊME que celui du Wallet (§C6 du diagnostic) : cet écran
// sert désormais de vue détail (quelle commande explique quel montant),
// le Wallet restant la vue d'ensemble — d'où l'absence de round-trip vers
// Wallet ici, pour ne pas donner l'impression de deux totaux concurrents.
// ═══════════════════════════════════════════════════════════════

export function EscrowCenterScreen({ navigation }: any) {
  const { user } = useAuth();
  const isPayable = user?.role === 'vendor' || user?.role === 'transporter';
  const [balance, setBalance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [bal, tx] = await Promise.all([escrowApi.balance(), escrowApi.transactions({ limit: 10 })]);
      setBalance(bal);
      setTransactions(normalizeList<any>(tx, ['transactions', 'data']));
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les fonds protégés.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const currency = balance?.currency ?? 'FCFA';
  const locked = Number(balance?.locked_amount ?? 0);
  const available = Number(balance?.available_amount ?? 0);

  return (
    <ScrollView
      style={s.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      contentContainerStyle={s.container}
    >
      <Text style={s.title}>Protection des paiements</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading && !balance ? (
        <Skeleton height={120} radius={radius.xl} />
      ) : (
        <View style={s.hero}>
          <Text style={s.label}>Fonds actuellement protégés</Text>
          <Money amount={locked} currency={currency} size="xl" color={colors.gold} />
          <Text style={s.heroMeta}>
            {isPayable
              ? "Reversés sur votre wallet dès que l'acheteur confirme la réception."
              : 'Reversés au vendeur dès que vous confirmez la réception de votre commande.'}
          </Text>
          {isPayable ? (
            <Pressable onPress={() => navigation.navigate('Wallet')} style={s.walletLink}>
              <Text style={s.walletLinkText}>Voir mon solde disponible ({available.toLocaleString('fr-FR')} {currency}) →</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View>
        <Text style={s.blockTitle}>Détail par commande</Text>
        {loading ? (
          <View style={{ gap: spacing[2] }}>
            <Skeleton height={70} radius={radius.md} />
            <Skeleton height={70} radius={radius.md} />
          </View>
        ) : transactions.length === 0 ? (
          <EmptyState icon="🔒" title="Aucun fonds en cours de protection" description="Dès qu'une commande sera payée, son suivi apparaîtra ici." />
        ) : (
          <View style={{ gap: spacing[2] }}>
            {transactions.map((x, i) => (
              <Pressable
                key={String(x.id ?? i)}
                style={s.item}
                onPress={() => x.order_id && navigation.navigate('OrderDetails', { orderId: x.order_id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.bold}>Commande #{String(x.order_id ?? x.id ?? '').slice(0, 8)}</Text>
                  <Text style={s.itemMeta}>{x.created_at ? new Date(x.created_at).toLocaleDateString('fr-FR') : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Money amount={x.amount} currency={x.currency ?? currency} size="sm" />
                  <StatusBadge domain="escrow" status={x.status} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable style={s.disputesLink} onPress={() => navigation.navigate('Disputes')}>
        <Text style={s.disputesLinkText}>Voir mes litiges →</Text>
      </Pressable>

      <Text style={s.note}>
        Les fonds ne sont jamais libérés par l'application mobile : seuls le backend LIVI et le partenaire de paiement peuvent les débloquer, selon l'avancement réel de la commande.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[5], paddingBottom: spacing[12] },
  title: { fontFamily: fonts.brand, fontSize: fontSize['3xl'], color: colors.textPrimary },
  hero: {
    backgroundColor: colors.dark3,
    padding: spacing[6],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    gap: 6,
  },
  label: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.xs },
  heroMeta: { color: colors.gray2, fontFamily: fonts.body, fontSize: fontSize.sm, marginTop: 4, lineHeight: 18 },
  walletLink: { marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border },
  walletLinkText: { color: colors.gold, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm },
  blockTitle: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.textPrimary, marginBottom: spacing[3] },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], gap: spacing[3] },
  bold: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  itemMeta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm, marginTop: 2 },
  note: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18, fontFamily: fonts.body },
  error: { color: colors.red, fontFamily: fonts.body },
  disputesLink: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing[4],
    alignItems: 'center',
  },
  disputesLinkText: { color: colors.gold, fontFamily: fonts.bodySemibold, fontSize: fontSize.md },
});
