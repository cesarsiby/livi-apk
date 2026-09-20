import React, { useCallback, useEffect, useState } from 'react';
import {
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

export function TransactionDetailsScreen({
  route,
  navigation,
}: any) {
  const id = String(route.params?.transactionId ?? '');

  const [item, setItem] =
    useState<WalletTransaction | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);

        const result =
          await walletApi.getTransaction(id);

        setItem(result);
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger la transaction.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.gold}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>WALLET LIVI</Text>
        <Text style={styles.title}>Transaction</Text>
      </View>

      {loading ? (
        <Skeleton
          height={300}
          radius={radius['2xl']}
        />
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => load()}>
            <Text style={styles.retry}>Réessayer</Text>
          </Pressable>
        </View>
      ) : item ? (
        <View style={styles.card}>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>
              Montant
            </Text>

            <Money
              amount={item.amount}
              currency={item.currency}
              size="xl"
              color={colors.textPrimary}
            />

            <StatusBadge
              domain="escrow"
              status={item.status}
            />
          </View>

          {item.description ? (
            <View style={styles.descriptionBox}>
              <Text style={styles.description}>
                {item.description}
              </Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <DetailLine
            label="Référence"
            value={item.reference ?? item.id}
          />

          {item.created_at ? (
            <DetailLine
              label="Créée le"
              value={new Date(
                item.created_at,
              ).toLocaleString('fr-FR')}
            />
          ) : null}

          {item.completed_at ? (
            <DetailLine
              label="Terminée le"
              value={new Date(
                item.completed_at,
              ).toLocaleString('fr-FR')}
            />
          ) : null}

          {item.type ? (
            <DetailLine
              label="Type"
              value={item.type}
            />
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={() =>
          navigation.navigate('Transactions')
        }
        style={styles.backLink}
      >
        <Text style={styles.backText}>
          Voir toutes les transactions
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    gap: spacing[4],
  },

  header: {
    gap: spacing[1],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.6,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  card: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[4],
  },

  hero: {
    alignItems: 'center',
    gap: spacing[2],
  },

  heroLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  descriptionBox: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
  },

  description: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  detailLine: {
    gap: spacing[1],
  },

  detailLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  detailValue: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  errorCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.redBorder,
    gap: spacing[2],
  },

  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  retry: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  backLink: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },

  backText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
