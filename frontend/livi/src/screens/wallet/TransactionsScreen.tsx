import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { walletApi } from '../../features/wallet/walletApi';
import type {
  WalletTransaction,
  TransactionListResponse,
} from '../../features/wallet/types';

import {
  EmptyState,
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

function normalize(
  response: TransactionListResponse,
): WalletTransaction[] {
  if (Array.isArray(response)) return response;

  return (
    response.data ??
    response.items ??
    response.transactions ??
    []
  );
}

function formatDate(value?: string) {
  if (!value) return '';

  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function TransactionsScreen({
  navigation,
}: any) {
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);

      const response =
        await walletApi.listTransactions({
          page: 1,
          limit: 50,
        });

      setItems(normalize(response));
    } catch (e: any) {
      setError(
        e?.message ??
          'Impossible de charger les transactions.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLowerCase();

    if (!normalizedQuery) return items;

    return items.filter((item) =>
      [
        item.description,
        item.reference,
        item.type,
        item.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(normalizedQuery),
        ),
    );
  }, [items, query]);

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
        <Text style={styles.title}>Transactions</Text>
        <Text style={styles.subtitle}>
          Historique financier de votre compte.
        </Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher une transaction"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        autoCapitalize="none"
      />

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => load()}>
            <Text style={styles.retry}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingList}>
          <Skeleton height={104} radius={radius.xl} />
          <Skeleton height={104} radius={radius.xl} />
          <Skeleton height={104} radius={radius.xl} />
        </View>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="·"
          title={
            items.length === 0
              ? 'Aucune transaction'
              : 'Aucun résultat'
          }
          description={
            items.length === 0
              ? 'Vos paiements, ventes et retraits apparaîtront ici.'
              : 'Aucune transaction ne correspond à votre recherche.'
          }
        />
      ) : (
        <View style={styles.list}>
          {filteredItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                navigation.navigate(
                  'TransactionDetails',
                  {
                    transactionId: item.id,
                  },
                )
              }
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text
                    numberOfLines={1}
                    style={styles.description}
                  >
                    {item.description ||
                      item.reference ||
                      'Transaction'}
                  </Text>

                  <Text style={styles.date}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>

                <Money
                  amount={item.amount}
                  currency={item.currency}
                  size="sm"
                />
              </View>

              <View style={styles.cardBottom}>
                <StatusBadge
                  domain="escrow"
                  status={item.status}
                />

                {item.reference ? (
                  <Text
                    numberOfLines={1}
                    style={styles.reference}
                  >
                    {item.reference}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
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

  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  search: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },

  list: {
    gap: spacing[3],
  },

  loadingList: {
    gap: spacing[3],
  },

  card: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[4],
  },

  cardPressed: {
    opacity: 0.92,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  cardCopy: {
    flex: 1,
    gap: spacing[1],
  },

  description: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  date: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  reference: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  errorCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.redBorder,
    backgroundColor: colors.dark3,
    gap: spacing[2],
  },

  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  retry: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
