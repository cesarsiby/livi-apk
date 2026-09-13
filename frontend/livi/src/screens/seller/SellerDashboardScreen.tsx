import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { sellerApi } from '../../features/seller/sellerApi';
import { useAuth } from '../../features/auth/AuthProvider';
import { ActionRow, Card, ReputationBadge, SectionHeader, Skeleton, StatCard } from '../../design/components';
import { formatMoney } from '../../design/components/Money';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// ═══════════════════════════════════════════════════════════════
// LIVI 2.0 — Dashboard vendeur (RAPPORT_UXUI_SESSION21)
//
// L'ancien écran empilait 13 liens à plat sous un unique "Actions rapides",
// sans hiérarchie ni distinction entre ce qui vend, ce qui gère le contenu
// et ce qui concerne l'argent (constat C5 de l'audit). Regroupé en 3
// sections avec une raison d'être chacune. Produits/Commandes/Wallet/Profil
// ont désormais leur propre onglet (SellerNavigator) : ils ne sont plus
// listés ici pour éviter qu'une même destination soit accessible de deux
// façons sans raison (règle §44 de la mission).
//
// GET /vendor/dashboard ne renvoie que {product_count, order_count,
// gross_sales_xof} — aucune décomposition "à traiter maintenant" n'existe
// côté backend, donc aucune section "nécessite votre attention" n'est
// affichée ici : l'inventer serait présenter une fonctionnalité qui
// n'existe pas comme opérationnelle (règle §51).
// ═══════════════════════════════════════════════════════════════

export function SellerDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const d = await sellerApi.dashboard();
      setData(d?.data ?? d);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger le tableau de bord.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const m = data ?? {};

  const content = [
    {
      section: 'Contenu & Live',
      items: [
        { icon: '🎬', title: 'Mes vidéos', subtitle: 'Publier et gérer vos vidéos', route: 'VideoManager' },
        { icon: '✨', title: 'Creator Tools', subtitle: 'Abonnés et outils créateur', route: 'CreatorTools' },
        { icon: '🔴', title: 'Live', subtitle: 'Tableau de bord des lives', route: 'LiveDashboard' },
      ],
    },
    {
      section: 'Développer ma boutique',
      items: [
        { icon: '📋', title: 'Inventaire', subtitle: 'Mettre à jour les stocks', route: 'Inventory' },
        { icon: '🏪', title: 'Boutique', subtitle: 'Informations et identité commerciale', route: 'Onboarding' },
        { icon: '📈', title: 'Statistiques', subtitle: 'Performances de la boutique', route: 'Analytics' },
      ],
    },
    {
      section: 'Finances',
      items: [
        { icon: '💰', title: 'Versements', subtitle: 'Paiements et retraits', route: 'Payouts' },
      ],
    },
    {
      section: 'Support & conformité',
      items: [
        { icon: '💬', title: 'Messages', subtitle: 'Répondre aux clients', route: 'Messages' },
        { icon: '🪪', title: 'Vérification KYC', subtitle: 'Statut de vérification vendeur', route: 'KYC' },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>ESPACE VENDEUR</Text>
          <Text style={styles.title}>Bonjour{user?.name ? `, ${user.name}` : ''}</Text>
        </View>
        {!!user?.id && <ReputationBadge userId={user.id} />}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.statRow}>
          <Skeleton height={92} radius={radius.lg} />
          <Skeleton height={92} radius={radius.lg} />
          <Skeleton height={92} radius={radius.lg} />
        </View>
      ) : (
        <View style={styles.statRow}>
          <StatCard label="Chiffre d'affaires" value={m.gross_sales_xof != null ? formatMoney(m.gross_sales_xof) : '—'} icon="💵" accent="gold" />
          <StatCard label="Commandes" value={String(m.order_count ?? '—')} icon="📦" accent="blue" />
          <StatCard label="Produits" value={String(m.product_count ?? '—')} icon="🛍️" accent="green" />
        </View>
      )}

      {content.map(group => (
        <View key={group.section}>
          <SectionHeader title={group.section} />
          <Card style={styles.groupCard} padded={false}>
            {group.items.map((it, idx) => (
              <View key={it.route}>
                <View style={styles.rowPad}>
                  <ActionRow icon={it.icon} title={it.title} subtitle={it.subtitle} onPress={() => navigation.navigate(it.route)} />
                </View>
                {idx < group.items.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  container: { padding: spacing[4], gap: spacing[5], paddingBottom: spacing[12] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: fontSize.xs, fontFamily: fonts.bodyBold, color: colors.gold, letterSpacing: 1.5 },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary, marginTop: 2 },
  error: { color: colors.red, fontFamily: fonts.body },
  statRow: { flexDirection: 'row', gap: spacing[3] },
  groupCard: { paddingHorizontal: spacing[4] },
  rowPad: { paddingVertical: 0 },
  divider: { height: 1, backgroundColor: colors.border },
});
