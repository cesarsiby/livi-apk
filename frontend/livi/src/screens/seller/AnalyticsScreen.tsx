import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { sellerApi } from '../../features/seller/sellerApi';

import {
  EmptyState,
  Skeleton,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  shadow,
  spacing,
} from '../../design/theme';

type Period = 'week' | 'month' | 'all';

function formatNumber(value: unknown) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return numeric.toLocaleString('fr-FR');
}

function formatCurrency(value: unknown) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return `${numeric.toLocaleString('fr-FR')} FCFA`;
}

function MetricCard({
  label,
  value,
  index,
}: {
  label: string;
  value: unknown;
  index: number;
}) {
  const scale = useRef(
    new Animated.Value(1),
  ).current;

  return (
    <Animated.View
      style={[
        styles.metricAnimated,
        {
          opacity: 1,
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.985,
            useNativeDriver: true,
            friction: 8,
            tension: 90,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 90,
          }).start()
        }
        style={[
          styles.metricCard,
          index === 0 &&
            styles.metricCardFeatured,
        ]}
      >
        <Text
          style={styles.metricLabel}
          numberOfLines={2}
        >
          {label}
        </Text>

        <Text
          style={[
            styles.metricValue,
            index === 0 &&
              styles.metricValueFeatured,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {index === 0
            ? formatCurrency(value)
            : formatNumber(value)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function ProductRow({
  product,
  index,
}: {
  product: any;
  index: number;
}) {
  const sales = Number(
    product?.sales ?? 0,
  );

  return (
    <View style={styles.productRow}>
      <View style={styles.productRank}>
        <Text style={styles.productRankText}>
          {product?.rank ?? index + 1}
        </Text>
      </View>

      <View style={styles.productCopy}>
        <Text
          style={styles.productName}
          numberOfLines={1}
        >
          {product?.name ?? 'Produit'}
        </Text>

        <Text style={styles.productSales}>
          {sales.toLocaleString('fr-FR')}{' '}
          vente{sales > 1 ? 's' : ''}
        </Text>
      </View>

      <Text
        style={styles.productRevenue}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatCurrency(
          product?.revenue,
        )}
      </Text>
    </View>
  );
}

function AnalyticsSkeleton() {
  return (
    <View style={styles.skeleton}>
      <Skeleton
        width="52%"
        height={14}
        radius={radius.sm}
      />

      <Skeleton
        width="88%"
        height={32}
        radius={radius.md}
      />

      <View style={styles.skeletonTabs}>
        <Skeleton
          width="30%"
          height={42}
          radius={radius.full}
        />
        <Skeleton
          width="30%"
          height={42}
          radius={radius.full}
        />
        <Skeleton
          width="30%"
          height={42}
          radius={radius.full}
        />
      </View>

      <View style={styles.skeletonGrid}>
        {[0, 1, 2, 3].map(
          (item) => (
            <Skeleton
              key={item}
              width="47%"
              height={110}
              radius={radius.xl}
            />
          ),
        )}
      </View>

      <Skeleton
        width="72%"
        height={20}
        radius={radius.md}
      />

      <Skeleton
        width="100%"
        height={76}
        radius={radius.xl}
      />

      <Skeleton
        width="100%"
        height={76}
        radius={radius.xl}
      />
    </View>
  );
}

export function AnalyticsScreen() {
  const [period, setPeriod] =
    useState<Period>('week');

  const [data, setData] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState('');

  const entrance = useRef(
    new Animated.Value(0),
  ).current;

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const result =
          await sellerApi.analytics(
            period,
          );

        setData(result);
      } catch (e: any) {
        setData(null);
        setError(
          e?.message ??
            'Impossible de charger les statistiques.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const metrics = useMemo(() => {
    const source =
      data?.metrics ??
      data?.summary ??
      {};

    return [
      {
        label: 'Chiffre d’affaires',
        value:
          source.revenue,
      },
      {
        label: 'Ventes',
        value: source.sales,
      },
      {
        label: 'Commandes',
        value: source.orders,
      },
      {
        label: 'Panier moyen',
        value:
          source.average_order_value,
      },
    ];
  }, [data]);

  const products = useMemo(() => {
    const value =
      data?.top_products ??
      data?.products ??
      [];

    return Array.isArray(value)
      ? value
      : [];
  }, [data]);

  const maxRevenue = useMemo(() => {
    return products.reduce(
      (max: number, item: any) => {
        const value = Number(
          item?.revenue ?? 0,
        );

        return Number.isFinite(value)
          ? Math.max(max, value)
          : max;
      },
      0,
    );
  }, [products]);

  const translateY =
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [12, 0],
    });

  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <AnalyticsSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
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
        <Animated.View
          style={{
            opacity: entrance,
            transform: [
              {
                translateY,
              },
            ],
          }}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>
              ESPACE VENDEUR
            </Text>

            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>
                  Statistiques
                </Text>

                <Text style={styles.subtitle}>
                  Consultez les indicateurs fournis
                  par votre activité vendeur.
                </Text>
              </View>

              <View style={styles.liveBadge}>
                <View
                  style={
                    styles.liveBadgeDot
                  }
                />
                <Text
                  style={
                    styles.liveBadgeText
                  }
                >
                  DONNÉES RÉELLES
                </Text>
              </View>
            </View>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <View style={styles.errorCopy}>
                <Text
                  style={styles.errorTitle}
                >
                  Statistiques indisponibles
                </Text>

                <Text
                  style={styles.errorText}
                >
                  {error}
                </Text>
              </View>

              <Pressable
                onPress={() => load()}
                style={styles.retryButton}
              >
                <Text
                  style={styles.retryText}
                >
                  Réessayer
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.periodCard}>
            <View>
              <Text
                style={styles.periodTitle}
              >
                Période
              </Text>

              <Text
                style={styles.periodSubtitle}
              >
                Changez la fenêtre d’analyse.
              </Text>
            </View>

            <View style={styles.periods}>
              {(
                [
                  ['week', 'Semaine'],
                  ['month', 'Mois'],
                  ['all', 'Tout'],
                ] as [
                  Period,
                  string,
                ][]
              ).map(
                ([value, label]) => {
                  const active =
                    period === value;

                  return (
                    <Pressable
                      key={value}
                      onPress={() =>
                        setPeriod(value)
                      }
                      style={[
                        styles.periodButton,
                        active &&
                          styles.periodButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.periodText,
                          active &&
                            styles.periodTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={styles.sectionTitle}
              >
                Vue d’ensemble
              </Text>

              <Text
                style={styles.sectionSubtitle}
              >
                Valeurs renvoyées par l’analytics
                vendeur.
              </Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            {metrics.map(
              (metric, index) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  index={index}
                />
              ),
            )}
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={styles.sectionTitle}
              >
                Meilleurs produits
              </Text>

              <Text
                style={styles.sectionSubtitle}
              >
                Classement disponible pour la
                période sélectionnée.
              </Text>
            </View>

            <View style={styles.countPill}>
              <Text
                style={styles.countPillText}
              >
                {products.length}
              </Text>
            </View>
          </View>

          {products.length === 0 ? (
            <View style={styles.emptyWrapper}>
              <EmptyState
                icon="·"
                title="Aucune donnée"
                description="Aucun produit classé n’est actuellement fourni pour cette période."
              />
            </View>
          ) : (
            <View style={styles.productsCard}>
              {products.map(
                (product: any, index: number) => {
                  const revenue =
                    Number(
                      product?.revenue ??
                        0,
                    );

                  const width =
                    maxRevenue > 0 &&
                    Number.isFinite(
                      revenue,
                    )
                      ? Math.max(
                          8,
                          (revenue /
                            maxRevenue) *
                            100,
                        )
                      : 0;

                  return (
                    <View
                      key={String(
                        product?.id ??
                          index,
                      )}
                      style={
                        styles.productBlock
                      }
                    >
                      <ProductRow
                        product={
                          product
                        }
                        index={
                          index
                        }
                      />

                      <View
                        style={
                          styles.revenueTrack
                        }
                      >
                        <View
                          style={[
                            styles.revenueFill,
                            {
                              width: `${width}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                },
              )}
            </View>
          )}

          <View style={styles.noteCard}>
            <View style={styles.noteMark}>
              <Text
                style={styles.noteMarkText}
              >
                i
              </Text>
            </View>

            <Text style={styles.noteText}>
              Les valeurs affichées proviennent
              directement de
              l’endpoint d’analytics vendeur.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
  },

  skeleton: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[4],
  },

  skeletonTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[2],
  },

  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  header: {
    marginBottom: spacing[4],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.gold,
  },

  headerRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
  },

  headerCopy: {
    flex: 1,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  liveBadge: {
    minHeight: 32,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },

  liveBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 0.5,
    color: colors.green,
  },

  errorCard: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  errorCopy: {
    flex: 1,
  },

  errorTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  errorText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  retryButton: {
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  periodCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },

  periodTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  periodSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },

  periods: {
    flexDirection: 'row',
    gap: spacing[2],
  },

  periodButton: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  periodButtonActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },

  periodText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  periodTextActive: {
    color: colors.dark,
  },

  sectionHeader: {
    marginTop: spacing[6],
    marginBottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  sectionSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 15,
    color: colors.textMuted,
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  metricAnimated: {
    width: '47%',
  },

  metricCard: {
    minHeight: 110,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },

  metricCardFeatured: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldDim,
  },

  metricLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },

  metricValue: {
    marginTop: spacing[2],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    lineHeight: 25,
    color: colors.textPrimary,
  },

  metricValueFeatured: {
    color: colors.gold,
  },

  countPill: {
    minWidth: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  productsCard: {
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },

  productBlock: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  productRank: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  productRankText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  productCopy: {
    flex: 1,
    minWidth: 0,
  },

  productName: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  productSales: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },

  productRevenue: {
    width: 92,
    textAlign: 'right',
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  revenueTrack: {
    height: 5,
    marginTop: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    overflow: 'hidden',
  },

  revenueFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  emptyWrapper: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noteCard: {
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing[3],
  },

  noteMark: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noteMarkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  noteText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
