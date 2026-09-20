import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
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
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

function WishlistCard({
  item,
  onOpen,
  onRemove,
}: {
  item: any;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const name =
    item.name ??
    item.title ??
    'Produit';

  const productId =
    item.product_id ??
    item.id;

  const price =
    item.display_price_xof ??
    item.price_xof ??
    item.price;

  const inStock =
    item.in_stock !== false &&
    !(typeof item.stock === 'number' &&
      item.stock <= 0);

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.favoriteIcon}>
          <Text style={styles.favoriteIconText}>
            ♥
          </Text>
        </View>

        <View style={styles.identity}>
          <Text
            numberOfLines={2}
            style={styles.title}
          >
            {name}
          </Text>

          {item.vendor_name ? (
            <Text style={styles.vendor}>
              {item.vendor_name}
            </Text>
          ) : null}
        </View>

        <Text style={styles.arrow}>›</Text>
      </View>

      <View style={styles.cardBottom}>
        <View>
          {price != null ? (
            <Money
              amount={price}
              currency={
                item.currency ?? 'FCFA'
              }
              size="sm"
              color={colors.gold}
            />
          ) : (
            <Text style={styles.priceUnavailable}>
              Prix non disponible
            </Text>
          )}

          <View style={styles.stockRow}>
            <View
              style={[
                styles.stockDot,
                inStock
                  ? styles.stockDotActive
                  : styles.stockDotInactive,
              ]}
            />

            <Text
              style={[
                styles.stockText,
                !inStock &&
                  styles.stockTextInactive,
              ]}
            >
              {inStock
                ? 'Disponible'
                : 'Rupture de stock'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          hitSlop={10}
          style={styles.removeButton}
        >
          <Text style={styles.removeText}>
            Retirer
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export function WishlistScreen({
  navigation,
}: any) {
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
          await buyerApi.wishlist();

        setItems(
          normalizeList<any>(
            response,
            ['items', 'wishlist', 'data'],
          ),
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger vos favoris.',
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

  const remove = useCallback(
    async (productId: string) => {
      try {
        setError('');

        await buyerApi.removeWishlist(
          productId,
        );

        setItems((current) =>
          current.filter(
            (item) =>
              String(
                item.product_id ??
                  item.id,
              ) !== productId,
          ),
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de retirer ce favori.',
        );
      }
    },
    [],
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton
          height={95}
          radius={radius.xl}
        />

        <Skeleton
          height={95}
          radius={radius.xl}
        />

        <Skeleton
          height={95}
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
          String(
            item.product_id ??
              item.id ??
              index,
          )
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
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>
                  MA SÉLECTION
                </Text>

                <Text style={styles.pageTitle}>
                  Favoris
                </Text>

                <Text style={styles.subtitle}>
                  Retrouvez les produits que vous
                  souhaitez garder sous la main.
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countNumber}>
                  {items.length}
                </Text>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {error}
                </Text>

                <Pressable
                  onPress={() =>
                    void load()
                  }
                >
                  <Text style={styles.retryText}>
                    Réessayer
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="♥"
            title="Aucun favori pour l’instant"
            description="Touchez le cœur sur un produit du catalogue pour le retrouver facilement ici."
            actionLabel="Parcourir le catalogue"
            onAction={() =>
              navigation.navigate('Catalogue')
            }
          />
        }
        renderItem={({ item }) => (
          <WishlistCard
            item={item}
            onOpen={() =>
              navigation.navigate(
                'Product',
                {
                  productId:
                    item.product_id ??
                    item.id,
                },
              )
            }
            onRemove={() =>
              remove(
                String(
                  item.product_id ??
                    item.id,
                ),
              )
            }
          />
        )}
        ItemSeparatorComponent={() => (
          <View
            style={{ height: spacing[3] }}
          />
        )}
        ListFooterComponent={
          items.length > 0 ? (
            <Pressable
              style={styles.catalogueButton}
              onPress={() =>
                navigation.navigate(
                  'Catalogue',
                )
              }
            >
              <Text
                style={styles.catalogueButtonText}
              >
                Continuer mes achats
              </Text>
            </Pressable>
          ) : null
        }
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

  countBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countNumber: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  errorBox: {
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

  card: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  cardPressed: {
    opacity: 0.92,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  favoriteIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  favoriteIconText: {
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  identity: {
    flex: 1,
  },

  title: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  vendor: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  arrow: {
    fontFamily: fonts.body,
    fontSize: fontSize['2xl'],
    color: colors.textMuted,
  },

  cardBottom: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  priceUnavailable: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  stockRow: {
    marginTop: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  stockDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },

  stockDotActive: {
    backgroundColor: colors.gold,
  },

  stockDotInactive: {
    backgroundColor: colors.red,
  },

  stockText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  stockTextInactive: {
    color: colors.red,
  },

  removeButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },

  removeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.red,
  },

  catalogueButton: {
    minHeight: 48,
    marginTop: spacing[5],
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  catalogueButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },
});
