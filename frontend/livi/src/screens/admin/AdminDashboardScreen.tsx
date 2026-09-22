import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { adminApi } from '../../features/admin/adminApi';
import type { AdminDashboard } from '../../features/admin/types';
import {
  ActionRow,
  Card,
  SectionHeader,
  Skeleton,
  StatCard,
} from '../../design/components';
import { formatMoney } from '../../design/components/Money';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

const LINK_GROUPS: {
  title: string;
  links: { screen: string; icon: string; label: string }[];
}[] = [
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
      { screen: 'AdminFinance', icon: '₣', label: 'Finance' },
      { screen: 'AdminReconciliation', icon: '↔', label: 'Réconciliation' },
    ],
  },
  {
    title: 'Contrôle & opérations',
    links: [
      { screen: 'AdminIntegrity', icon: '✓', label: 'Intégrité' },
      { screen: 'AdminAnalytics', icon: '▥', label: 'Analytics' },
      { screen: 'AdminLogs', icon: '≡', label: 'Logs' },
      { screen: 'AdminSupport', icon: '?', label: 'Support' },
    ],
  },
];

function formatCount(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('fr-FR');
}

export function AdminDashboardScreen({ navigation }: any) {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      setData(await adminApi.getDashboard());
    } catch (e: any) {
      setError(
        e?.message ??
          'Impossible de charger le tableau de bord administrateur.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dashboard = data as any;

  const paidRate = useMemo(() => {
    const orders = Number(dashboard?.orders);
    const paid = Number(dashboard?.paid_orders);

    if (!Number.isFinite(orders) || orders <= 0 || !Number.isFinite(paid)) {
      return '—';
    }

    return `${Math.max(0, Math.min(100, (paid / orders) * 100)).toFixed(0)} %`;
  }, [dashboard?.orders, dashboard?.paid_orders]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={120} height={14} radius={radius.pill} />
        <Skeleton width={270} height={36} radius={radius.md} />
        <Skeleton width="92%" height={21} radius={radius.md} />
        <View style={styles.loadingGrid}>
          <Skeleton width="48%" height={108} radius={radius.lg} />
          <Skeleton width="48%" height={108} radius={radius.lg} />
          <Skeleton width="48%" height={108} radius={radius.lg} />
          <Skeleton width="48%" height={108} radius={radius.lg} />
        </View>
        <Skeleton width="100%" height={190} radius={radius.lg} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>LIVI ADMIN</Text>
        <Text style={styles.title}>Tableau de bord</Text>
        <Text style={styles.subtitle}>
          Le centre de contrôle de la plateforme, construit à partir des
          indicateurs et ressources réellement exposés au backend.
        </Text>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorDot} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Card style={styles.overviewCard}>
        <View style={styles.overviewMain}>
          <Text style={styles.overviewLabel}>Vue instantanée</Text>
          <Text style={styles.overviewTitle}>Activité de la plateforme</Text>
          <Text style={styles.overviewText}>
            {paidRate === '—'
              ? 'Les indicateurs sont disponibles ci-dessous.'
              : `${paidRate} des commandes retournées sont actuellement indiquées comme payées.`}
          </Text>
        </View>

        <View style={styles.overviewMark}>
          <Text style={styles.overviewMarkText}>L</Text>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader
          title="Indicateurs principaux"
          subtitle="Les quatre compteurs retournés par /admin/dashboard."
        />

        <View style={styles.grid}>
          <StatCard
            label="Utilisateurs"
            value={formatCount(dashboard?.users)}
            icon="👤"
            accent="blue"
          />
          <StatCard
            label="Commandes"
            value={formatCount(dashboard?.orders)}
            icon="📦"
            accent="blue"
          />
          <StatCard
            label="Commandes payées"
            value={formatCount(dashboard?.paid_orders)}
            icon="✓"
            accent="green"
          />
          <StatCard
            label="Valeur brute"
            value={
              dashboard?.gross_order_value != null
                ? formatMoney(dashboard.gross_order_value)
                : '—'
            }
            icon="₣"
            accent="gold"
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Accès administratifs"
          subtitle="Les fonctions sont regroupées par domaine pour retrouver plus vite l’action recherchée."
        />

        <View style={styles.groups}>
          {LINK_GROUPS.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>

              <Card style={styles.groupCard} padded={false}>
                {group.links.map((link, index) => (
                  <View key={link.screen}>
                    <ActionRow
                      icon={link.icon}
                      title={link.label}
                      onPress={() => navigation.navigate(link.screen)}
                    />
                    {index < group.links.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </View>
                ))}
              </Card>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        onPress={() => navigation.navigate('AdminIntegrity')}
        style={({ pressed }) => [
          styles.integrityPressable,
          pressed ? styles.pressed : null,
        ]}
      >
        <Card style={styles.integrityCard}>
          <View style={styles.integrityIcon}>
            <Text style={styles.integrityIconText}>✓</Text>
          </View>

          <View style={styles.integrityCopy}>
            <Text style={styles.integrityTitle}>Contrôle d’intégrité</Text>
            <Text style={styles.integrityText}>
              Vérifier le grand livre et les incohérences escrow.
            </Text>
          </View>

          <Text style={styles.chevron}>›</Text>
        </Card>
      </Pressable>

      <Text style={styles.footer}>
        Les métriques affichées sont celles retournées directement par le
        service administrateur.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: spacing[5],
    gap: spacing[4],
  },
  loadingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[6],
  },
  header: {
    gap: spacing[2],
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
  },
  subtitle: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    maxWidth: 370,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.25)',
    backgroundColor: 'rgba(255, 94, 94, 0.07)',
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: colors.red,
  },
  errorText: {
    flex: 1,
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  overviewCard: {
    minHeight: 116,
    padding: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.27)',
    backgroundColor: 'rgba(201, 151, 28, 0.065)',
  },
  overviewMain: {
    flex: 1,
    gap: spacing[1],
  },
  overviewLabel: {
    color: colors.gold2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  overviewTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
  },
  overviewText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  overviewMark: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.22)',
  },
  overviewMarkText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 27,
  },
  section: {
    gap: spacing[3],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  groups: {
    gap: spacing[4],
  },
  group: {
    gap: spacing[2],
  },
  groupTitle: {
    color: colors.gray3,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  groupCard: {
    paddingHorizontal: spacing[4],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  integrityPressable: {
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.993 }],
  },
  integrityCard: {
    minHeight: 82,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(61, 196, 126, 0.2)',
    backgroundColor: 'rgba(61, 196, 126, 0.045)',
  },
  integrityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61, 196, 126, 0.1)',
  },
  integrityIconText: {
    color: colors.green,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
  },
  integrityCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  integrityTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  integrityText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  chevron: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 24,
    lineHeight: 22,
  },
  footer: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing[3],
  },
});
