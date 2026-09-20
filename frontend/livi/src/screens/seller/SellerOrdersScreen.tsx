import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  sellerApi,
  SellerOrder,
} from '../../features/seller/sellerApi';

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

type Filter =
  | 'all'
  | 'pending'
  | 'shipping'
  | 'done';

const PENDING_STATUSES = new Set([
  'pending_payment',
  'payment_pending',
  'paid',
]);

const SHIPPING_STATUSES = new Set([
  'preparing',
  'shipping',
]);

const DONE_STATUSES = new Set([
  'delivered',
  'completed',
  'received',
]);

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active &&
          styles.filterChipActive,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          active &&
            styles.filterTextActive,
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.filterCount,
          active &&
            styles.filterCountActive,
        ]}
      >
        <Text
          style={[
            styles.filterCountText,
            active &&
              styles.filterCountTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function SellerOrderCard({
  order,
  onPress,
}: {
  order: SellerOrder;
  onPress: () => void;
}) {
  const itemCount = Array.isArray(
    order.items,
  )
    ? order.items.reduce(
        (total, item) =>
          total +
          Number(item.quantity ?? 0),
        0,
      )
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.referenceWrap}>
          <Text style={styles.eyebrow}>
            COMMANDE
          </Text>

          <Text
            numberOfLines={1}
            style={styles.reference}
          >
            {order.reference ??
              `#${String(
                order.id,
              ).slice(0, 8)}`}
          </Text>
        </View>

        <StatusBadge
          domain="order"
          status={order.status}
        />
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>
            Articles
          </Text>

          <Text style={styles.detailValue}>
            {itemCount != null
              ? itemCount
              : '—'}
          </Text>
        </View>

        <View style={styles.detail}>
          <Text style={styles.detailLabel}>
            Total
          </Text>

          <Money
            amount={
              order.total_amount ??
              order.total
            }
            currency={
              order.currency ??
              'FCFA'
            }
            size="sm"
            color={colors.gold}
          />
        </View>
      </View>

      {Array.isArray(order.items) &&
      order.items.length > 0 ? (
        <View style={styles.itemsPreview}>
          <Text style={styles.itemsPreviewTitle}>
            À préparer
          </Text>

          <Text
            numberOfLines={2}
            style={styles.itemsPreviewText}
          >
            {order.items
              .slice(0, 3)
              .map(
                (item) =>
                  `${item.product_name} × ${item.quantity}`,
              )
              .join(' · ')}
            {order.items.length > 3
              ? ` +${order.items.length - 3}`
              : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.openText}>
          Ouvrir la commande
        </Text>

        <Text style={styles.arrow}>
          →
        </Text>
      </View>
    </Pressable>
  );
}

export function SellerOrdersScreen({
  navigation,
}: any) {
  const [items, setItems] =
    useState<SellerOrder[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [filter, setFilter] =
    useState<Filter>('all');

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
          await sellerApi.orders({
            limit: 50,
          });

        setItems(
          normalizeList<SellerOrder>(
            response,
            ['orders', 'data'],
          ),
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger les commandes.',
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

  const pending = items.filter(
    (item) =>
      PENDING_STATUSES.has(
        String(
          item.status ?? '',
        ).toLowerCase(),
      ),
  );

  const shipping = items.filter(
    (item) =>
      SHIPPING_STATUSES.has(
        String(
          item.status ?? '',
        ).toLowerCase(),
      ),
  );

  const done = items.filter(
    (item) =>
      DONE_STATUSES.has(
        String(
          item.status ?? '',
        ).toLowerCase(),
      ),
  );

  const filteredItems = useMemo(() => {
    if (filter === 'pending') {
      return pending;
    }

    if (filter === 'shipping') {
      return shipping;
    }

    if (filter === 'done') {
      return done;
    }

    return items;
  }, [
    done,
    filter,
    items,
    pending,
    shipping,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton
          height={120}
          radius={radius.xl}
        />

        <Skeleton
          height={155}
          radius={radius.xl}
        />

        <Skeleton
          height={155}
          radius={radius.xl}
        />

        <Skeleton
          height={155}
          radius={radius.xl}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) =>
          String(item.id)
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          filteredItems.length === 0 &&
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
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>
                  ACTIVITÉ VENDEUR
                </Text>

                <Text style={styles.title}>
                  Commandes
                </Text>

                <Text style={styles.subtitle}>
                  Suivez chaque commande depuis votre
                  boutique.
                </Text>
              </View>

              <View style={styles.totalBadge}>
                <Text style={styles.totalNumber}>
                  {items.length}
                </Text>

                <Text style={styles.totalLabel}>
                  total
                </Text>
              </View>
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

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[
                {
                  id: 'all' as const,
                  label: 'Toutes',
                  count: items.length,
                },
                {
                  id: 'pending' as const,
                  label: 'À traiter',
                  count: pending.length,
                },
                {
                  id: 'shipping' as const,
                  label: 'En livraison',
                  count: shipping.length,
                },
                {
                  id: 'done' as const,
                  label: 'Terminées',
                  count: done.length,
                },
              ]}
              keyExtractor={(item) => item.id}
              contentContainerStyle={
                styles.filters
              }
              renderItem={({ item }) => (
                <FilterChip
                  label={item.label}
                  count={item.count}
                  active={
                    filter === item.id
                  }
                  onPress={() =>
                    setFilter(item.id)
                  }
                />
              )}
            />

            {filteredItems.length > 0 ? (
              <View style={styles.listIntro}>
                <Text style={styles.listTitle}>
                  {filter === 'all'
                    ? 'Toutes les commandes'
                    : filter === 'pending'
                      ? 'Commandes à traiter'
                      : filter === 'shipping'
                        ? 'Commandes en livraison'
                        : 'Commandes terminées'}
                </Text>

                <Text style={styles.listSubtitle}>
                  {filteredItems.length}{' '}
                  commande
                  {filteredItems.length >
                  1
                    ? 's'
                    : ''}
                </Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="L"
              title={
                filter === 'pending'
                  ? 'Rien à traiter'
                  : filter === 'shipping'
                    ? 'Aucune commande en livraison'
                    : filter === 'done'
                      ? 'Aucune commande terminée'
                      : 'Aucune commande pour l’instant'
              }
              description={
                filter === 'pending'
                  ? 'Les commandes nécessitant une action apparaîtront ici.'
                  : filter === 'shipping'
                    ? 'Les commandes confiées à la livraison apparaîtront ici.'
                    : 'Les commandes reçues dans votre boutique apparaîtront ici.'
              }
              actionLabel={
                filter === 'all'
                  ? undefined
                  : 'Voir toutes les commandes'
              }
              onAction={() =>
                setFilter('all')
              }
            />
          </View>
        }
        renderItem={({ item }) => (
          <SellerOrderCard
            order={item}
            onPress={() =>
              navigation.navigate(
                'SellerOrderDetails',
                {
                  orderId: item.id,
                },
              )
            }
          />
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
    marginBottom: spacing[4],
    flexDirection: 'row',
    alignItems: 'flex-end',
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

  totalBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalNumber: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  totalLabel: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.textMuted,
  },

  errorBox: {
    marginBottom: spacing[3],
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
    color: colors.red,
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  filters: {
    gap: spacing[2],
    paddingBottom: spacing[4],
  },

  filterChip: {
    minHeight: 38,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  filterChipActive: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  filterText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  filterTextActive: {
    color: colors.gold,
  },

  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterCountActive: {
    backgroundColor: colors.gold,
  },

  filterCountText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.textMuted,
  },

  filterCountTextActive: {
    color: colors.dark,
  },

  listIntro: {
    paddingBottom: spacing[3],
  },

  listTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  listSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  card: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  cardPressed: {
    opacity: 0.92,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  referenceWrap: {
    flex: 1,
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },

  reference: {
    marginTop: 3,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  detailsRow: {
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },

  detail: {
    flex: 1,
  },

  detailLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  detailValue: {
    marginTop: 3,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  itemsPreview: {
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
  },

  itemsPreviewTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.textMuted,
  },

  itemsPreviewText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.gray2,
  },

  cardFooter: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  openText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  arrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  emptyWrapper: {
    minHeight: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
