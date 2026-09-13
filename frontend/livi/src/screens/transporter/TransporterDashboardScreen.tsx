import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { transporterApi } from '../../features/transporter/transporterApi';
import { getCurrentLocation } from '../../services/device/location';
import { useAuth } from '../../features/auth/AuthProvider';
import { ActionRow, Card, ReputationBadge, SectionHeader, Skeleton, StatCard } from '../../design/components';
import { formatMoney } from '../../design/components/Money';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// ═══════════════════════════════════════════════════════════════
// LIVI 2.0 — Dashboard transporteur (RAPPORT_UXUI_SESSION21)
//
// Toute la logique métier déjà corrigée par les sessions précédentes est
// conservée à l'identique (stats à plat depuis GET /transporter/dashboard,
// bascule de disponibilité en minuscules, ping de position toutes les 60s
// pendant qu'en ligne) — seule la présentation change. Missions/Wallet/
// Profil ont désormais leur propre onglet (TransporterNavigator) et ne
// sont donc plus listés en double ici (règle §44).
// ═══════════════════════════════════════════════════════════════

export function TransporterDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ active_missions?: number; total_missions?: number }>({});
  const [walletAvailable, setWalletAvailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      // V54: GET /transporter/dashboard returns {active_missions,
      // total_missions} flat. today_deliveries/today_earnings/wallet_balance
      // don't exist in the backend response, so availability and wallet
      // come from their own real endpoints instead of staying permanently
      // dead cards.
      const [dash, profile, wallet] = await Promise.all([
        transporterApi.dashboard(),
        transporterApi.profile().catch(() => null),
        transporterApi.wallet().catch(() => null),
      ]);
      setStats((dash as any)?.data ?? dash ?? {});
      setAvailable(((profile as any)?.availability ?? '').toLowerCase() === 'online');
      setWalletAvailable((wallet as any)?.available_amount ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger le tableau de bord.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // V54 : ping de position toutes les 60s pendant qu'en ligne, pour que la
  // répartition des missions par proximité sache où se trouve un
  // transporteur disponible mais sans mission en cours. Un échec silencieux
  // (permission refusée, GPS coupé) ne doit pas spammer d'alertes.
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    const ping = () => {
      getCurrentLocation()
        .then((loc) => { if (!cancelled) transporterApi.updateLocation(loc.latitude, loc.longitude, loc.accuracy).catch(() => {}); })
        .catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [available]);

  const toggle = async (v: boolean) => {
    setAvailable(v); setBusy(true);
    try {
      await transporterApi.setAvailability(v ? 'online' : 'offline');
    } catch (e: any) {
      setAvailable(!v);
      setError(e?.message ?? 'Modification de disponibilité refusée.');
    } finally { setBusy(false); }
  };

  const groups = [
    {
      section: 'Livraison en cours',
      items: [
        { icon: '🧭', title: 'Suivi en cours', subtitle: 'Position et étapes de la livraison active', route: 'Tracking' },
        { icon: '🗺️', title: 'Carte / position', subtitle: 'Voir la carte en direct', route: 'LiveMap' },
        { icon: '📷', title: 'QR / PIN', subtitle: 'Valider une remise ou une livraison', route: 'QRValidation' },
      ],
    },
    {
      section: 'Mon activité',
      items: [
        { icon: '⏱️', title: 'Disponibilité', subtitle: 'Zones et horaires', route: 'Availability' },
        { icon: '🗂️', title: 'Historique', subtitle: 'Livraisons passées', route: 'History' },
        { icon: '💵', title: 'Revenus', subtitle: 'Détail de vos gains', route: 'Earnings' },
      ],
    },
    {
      section: 'Mon compte',
      items: [
        { icon: '🚗', title: 'Mon véhicule', subtitle: 'Informations véhicule', route: 'Vehicle' },
        { icon: '🪪', title: 'Vérification KYC', subtitle: 'Statut de vérification', route: 'KYC' },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>ESPACE TRANSPORTEUR</Text>
          <Text style={styles.title}>Bonjour{user?.name ? `, ${user.name}` : ''}</Text>
        </View>
        {!!user?.id && <ReputationBadge userId={user.id} />}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card style={styles.availability} padded>
        <View style={{ flex: 1 }}>
          <Text style={styles.section}>Disponibilité</Text>
          <Text style={styles.muted}>{available ? 'Vous pouvez recevoir des missions.' : 'Vous êtes hors ligne.'}</Text>
        </View>
        <Switch value={available} onValueChange={toggle} disabled={busy} trackColor={{ false: colors.dark4, true: colors.gold }} thumbColor={colors.white} />
      </Card>

      {loading ? (
        <View style={styles.statRow}>
          <Skeleton height={92} radius={radius.lg} />
          <Skeleton height={92} radius={radius.lg} />
          <Skeleton height={92} radius={radius.lg} />
        </View>
      ) : (
        <View style={styles.statRow}>
          <StatCard label="Missions actives" value={String(stats.active_missions ?? '—')} icon="🚚" accent="gold" />
          <StatCard label="Missions totales" value={String(stats.total_missions ?? '—')} icon="📊" accent="blue" />
          <StatCard label="Wallet dispo." value={walletAvailable != null ? formatMoney(walletAvailable) : '—'} icon="💳" accent="green" />
        </View>
      )}

      {groups.map(group => (
        <View key={group.section}>
          <SectionHeader title={group.section} />
          <Card style={styles.groupCard} padded={false}>
            {group.items.map((it, idx) => (
              <View key={it.route}>
                <ActionRow icon={it.icon} title={it.title} subtitle={it.subtitle} onPress={() => navigation.navigate(it.route)} />
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
  muted: { color: colors.gray2, fontFamily: fonts.body, fontSize: fontSize.sm, marginTop: 2 },
  availability: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  section: { fontSize: fontSize.base, fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  statRow: { flexDirection: 'row', gap: spacing[3] },
  groupCard: { paddingHorizontal: spacing[4] },
  divider: { height: 1, backgroundColor: colors.border },
});
