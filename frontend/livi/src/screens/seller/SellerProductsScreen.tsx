import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  sellerApi,
  SellerProduct,
} from '../../features/seller/sellerApi';

import { normalizeList } from '../../services/api/normalize';
import { resolveMediaUrl } from '../../services/api/media';

import {
  EmptyState,
  Money,
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
  | 'out';

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
    </Pressable>
  );
}

function ProductListCard({
  product,
  onPress,
}: {
  product: SellerProduct;
  onPress: () => void;
}) {
  const name =
    product.name ??
    product.title ??
    'Produit';

  const price =
    product.price_xof ??
    product.price;

  const stock =
    typeof product.stock === 'number'
      ? product.stock
      : null;

  const outOfStock =
    stock !== null && stock <= 0;

  const image = resolveMediaUrl(
    product.images?.[0],
  );

  const scale = useRef(1);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.current = 0.985;
      }}
      onPressOut={() => {
        scale.current = 1;
      }}
      style={({ pressed }) => [
        styles.productCard,
        pressed && styles.productPressed,
      ]}
    >
      <View style={styles.productTop}>
        <View style={styles.productImageWrap}>
          {image ? (
            <Image
              source={{ uri: image }}
              resizeMode="cover"
              style={styles.productImage}
            />
          ) : (
            <View style={styles.productPlaceholder}>
              <Text
                style={
                  styles.productPlaceholderText
                }
              >
                L
              </Text>
            </View>
          )}

          {outOfStock ? (
            <View style={styles.outBadge}>
              <Text style={styles.outBadgeText}>
                RUPTURE
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.productIdentity}>
          <Text
            numberOfLines={2}
            style={styles.productName}
          >
            {name}
          </Text>

          {price != null ? (
            <Money
              amount={price}
              currency={
                product.currency ??
                'FCFA'
              }
              size="sm"
              color={colors.gold}
            />
          ) : (
            <Text style={styles.priceUnavailable}>
              Prix non renseigné
            </Text>
          )}

          <View style={styles.stockRow}>
            <View
              style={[
                styles.stockDot,
                outOfStock
                  ? styles.stockDotOut
                  : styles.stockDotOk,
              ]}
            />

            <Text
              style={[
                styles.stockText,
                outOfStock &&
                  styles.stockTextOut,
              ]}
            >
              {outOfStock
                ? 'Rupture de stock'
                : stock !== null
                  ? `${stock} en stock`
                  : 'Stock non renseigné'}
            </Text>
          </View>
        </View>

        <Text style={styles.chevron}>
          ›
        </Text>
      </View>

      <View style={styles.productFooter}>
        <View style={styles.statusWrap}>
          <Text style={styles.statusLabel}>
            Statut
          </Text>

          <View
            style={[
              styles.statusBadge,
              String(
                product.status ?? '',
              ).toLowerCase() === 'active' &&
                styles.statusBadgeActive,
            ]}
          >
            <Text style={styles.statusText}>
              {product.status ?? '—'}
            </Text>
          </View>
        </View>

        <Text style={styles.editHint}>
          Modifier →
        </Text>
      </View>
    </Pressable>
  );
}

function ProductSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <Skeleton
        width={82}
        height={82}
        radius={radius.lg}
      />

      <View style={styles.skeletonContent}>
        <Skeleton
          width="78%"
          height={16}
          radius={radius.sm}
        />

        <Skeleton
          width="40%"
          height={15}
          radius={radius.sm}
        />

        <Skeleton
          width="52%"
          height={12}
          radius={radius.sm}
        />
      </View>
    </View>
  );
}

export function SellerProductsScreen({
  navigation,
}: any) {
  const [items, setItems] =
    useState<SellerProduct[]>([]);

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
          await sellerApi.products({
            limit: 50,
          });

        setItems(
          normalizeList<SellerProduct>(
            response,
            ['products', 'data'],
          ),
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger vos produits.',
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

  const activeCount = items.filter(
    (item) =>
      String(
        item.status ?? '',
      ).toLowerCase() === 'active',
  ).length;

  const outOfStockCount = items.filter(
    (item) =>
      typeof item.stock === 'number' &&
      item.stock <= 0,
  ).length;

  const filteredItems = useMemo(() => {
    if (filter === 'active') {
      return items.filter(
        (item) =>
          String(
            item.status ?? '',
          ).toLowerCase() === 'active',
      );
    }

    if (filter === 'out') {
      return items.filter(
        (item) =>
          typeof item.stock === 'number' &&
          item.stock <= 0,
      );
    }

    return items;
  }, [filter, items]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton
          height={100}
          radius={radius.xl}
        />

        <ProductSkeleton />
        <ProductSkeleton />
        <ProductSkeleton />
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
                  MA BOUTIQUE
                </Text>

                <Text style={styles.title}>
                  Produits
                </Text>

                <Text style={styles.subtitle}>
                  Gérez votre catalogue, vos prix et vos
                  stocks.
                </Text>
              </View>

              <View style={styles.totalBadge}>
                <Text style={styles.totalNumber}>
                  {items.length}
                </Text>

                <Text style={styles.totalLabel}>
                  produits
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.addButton}
              onPress={() =>
                navigation.navigate(
                  'SellerProductEditor',
                  {},
                )
              }
            >
              <View style={styles.addIcon}>
                <Text style={styles.addIconText}>
                  +
                </Text>
              </View>

              <View style={styles.addContent}>
                <Text style={styles.addTitle}>
                  Ajouter un produit
                </Text>

                <Text style={styles.addSubtitle}>
                  Créer une nouvelle fiche produit
                </Text>
              </View>

              <Text style={styles.addArrow}>
                ›
              </Text>
            </Pressable>

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
              data={[
                {
                  id: 'all' as const,
                  label: 'Tous',
                  count: items.length,
                },
                {
                  id: 'active' as const,
                  label: 'Actifs',
                  count: activeCount,
                },
                {
                  id: 'out' as const,
                  label: 'Ruptures',
                  count: outOfStockCount,
                },
              ]}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
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
                    ? 'Votre catalogue'
                    : filter === 'active'
                      ? 'Produits actifs'
                      : 'Produits à réapprovisionner'}
                </Text>

                <Text style={styles.listSubtitle}>
                  {filteredItems.length}{' '}
                  résultat
                  {filteredItems.length > 1
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
                filter === 'out'
                  ? 'Aucune rupture'
                  : filter === 'active'
                    ? 'Aucun produit actif'
                    : 'Aucun produit pour l’instant'
              }
              description={
                filter === 'out'
                  ? 'Aucun de vos produits ne présente actuellement un stock nul.'
                  : filter === 'active'
                    ? 'Les produits actifs apparaîtront ici.'
                    : 'Créez votre premier produit pour commencer à vendre sur Livi.'
              }
              actionLabel={
                filter === 'all'
                  ? 'Ajouter un produit'
                  : 'Voir tous les produits'
              }
              onAction={() => {
                if (filter === 'all') {
                  navigation.navigate(
                    'SellerProductEditor',
                    {},
                  );
                } else {
                  setFilter('all');
                }
              }}
            />
          </View>
        }
        renderItem={({ item }) => (
          <ProductListCard
            product={item}
            onPress={() =>
              navigation.navigate(
                'SellerProductEditor',
                {
                  productId: item.id,
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
    marginBottom: spacing[5],
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
    width: 58,
    height: 58,
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

  addButton: {
    minHeight: 78,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
  },

  addIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xl,
    color: colors.gold,
  },

  addContent: {
    flex: 1,
    marginLeft: spacing[3],
  },

  addTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  addSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.dark,
    opacity: 0.65,
  },

  addArrow: {
    marginLeft: spacing[3],
    fontFamily: fonts.body,
    fontSize: fontSize['2xl'],
    color: colors.dark,
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

  filters: {
    gap: spacing[2],
    paddingTop: spacing[5],
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

  productCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  productPressed: {
    opacity: 0.92,
  },

  productTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  productImageWrap: {
    width: 82,
    height: 82,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.dark4,
  },

  productImage: {
    width: '100%',
    height: '100%',
  },

  productPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark4,
  },

  productPlaceholderText: {
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    color: colors.gold,
  },

  outBadge: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 5,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.redDim,
    alignItems: 'center',
  },

  outBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 7,
    letterSpacing: 0.6,
    color: colors.red,
  },

  productIdentity: {
    flex: 1,
    minHeight: 82,
    justifyContent: 'center',
  },

  productName: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  priceUnavailable: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  stockRow: {
    marginTop: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  stockDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },

  stockDotOk: {
    backgroundColor: colors.green,
  },

  stockDotOut: {
    backgroundColor: colors.red,
  },

  stockText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  stockTextOut: {
    color: colors.red,
  },

  chevron: {
    fontFamily: fonts.body,
    fontSize: fontSize['2xl'],
    color: colors.textMuted,
  },

  productFooter: {
    marginTop: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
  },

  statusBadgeActive: {
    backgroundColor: colors.greenDim,
  },

  statusText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 8,
    color: colors.textSecondary,
  },

  editHint: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  emptyWrapper: {
    minHeight: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },

  skeletonCard: {
    minHeight: 116,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'center',
  },

  skeletonContent: {
    flex: 1,
    gap: spacing[2],
  },
});
