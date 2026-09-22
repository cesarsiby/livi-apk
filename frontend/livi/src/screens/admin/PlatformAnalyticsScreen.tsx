import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { adminApi } from '../../features/admin/adminApi';
import {
  Card,
  Skeleton,
  StatCard,
  SectionHeader,
} from '../../design/components';
import { formatMoney } from '../../design/components/Money';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

type DashboardData = {
  users?: number;
  orders?: number;
  paid_orders?: number;
  gross_order_value?: number | string;
};

function formatCount(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('fr-FR');
}

export function PlatformAnalyticsScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      setData((await adminApi.getDashboard()) as DashboardData);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les indicateurs de la plateforme.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const paidRate = useMemo(() => {
    const orders = Number(data?.orders);
    const paid = Number(data?.paid_orders);

    if (!Number.isFinite(orders) || orders <= 0 || !Number.isFinite(paid)) {
      return '—';
    }

    return `${Math.max(0, Math.min(100, (paid / orders) * 100)).toFixed(0)} %`;
  }, [data]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={120} height={14} radius={radius.pill} />
        <Skeleton width={270} height={34} radius={radius.md} />
        <Skeleton width="100%" height={72} radius={radius.lg} />
        <View style={styles.loadingGrid}>
          <Skeleton width="48%" height={108} radius={radius.lg} />
          <Skeleton width="48%" height={108} radius={radius.lg} />
          <Skeleton width="48%" height={108} radius={radius.lg} />
          <Skeleton width="48%" height={108} radius={radius.lg} />
        </View>
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
        <Text style={styles.eyebrow}>VUE PLATEFORME</Text>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>
          Une lecture synthétique des indicateurs actuellement retournés par
          le service administrateur.
        </Text>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorDot} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Card style={styles.snapshotCard}>
        <View style={styles.snapshotCopy}>
          <Text style={styles.snapshotLabel}>Instantané</Text>
          <Text style={styles.snapshotTitle}>État actuel de l’activité</Text>
          <Text style={styles.snapshotText}>
            Les chiffres ci-dessous correspondent aux valeurs renvoyées par
            l’endpoint administrateur.
          </Text>
        </View>
        <View style={styles.snapshotMark}>
          <Text style={styles.snapshotMarkText}>↗</Text>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader
          title="Indicateurs principaux"
          subtitle="Les quatre compteurs disponibles sur le contrat actuel."
        />

        <View style={styles.grid}>
          <StatCard
            label="Utilisateurs"
            value={formatCount(data?.users)}
            icon="👤"
            accent="blue"
          />
          <StatCard
            label="Commandes"
            value={formatCount(data?.orders)}
            icon="📦"
            accent="blue"
          />
          <StatCard
            label="Commandes payées"
            value={formatCount(data?.paid_orders)}
            icon="✓"
            accent="green"
          />
          <StatCard
            label="Valeur brute des commandes"
            value={
              data?.gross_order_value != null
                ? formatMoney(data.gross_order_value)
                : '—'
            }
            icon="₣"
            accent="gold"
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Lecture rapide"
          subtitle="Indication calculée uniquement à partir des compteurs disponibles."
        />

        <Card style={styles.rateCard}>
          <View style={styles.rateMain}>
            <Text style={styles.rateLabel}>Part des commandes payées</Text>
            <Text style={styles.rateValue}>{paidRate}</Text>
          </View>

          <View style={styles.rateVisual}>
            <View style={styles.rateTrack}>
              <View
                style={[
                  styles.rateFill,
                  {
                    width:
                      paidRate === '—'
                        ? '0%'
                        : `${Math.min(
                            100,
                            Math.max(
                              0,
                              (Number(data?.paid_orders) /
                                Math.max(1, Number(data?.orders))) *
                                100,
                            ),
                          )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.rateHint}>
              {Number.isFinite(Number(data?.orders))
                ? `${formatCount(data?.paid_orders)} sur ${formatCount(data?.orders)}`
                : 'Données insuffisantes'}
            </Text>
          </View>
        </Card>
      </View>

      <Card style={styles.noteCard}>
        <Text style={styles.noteTitle}>Périmètre actuel</Text>
        <Text style={styles.noteText}>
          L’API administrateur fournit ici des compteurs instantanés. Aucun
          historique temporel ou série analytique supplémentaire n’est ajouté
          à l’interface sans donnée backend correspondante.
        </Text>
      </Card>

      <Text style={styles.footer}>
        Dernières valeurs disponibles depuis le service administrateur.
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
    marginTop: 5,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  errorText: {
    flex: 1,
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  snapshotCard: {
    padding: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.27)',
    backgroundColor: 'rgba(201, 151, 28, 0.06)',
    borderRadius: radius.lg,
  },
  snapshotCopy: {
    flex: 1,
    gap: spacing[1],
  },
  snapshotLabel: {
    color: colors.gold2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  snapshotTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  snapshotText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  snapshotMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.14)',
  },
  snapshotMarkText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 23,
  },
  section: {
    gap: spacing[3],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  rateCard: {
    padding: spacing[5],
    gap: spacing[4],
  },
  rateMain: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  rateLabel: {
    flex: 1,
    color: colors.gray2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  rateValue: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
  },
  rateVisual: {
    gap: spacing[2],
  },
  rateTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rateFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  rateHint: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  noteCard: {
    padding: spacing[4],
    gap: spacing[1],
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  noteTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  noteText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
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
