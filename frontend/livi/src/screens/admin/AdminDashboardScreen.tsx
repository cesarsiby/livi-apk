import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { adminApi } from '../../features/admin/adminApi';
import type { AdminDashboard } from '../../features/admin/types';
import { ActionRow, Card, SectionHeader, Skeleton, StatCard } from '../../design/components';
import { formatMoney } from '../../design/components/Money';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, périmètre admin) : GET /admin/dashboard
// (routes/admin.js) renvoie exactement {users, orders, paid_orders,
// gross_order_value} — 4 nombres, rien d'autre. L'écran itérait pourtant
// Object.entries(data) pour générer des cartes génériques ("users" → "656",
// avec JSON.stringify brut pour toute valeur non primitive) au lieu de
// libeller ces 4 chiffres précisément. Les 18 raccourcis étaient listés à
// plat, sans groupe — même défaut que les anciens dashboards vendeur/
// transporteur (voir C5), corrigé avec le même vocabulaire visuel.
const LINK_GROUPS: { title: string; links: { screen: string; icon: string; label: string }[] }[] = [
  {
    title: 'Comptes & vérifications',
    links: [
      { screen: 'AdminUsers', icon: '👤', label: 'Utilisateurs' },
      { screen: 'AdminSellers', icon: '🏪', label: 'Vendeurs' },
      { screen: 'AdminTransporters', icon: '🚚', label: 'Transporteurs' },
      { screen: 'AdminVerifications', icon: '🪪', label: 'Vérifications KYC' },
    ],
  },
  {
    title: 'Commerce & litiges',
    links: [
      { screen: 'AdminOrders', icon: '📦', label: 'Commandes' },
      { screen: 'AdminProducts', icon: '🛍️', label: 'Produits' },
      { screen: 'AdminMissions', icon: '📍', label: 'Missions' },
      { screen: 'AdminDisputes', icon: '⚖️', label: 'Litiges' },
    ],
  },
  {
    title: 'Finance',
    links: [
      { screen: 'AdminPayments', icon: '💳', label: 'Paiements' },
      { screen: 'AdminEscrow', icon: '🔒', label: 'Escrow' },
      { screen: 'AdminPayoutsQueue', icon: '💸', label: 'File de retraits' },
      { screen: 'AdminWithdrawals', icon: '📜', label: 'Historique retraits' },
      { screen: 'AdminFinance', icon: '💰', label: 'Finance' },
      { screen: 'AdminReconciliation', icon: '🔄', label: 'Réconciliation' },
    ],
  },
  {
    title: 'Technique',
    links: [
      { screen: 'AdminIntegrity', icon: '✅', label: 'Intégrité' },
      { screen: 'AdminAnalytics', icon: '📊', label: 'Analytics' },
      { screen: 'AdminLogs', icon: '🧾', label: 'Logs' },
      { screen: 'AdminSupport', icon: '🎧', label: 'Support' },
    ],
  },
];

export function AdminDashboardScreen({ navigation }: any) {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try { refresh ? setRefreshing(true) : setLoading(true); setError(null); setData(await adminApi.getDashboard()); }
    catch (e: any) { setError(e?.message ?? 'Impossible de charger le dashboard administrateur.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const d = data as any;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
    >
      <Text style={styles.title}>Administration LIVI</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.statGrid}>
          <Skeleton height={92} radius={radius.lg} />
          <Skeleton height={92} radius={radius.lg} />
        </View>
      ) : d ? (
        <View style={styles.statGrid}>
          <StatCard label="Utilisateurs" value={String(d.users ?? '—')} icon="👤" accent="blue" />
          <StatCard label="Commandes" value={String(d.orders ?? '—')} icon="📦" accent="blue" />
          <StatCard label="Commandes payées" value={String(d.paid_orders ?? '—')} icon="✅" accent="green" />
          <StatCard label="Valeur brute des commandes" value={d.gross_order_value != null ? formatMoney(d.gross_order_value) : '—'} icon="💰" accent="gold" />
        </View>
      ) : null}

      {LINK_GROUPS.map((group) => (
        <View key={group.title}>
          <SectionHeader title={group.title} />
          <Card style={styles.groupCard} padded={false}>
            {group.links.map((link, idx) => (
              <View key={link.screen}>
                <ActionRow icon={link.icon} title={link.label} onPress={() => navigation.navigate(link.screen)} />
                {idx < group.links.length - 1 ? <View style={styles.divider} /> : null}
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
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  error: { color: colors.red, textAlign: 'center', fontFamily: fonts.body },
  groupCard: { paddingHorizontal: spacing[4] },
  divider: { height: 1, backgroundColor: colors.border },
});
