import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { transporterApi } from '../../features/transporter/transporterApi';

import {
  EmptyState,
  Money,
  Skeleton,
  StatusBadge,
} from '../../design/components';

import { formatMoney } from '../../design/components/Money';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>
        {value}
      </Text>

      <Text style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

export function EarningsScreen() {
  const [data, setData] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response =
          await transporterApi.earnings({
            period: 'month',
          });

        setData(
          response?.data ??
            response,
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger vos revenus.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const payouts = Array.isArray(
    data?.payouts,
  )
    ? data.payouts
    : [];

  const payoutCount = Number(
    data?.payout_count ?? 0,
  );

  const gross = data?.gross_payable_xof;

  const periodLabel =
    data?.period_label ??
    'Ce mois';

  const average = useMemo(() => {
    const total = Number(gross ?? 0);

    if (!payoutCount || !total) {
      return '—';
    }

    return formatMoney(
      Math.round(
        total / payoutCount,
      ),
    );
  }, [gross, payoutCount]);

  if (loading) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.loadingContainer
        }
      >
        <Skeleton
          height={230}
          radius={radius['2xl']}
        />

        <Skeleton
          height={80}
          radius={radius.xl}
        />

        <Skeleton
          height={80}
          radius={radius.xl}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.container
      }
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
        <Text style={styles.eyebrow}>
          ACTIVITÉ FINANCIÈRE
        </Text>

        <Text style={styles.title}>
          Mes revenus
        </Text>

        <Text style={styles.subtitle}>
          Vue des versements enregistrés pour la période
          courante.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroEyebrow}>
              {periodLabel.toUpperCase()}
            </Text>

            <Text style={styles.heroTitle}>
              Total à recevoir
            </Text>
          </View>

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              {payoutCount} versement
              {payoutCount > 1
                ? 's'
                : ''}
            </Text>
          </View>
        </View>

        <Money
          amount={gross}
          currency="FCFA"
          size="xl"
          color={colors.gold}
        />

        <View style={styles.metrics}>
          <SummaryMetric
            label="Versements"
            value={String(
              payoutCount,
            )}
          />

          <View
            style={styles.metricDivider}
          />

          <SummaryMetric
            label="Moyenne"
            value={average}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Versements
          </Text>

          <Text style={styles.sectionSubtitle}>
            Historique des paiements enregistrés.
          </Text>
        </View>

        {payouts.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="↗"
              title="Aucun versement"
              description="Les versements apparaîtront ici lorsqu’ils seront enregistrés sur votre compte."
            />
          </View>
        ) : (
          <View style={styles.payoutList}>
            {payouts.map(
              (item: any, index: number) => (
                <View
                  key={String(
                    item.id ??
                      index,
                  )}
                  style={styles.payoutCard}
                >
                  <View
                    style={
                      styles.payoutIcon
                    }
                  >
                    <Text
                      style={
                        styles.payoutIconText
                      }
                    >
                      ↗
                    </Text>
                  </View>

                  <View
                    style={
                      styles.payoutContent
                    }
                  >
                    <Text
                      style={
                        styles.payoutTitle
                      }
                    >
                      {item.reference ??
                        `Versement ${index + 1}`}
                    </Text>

                    <Text
                      style={
                        styles.payoutDate
                      }
                    >
                      {item.paid_at ??
                        item.created_at ??
                        'Date indisponible'}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.payoutRight
                    }
                  >
                    <Money
                      amount={
                        item.amount
                      }
                      currency={
                        item.currency ??
                        'FCFA'
                      }
                      size="sm"
                      color={
                        colors.textPrimary
                      }
                    />

                    {item.status ? (
                      <StatusBadge
                        domain="payout"
                        status={
                          item.status
                        }
                      />
                    ) : null}
                  </View>
                </View>
              ),
            )}
          </View>
        )}
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Les montants affichés proviennent du service
          financier Livi. Aucun montant n’est calculé
          localement comme revenu définitif.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  loadingContainer: {
    padding: spacing[5],
    gap: spacing[4],
    backgroundColor: colors.dark,
  },

  header: {
    marginBottom: spacing[5],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
  },

  title: {
    marginTop: 2,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
  },

  errorBox: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.red,
  },

  hero: {
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  heroEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },

  heroTitle: {
    marginTop: 2,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  heroBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
  },

  heroBadgeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.gold,
  },

  metrics: {
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  metric: {
    flex: 1,
  },

  metricValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },

  metricLabel: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },

  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: spacing[4],
  },

  section: {
    marginTop: spacing[6],
  },

  sectionHeader: {
    marginBottom: spacing[3],
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  payoutList: {
    gap: spacing[3],
  },

  payoutCard: {
    minHeight: 78,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  payoutIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  payoutIconText: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },

  payoutContent: {
    flex: 1,
  },

  payoutTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  payoutDate: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  payoutRight: {
    alignItems: 'flex-end',
    gap: spacing[2],
  },

  emptyCard: {
    minHeight: 300,
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  note: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[2],
  },

  noteText: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
