import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuth } from '../../features/auth/AuthProvider';

import {
  ReputationBadge,
  Skeleton,
} from '../../design/components';

import { formatMoney } from '../../design/components/Money';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

type ActionItem = {
  icon: string;
  title: string;
  subtitle: string;
  route: string;
};

function SellerAction({
  item,
}: {
  item: ActionItem;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionCard,
        pressed && styles.actionPressed,
      ]}
    >
      <View style={styles.actionIcon}>
        <Text style={styles.actionIconText}>
          {item.icon}
        </Text>
      </View>

      <Text style={styles.actionTitle}>
        {item.title}
      </Text>

      <Text style={styles.actionSubtitle}>
        {item.subtitle}
      </Text>

      <Text style={styles.actionArrow}>
        →
      </Text>
    </Pressable>
  );
}

function Metric({
  label,
  value,
  accent = 'gold',
}: {
  label: string;
  value: string;
  accent?: 'gold' | 'blue' | 'green';
}) {
  const accentColor =
    accent === 'blue'
      ? colors.blue
      : accent === 'green'
        ? colors.green
        : colors.gold;

  return (
    <View style={styles.metric}>
      <View
        style={[
          styles.metricDot,
          { backgroundColor: accentColor },
        ]}
      />

      <Text style={styles.metricValue}>
        {value}
      </Text>

      <Text style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

export function SellerDashboardScreen({
  navigation,
}: any) {
  const { user } = useAuth();

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
        const response =
          await sellerApi.dashboard();

        setData(
          response?.data ??
            response,
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger le tableau de bord.',
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

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const metrics = useMemo(() => {
    const current = data ?? {};

    return {
      sales:
        current.gross_sales_xof != null
          ? formatMoney(
              current.gross_sales_xof,
            )
          : '—',
      orders:
        current.order_count != null
          ? String(
              current.order_count,
            )
          : '—',
      products:
        current.product_count != null
          ? String(
              current.product_count,
            )
          : '—',
    };
  }, [data]);

  const actions: ActionItem[] = [
    {
      icon: '▣',
      title: 'Produits',
      subtitle:
        'Ajouter, modifier et gérer vos produits',
      route: 'SellerProducts',
    },
    {
      icon: '□',
      title: 'Commandes',
      subtitle:
        'Suivre et préparer les commandes reçues',
      route: 'SellerOrders',
    },
    {
      icon: '⌁',
      title: 'Inventaire',
      subtitle:
        'Mettre à jour les stocks',
      route: 'Inventory',
    },
    {
      icon: '▣',
      title: 'Statistiques',
      subtitle:
        'Analyser les performances de votre boutique',
      route: 'Analytics',
    },
    {
      icon: '●',
      title: 'Vidéos',
      subtitle:
        'Publier et gérer votre contenu',
      route: 'VideoManager',
    },
    {
      icon: '◉',
      title: 'Live',
      subtitle:
        'Accéder à votre espace Live',
      route: 'LiveDashboard',
    },
    {
      icon: 'ID',
      title: 'KYC',
      subtitle:
        'Consulter votre vérification',
      route: 'KYC',
    },
    {
      icon: '↗',
      title: 'Versements',
      subtitle:
        'Gérer les retraits et paiements',
      route: 'Payouts',
    },
  ];

  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
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
          transform: [{ translateY }],
        }}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              ESPACE VENDEUR
            </Text>

            <Text style={styles.title}>
              {user?.name
                ? `Bonjour, ${user.name}`
                : 'Votre boutique'}
            </Text>

            <Text style={styles.subtitle}>
              Gérez votre activité Livi depuis un
              seul espace.
            </Text>
          </View>

          {user?.id ? (
            <ReputationBadge
              userId={user.id}
            />
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable
              onPress={() => void load()}
            >
              <Text style={styles.retryText}>
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.salesCard}>
          <View style={styles.salesCardHeader}>
            <View>
              <Text style={styles.salesEyebrow}>
                ACTIVITÉ DE LA BOUTIQUE
              </Text>

              <Text style={styles.salesTitle}>
                Vue d’ensemble
              </Text>
            </View>

            <View style={styles.salesBadge}>
              <Text style={styles.salesBadgeText}>
                ACTUEL
              </Text>
            </View>
          </View>

          {loading && !data ? (
            <View style={styles.salesLoading}>
              <Skeleton
                width="62%"
                height={34}
                radius={radius.md}
              />

              <View style={styles.salesMetricsLoading}>
                <Skeleton
                  width="30%"
                  height={58}
                  radius={radius.lg}
                />

                <Skeleton
                  width="30%"
                  height={58}
                  radius={radius.lg}
                />

                <Skeleton
                  width="30%"
                  height={58}
                  radius={radius.lg}
                />
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.salesAmount}>
                {metrics.sales}
              </Text>

              <View style={styles.metrics}>
                <Metric
                  label="Chiffre d'affaires"
                  value={metrics.sales}
                  accent="gold"
                />

                <Metric
                  label="Commandes"
                  value={metrics.orders}
                  accent="blue"
                />

                <Metric
                  label="Produits"
                  value={metrics.products}
                  accent="green"
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Gérer la boutique
              </Text>

              <Text style={styles.sectionSubtitle}>
                Les outils principaux de votre activité.
              </Text>
            </View>
          </View>

          <View style={styles.actionGrid}>
            {actions.map((item) => (
              <Pressable
                key={item.route}
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed &&
                    styles.actionPressed,
                ]}
                onPress={() =>
                  navigation.navigate(
                    item.route,
                  )
                }
              >
                <View style={styles.actionTop}>
                  <View style={styles.actionIcon}>
                    <Text
                      style={
                        styles.actionIconText
                      }
                    >
                      {item.icon}
                    </Text>
                  </View>

                  <Text style={styles.actionArrow}>
                    →
                  </Text>
                </View>

                <Text style={styles.actionTitle}>
                  {item.title}
                </Text>

                <Text
                  style={styles.actionSubtitle}
                >
                  {item.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.shopButton,
            pressed &&
              styles.shopButtonPressed,
          ]}
          onPress={() =>
            navigation.navigate(
              'Onboarding',
            )
          }
        >
          <View style={styles.shopButtonIcon}>
            <Text style={styles.shopButtonIconText}>
              ⌂
            </Text>
          </View>

          <View style={styles.shopButtonContent}>
            <Text style={styles.shopButtonTitle}>
              Informations de la boutique
            </Text>

            <Text style={styles.shopButtonSubtitle}>
              Identité commerciale et informations vendeur
            </Text>
          </View>

          <Text style={styles.shopButtonArrow}>
            ›
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          Les indicateurs affichés proviennent directement
          des données de votre boutique.
        </Text>
      </Animated.View>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  headerCopy: {
    flex: 1,
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
    fontSize: fontSize['2xl'],
    lineHeight: 29,
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
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  errorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  salesCard: {
    marginTop: spacing[5],
    minHeight: 228,
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  salesCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  salesEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },

  salesTitle: {
    marginTop: 2,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  salesBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  salesBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 0.7,
    color: colors.gold,
  },

  salesAmount: {
    marginTop: spacing[5],
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    color: colors.gold,
  },

  metrics: {
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    gap: spacing[2],
  },

  metric: {
    flex: 1,
  },

  metricDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    marginBottom: spacing[2],
  },

  metricValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  metricLabel: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 13,
    color: colors.textMuted,
  },

  salesLoading: {
    marginTop: spacing[5],
    gap: spacing[4],
  },

  salesMetricsLoading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    color: colors.textMuted,
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },

  actionCard: {
    width: '48%',
    minHeight: 148,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  actionPressed: {
    opacity: 0.9,
  },

  actionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  actionArrow: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.textMuted,
  },

  actionTitle: {
    marginTop: spacing[4],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  actionSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  shopButton: {
    marginTop: spacing[5],
    minHeight: 76,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
  },

  shopButtonPressed: {
    opacity: 0.92,
  },

  shopButtonIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shopButtonIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  shopButtonContent: {
    flex: 1,
    marginLeft: spacing[3],
  },

  shopButtonTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  shopButtonSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.dark,
    opacity: 0.65,
  },

  shopButtonArrow: {
    marginLeft: spacing[3],
    fontFamily: fonts.body,
    fontSize: fontSize['2xl'],
    color: colors.dark,
  },

  footer: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[2],
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
