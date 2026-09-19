import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  ordersApi,
  Order,
} from '../../features/orders/ordersApi';

import { normalizeList } from '../../services/api/normalize';

import {
  EmptyState,
  OrderCard,
  Skeleton,
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
  | 'active'
  | 'delivered';

const ACTIVE_STATUSES = new Set([
  'pending_payment',
  'payment_pending',
  'paid',
  'preparing',
  'shipping',
  'disputed',
]);

const DELIVERED_STATUSES = new Set([
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
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.97,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
          }).start()
        }
        style={[
          styles.filterChip,
          active && styles.filterChipActive,
        ]}
      >
        <Text
          style={[
            styles.filterText,
            active && styles.filterTextActive,
          ]}
        >
          {label}
        </Text>

        {count != null ? (
          <View
            style={[
              styles.filterCount,
              active && styles.filterCountActive,
            ]}
          >
            <Text
              style={[
                styles.filterCountText,
                active && styles.filterCountTextActive,
              ]}
            >
              {count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function OrdersSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <Skeleton
            width="45%"
            height={16}
            radius={radius.sm}
          />
          <Skeleton
            width="25%"
            height={24}
            radius={radius.full}
          />
          <Skeleton
            width="100%"
            height={15}
            radius={radius.sm}
          />
          <Skeleton
            width="52%"
            height={14}
            radius={radius.sm}
          />
        </View>
      ))}
    </View>
  );
}

export function OrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] =
    useState<Filter>('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

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

      try {
        const response = await ordersApi.list({
          limit: 30,
        });

        setOrders(
          normalizeList<Order>(
            response,
            ['orders', 'data'],
          ),
        );
      } catch {
        // On conserve la dernière liste connue pendant une erreur réseau.
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
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const activeOrders = orders.filter((order) =>
    ACTIVE_STATUSES.has(
      String(order.status ?? '').toLowerCase(),
    ),
  );

  const deliveredOrders = orders.filter((order) =>
    DELIVERED_STATUSES.has(
      String(order.status ?? '').toLowerCase(),
    ),
  );

  const filteredOrders = orders.filter((order) => {
    const status = String(
      order.status ?? '',
    ).toLowerCase();

    if (filter === 'active') {
      return ACTIVE_STATUSES.has(status);
    }

    if (filter === 'delivered') {
      return DELIVERED_STATUSES.has(status);
    }

    return true;
  });

  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.header,
          {
            opacity: entrance,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.eyebrow}>
              MON ESPACE
            </Text>

            <Text style={styles.title}>
              Commandes
            </Text>
          </View>

          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeNumber}>
              {orders.length}
            </Text>

            <Text style={styles.totalBadgeLabel}>
              total
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryValue}>
              {activeOrders.length}
            </Text>

            <Text style={styles.summaryLabel}>
              en cours
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryBlock}>
            <Text style={styles.summaryValue}>
              {deliveredOrders.length}
            </Text>

            <Text style={styles.summaryLabel}>
              livrées
            </Text>
          </View>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          data={[
            {
              id: 'all' as const,
              label: 'Toutes',
              count: orders.length,
            },
            {
              id: 'active' as const,
              label: 'En cours',
              count: activeOrders.length,
            },
            {
              id: 'delivered' as const,
              label: 'Livrées',
              count: deliveredOrders.length,
            },
          ]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FilterChip
              label={item.label}
              count={item.count}
              active={filter === item.id}
              onPress={() => setFilter(item.id)}
            />
          )}
        />
      </Animated.View>

      {loading ? (
        <OrdersSkeleton />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) =>
            String(item.id)
          }
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            filteredOrders.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>
                  {filter === 'all'
                    ? 'Toutes vos commandes'
                    : filter === 'active'
                      ? 'Commandes en cours'
                      : 'Commandes livrées'}
                </Text>

                <Text style={styles.listSubtitle}>
                  {filteredOrders.length}{' '}
                  commande
                  {filteredOrders.length > 1
                    ? 's'
                    : ''}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <EmptyState
                icon="·"
                title={
                  filter === 'active'
                    ? 'Aucune commande en cours'
                    : filter === 'delivered'
                      ? 'Aucune commande livrée'
                      : 'Aucune commande pour l’instant'
                }
                description={
                  filter === 'active'
                    ? 'Vos commandes actuellement en préparation ou en livraison apparaîtront ici.'
                    : filter === 'delivered'
                      ? 'Vos commandes terminées apparaîtront ici.'
                      : 'Vos achats apparaîtront ici dès votre première commande.'
                }
                actionLabel={
                  filter === 'all'
                    ? 'Parcourir le catalogue'
                    : 'Voir toutes les commandes'
                }
                onAction={() => {
                  if (filter === 'all') {
                    navigation.navigate(
                      'Catalogue',
                    );
                  } else {
                    setFilter('all');
                  }
                }}
              />
            </View>
          }
          renderItem={({ item }) => (
            <Animated.View
              style={{
                opacity: entrance,
              }}
            >
              <OrderCard
                order={item}
                onPress={() =>
                  navigation.navigate(
                    'OrderDetails',
                    {
                      orderId: item.id,
                    },
                  )
                }
              />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => (
            <View
              style={{ height: spacing[3] }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
    marginBottom: 2,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    color: colors.textPrimary,
  },

  totalBadge: {
    minWidth: 54,
    minHeight: 54,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalBadgeNumber: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  totalBadgeLabel: {
    marginTop: -1,
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },

  summaryRow: {
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryBlock: {
    flex: 1,
    alignItems: 'center',
  },

  summaryValue: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
  },

  summaryLabel: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  filters: {
    gap: spacing[2],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },

  filterChip: {
    minHeight: 38,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
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
    paddingHorizontal: 5,
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

  listContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[12],
    flexGrow: 1,
  },

  listHeader: {
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

  skeletonList: {
    padding: spacing[5],
    gap: spacing[3],
  },

  skeletonCard: {
    minHeight: 148,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },

  emptyWrapper: {
    flex: 1,
    minHeight: 430,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
