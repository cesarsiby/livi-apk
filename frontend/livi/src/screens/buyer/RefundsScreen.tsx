import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { buyerApi } from '../../features/buyer/buyerApi';
import { normalizeList } from '../../services/api/normalize';

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

function RefundCard({
  item,
}: {
  item: any;
}) {
  const orderId = String(
    item.order_id ??
      item.id ??
      '',
  );

  const shortOrder =
    orderId.length > 8
      ? orderId.slice(0, 8)
      : orderId;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>
            ↩
          </Text>
        </View>

        <View style={styles.identity}>
          <Text style={styles.title}>
            Commande #{shortOrder}
          </Text>

          {item.refunded_at ? (
            <Text style={styles.date}>
              Remboursé le{' '}
              {new Date(
                item.refunded_at,
              ).toLocaleDateString(
                'fr-FR',
              )}
            </Text>
          ) : (
            <Text style={styles.date}>
              Remboursement en cours
            </Text>
          )}
        </View>

        <StatusBadge
          domain="escrow"
          status={item.status}
        />
      </View>

      <View style={styles.amountBlock}>
        <Text style={styles.amountLabel}>
          Montant remboursé
        </Text>

        <Money
          amount={item.amount}
          currency={
            item.currency ?? 'FCFA'
          }
          size="lg"
          color={colors.gold}
        />
      </View>

      {item.shipping_fee != null &&
      Number(item.shipping_fee) > 0 ? (
        <View style={styles.shippingRow}>
          <Text style={styles.shippingLabel}>
            Frais de livraison
          </Text>

          <Money
            amount={item.shipping_fee}
            currency={
              item.currency ?? 'FCFA'
            }
            size="sm"
            color={colors.textMuted}
          />
        </View>
      ) : null}
    </View>
  );
}

export function RefundsScreen() {
  const [items, setItems] =
    useState<any[]>([]);

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
          await buyerApi.refunds();

        setItems(
          normalizeList<any>(
            response,
            ['refunds', 'data'],
          ),
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger les remboursements.',
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

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton
          height={150}
          radius={radius.xl}
        />

        <Skeleton
          height={150}
          radius={radius.xl}
        />

        <Skeleton
          height={150}
          radius={radius.xl}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          String(item.id ?? index)
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          items.length === 0 &&
            styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>
                FINANCES
              </Text>

              <Text style={styles.pageTitle}>
                Remboursements
              </Text>

              <Text style={styles.subtitle}>
                Retrouvez ici les montants retournés
                pour vos commandes.
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="↩"
            title="Aucun remboursement"
            description="Les remboursements liés à vos commandes apparaîtront ici lorsqu’ils seront enregistrés."
          />
        }
        renderItem={({ item }) => (
          <RefundCard item={item} />
        )}
        ItemSeparatorComponent={() => (
          <View
            style={{ height: spacing[3] }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  loadingScreen: {
    flex: 1,
    padding: spacing[5],
    gap: spacing[3],
    backgroundColor: colors.dark,
  },

  list: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  emptyList: {
    flexGrow: 1,
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

  pageTitle: {
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
    lineHeight: 17,
    color: colors.red,
  },

  card: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  icon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  identity: {
    flex: 1,
  },

  title: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  date: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  amountBlock: {
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  amountLabel: {
    marginBottom: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  shippingRow: {
    marginTop: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  shippingLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
