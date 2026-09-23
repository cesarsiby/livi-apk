import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { walletApi } from '../../features/wallet/walletApi';
import type { WalletTransaction } from '../../features/wallet/types';

import {
  Money,
  Screen,
  Skeleton,
  StatusBadge,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('fr-FR');
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

export function TransactionDetailsScreen({
  route,
  navigation,
}: any) {
  const id = route?.params?.transactionId
    ? String(route.params.transactionId)
    : '';

  const [item, setItem] = useState<WalletTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const entrance = useRef(new Animated.Value(0)).current;

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id) {
        setError('Transaction introuvable.');
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError('');

      try {
        setItem(await walletApi.getTransaction(id));
      } catch (e: any) {
        setError(
          e?.message ?? 'Impossible de charger la transaction.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Screen>
      <ScrollView
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
        <Animated.View
          style={{
            opacity: entrance,
            transform: [{ translateY }],
          }}
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.backIcon}>‹</Text>
              <Text style={styles.backText}>Retour</Text>
            </Pressable>

            <Text style={styles.eyebrow}>WALLET LIVI</Text>
            <Text style={styles.title}>Transaction</Text>
            <Text style={styles.subtitle}>
              Détails de l’opération retournés par le service financier.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingStack}>
              <Skeleton height={250} radius={radius['2xl']} />
              <Skeleton height={210} radius={radius.xl} />
            </View>
          ) : error ? (
            <View style={styles.errorCard}>
              <View style={styles.errorIcon}>
                <Text style={styles.errorIconText}>!</Text>
              </View>

              <View style={styles.errorCopy}>
                <Text style={styles.errorTitle}>
                  Transaction indisponible
                </Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>

              <Pressable
                onPress={() => load()}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : !item ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>·</Text>
              </View>
              <Text style={styles.emptyTitle}>
                Transaction introuvable
              </Text>
              <Text style={styles.emptyText}>
                Le service financier n’a pas retourné cette opération.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>MONTANT</Text>

                <Money
                  amount={item.amount}
                  currency={item.currency}
                  size="xl"
                  color={colors.textPrimary}
                />

                <View style={styles.heroStatus}>
                  <StatusBadge
                    domain="escrow"
                    status={item.status}
                  />
                </View>

                {item.description ? (
                  <Text style={styles.description}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.heroDivider} />

                <View style={styles.referenceBlock}>
                  <Text style={styles.referenceLabel}>
                    RÉFÉRENCE
                  </Text>
                  <Text style={styles.referenceValue}>
                    {item.reference ?? item.id}
                  </Text>
                </View>
              </View>

              <View style={styles.detailsCard}>
                <Text style={styles.sectionEyebrow}>INFORMATIONS</Text>

                <DetailRow
                  label="Statut"
                  value={item.status || '—'}
                />

                {item.type ? (
                  <DetailRow
                    label="Type"
                    value={item.type}
                  />
                ) : null}

                {item.created_at ? (
                  <DetailRow
                    label="Créée le"
                    value={formatDateTime(item.created_at)}
                  />
                ) : null}

                {item.completed_at ? (
                  <DetailRow
                    label="Terminée le"
                    value={formatDateTime(item.completed_at)}
                  />
                ) : null}

                <DetailRow
                  label="Identifiant"
                  value={String(item.id)}
                  last
                />
              </View>
            </>
          )}

          <Pressable
            onPress={() => navigation.navigate('Transactions')}
            style={({ pressed }) => [
              styles.historyLink,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.historyLinkText}>
              Voir toutes les transactions
            </Text>
            <Text style={styles.historyArrow}>→</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  header: {
    gap: spacing[1],
    marginBottom: spacing[5],
  },

  backButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    paddingHorizontal: spacing[3],
    paddingRight: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[3],
  },

  backIcon: {
    marginTop: -2,
    fontFamily: fonts.body,
    fontSize: 28,
    lineHeight: 28,
    color: colors.textPrimary,
  },

  backText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  pressed: {
    opacity: 0.78,
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  loadingStack: {
    gap: spacing[3],
  },

  heroCard: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    gap: spacing[3],
  },

  heroEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },

  heroStatus: {
    alignSelf: 'flex-start',
  },

  description: {
    marginTop: spacing[1],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  heroDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing[2],
  },

  referenceBlock: {
    gap: spacing[1],
  },

  referenceLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textMuted,
  },

  referenceValue: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  detailsCard: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionEyebrow: {
    marginBottom: spacing[1],
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.gold,
  },

  detailRow: {
    minHeight: 58,
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },

  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  detailLabel: {
    flex: 0.8,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  detailValue: {
    flex: 1.2,
    textAlign: 'right',
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  errorCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.redBorder,
    backgroundColor: colors.redDim,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  errorIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.red,
  },

  errorCopy: {
    flex: 1,
    gap: spacing[1],
  },

  errorTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textMuted,
  },

  retryButton: {
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    justifyContent: 'center',
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  emptyCard: {
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyIconText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.gold,
  },

  emptyTitle: {
    marginTop: spacing[4],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  emptyText: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },

  historyLink: {
    alignSelf: 'center',
    marginTop: spacing[5],
    minHeight: 44,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  historyLinkText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  historyArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },
});
