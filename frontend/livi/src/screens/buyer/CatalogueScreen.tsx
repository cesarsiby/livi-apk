import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  catalogueApi,
  Product,
} from '../../features/catalogue/catalogueApi';

import {
  categoriesApi,
  Category,
} from '../../features/catalogue/categoriesApi';

import { buyerApi } from '../../features/buyer/buyerApi';

import { normalizeList } from '../../services/api/normalize';

import {
  EmptyState,
  ProductCard,
  SearchBar,
  Skeleton,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.filterChip,
          active && styles.filterChipActive,
        ]}
      >
        <Text
          style={[
            styles.filterChipText,
            active && styles.filterChipTextActive,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function ProductSkeleton() {
  return (
    <View style={styles.productSkeleton}>
      <Skeleton
        width="100%"
        height={170}
        radius={radius.xl}
      />
      <Skeleton
        width="78%"
        height={15}
        radius={radius.sm}
      />
      <Skeleton
        width="42%"
        height={15}
        radius={radius.sm}
      />
    </View>
  );
}

export function CatalogueScreen({
  navigation,
  route,
}: any) {
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] =
    useState<Product[] | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<string | undefined>(
      route?.params?.categoryId,
    );

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    new Set(),
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const loadBase = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const [list, cats, wishlist] =
          await Promise.allSettled([
            catalogueApi.list({
              limit: 60,
            }),
            categoriesApi.list(),
            buyerApi.wishlist(),
          ]);

        if (list.status === 'fulfilled') {
          setAllProducts(
            normalizeList<Product>(
              list.value,
              ['products', 'data'],
            ),
          );
        }

        if (
          cats.status === 'fulfilled' &&
          Array.isArray(cats.value)
        ) {
          setCategories(cats.value);
        }

        if (wishlist.status === 'fulfilled') {
          const items = normalizeList<any>(
            wishlist.value,
            ['items', 'wishlist', 'data'],
          );

          setFavoriteIds(
            new Set(
              items.map((item: any) =>
                String(
                  item.product_id ?? item.id,
                ),
              ),
            ),
          );
        }

        if (
          list.status === 'rejected' &&
          cats.status === 'rejected'
        ) {
          setError(
            'Impossible de charger le catalogue.',
          );
        }
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger le catalogue.',
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
      loadBase();
    }, [loadBase]),
  );

  useEffect(() => {
    if (route?.params?.categoryId !== undefined) {
      setSelectedCategoryId(
        route.params.categoryId,
      );
    }
  }, [route?.params?.categoryId]);

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);

    const timer = setTimeout(() => {
      catalogueApi
        .search(q)
        .then((response: any) => {
          setSearchResults(
            normalizeList<Product>(
              response,
              ['products', 'data'],
            ),
          );
        })
        .catch(() => {
          setSearchResults([]);
        })
        .finally(() => {
          setSearching(false);
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const activeList =
    searchResults ?? allProducts;

  const visibleProducts = useMemo(() => {
    if (!selectedCategoryId) {
      return activeList;
    }

    return activeList.filter(
      (product) =>
        product.category_id === selectedCategoryId,
    );
  }, [activeList, selectedCategoryId]);

  const selectedCategoryName = useMemo(
    () =>
      categories.find(
        (category) =>
          category.id === selectedCategoryId,
      )?.name,
    [categories, selectedCategoryId],
  );

  const activeFilterLabel =
    selectedCategoryName ?? 'Tous';

  const toggleFavorite = useCallback(
    async (product: Product) => {
      const id = product.id;
      const wasFavorite = favoriteIds.has(id);

      setFavoriteIds((current) => {
        const next = new Set(current);

        if (wasFavorite) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      });

      try {
        if (wasFavorite) {
          await buyerApi.removeWishlist(id);
        } else {
          await buyerApi.addWishlist(id);
        }
      } catch {
        setFavoriteIds((current) => {
          const next = new Set(current);

          if (wasFavorite) {
            next.add(id);
          } else {
            next.delete(id);
          }

          return next;
        });
      }
    },
    [favoriteIds],
  );

  const headerTranslate = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  const renderProduct = ({
    item,
    index,
  }: {
    item: Product;
    index: number;
  }) => (
    <Animated.View
      style={{
        flex: 1,
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [8 + index * 2, 0],
            }),
          },
        ],
      }}
    >
      <ProductCard
        product={item}
        onPress={() =>
          navigation.navigate('Product', {
            productId: item.id,
          })
        }
        isFavorite={favoriteIds.has(item.id)}
        onToggleFavorite={() =>
          toggleFavorite(item)
        }
      />
    </Animated.View>
  );

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.header,
          {
            opacity: entrance,
            transform: [
              {
                translateY: headerTranslate,
              },
            ],
          },
        ]}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>
              BOUTIQUE LIVI
            </Text>

            <Text style={styles.title}>
              Catalogue
            </Text>
          </View>

          <View style={styles.resultBadge}>
            <Text style={styles.resultBadgeText}>
              {visibleProducts.length}
            </Text>
          </View>
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Que recherchez-vous ?"
        />

        <View style={styles.utilityRow}>
          <View style={styles.utilityPill}>
            <View style={styles.utilityDot} />
            <Text style={styles.utilityText}>
              {searching
                ? 'Recherche…'
                : query.trim()
                  ? `Résultats pour « ${query.trim()} »`
                  : 'Produits disponibles'}
            </Text>
          </View>

          {selectedCategoryId ? (
            <Pressable
              style={styles.clearFilter}
              onPress={() =>
                setSelectedCategoryId(undefined)
              }
            >
              <Text style={styles.clearFilterText}>
                Effacer
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      {categories.length > 0 ? (
        <FlatList
          horizontal
          data={[
            {
              id: '__all__',
              name: 'Tous',
              slug: '__all__',
            },
            ...categories,
          ]}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            styles.categoriesContent
          }
          style={styles.categoriesList}
          renderItem={({ item }) => {
            const active =
              item.id === '__all__'
                ? !selectedCategoryId
                : item.id === selectedCategoryId;

            return (
              <FilterChip
                label={item.name}
                active={active}
                onPress={() => {
                  if (item.id === '__all__') {
                    setSelectedCategoryId(undefined);
                    return;
                  }

                  setSelectedCategoryId(
                    active
                      ? undefined
                      : item.id,
                  );
                }}
              />
            );
          }}
        />
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>
              Catalogue indisponible
            </Text>

            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>

          <Pressable
            onPress={() => loadBase()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              Réessayer
            </Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <FlatList
          data={[0, 1, 2, 3, 4, 5]}
          keyExtractor={(item) => String(item)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          renderItem={() => <ProductSkeleton />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={visibleProducts}
          keyExtractor={(product) => product.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadBase(true)}
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            visibleProducts.length > 0 ? (
              <View style={styles.listIntro}>
                <View>
                  <Text style={styles.listTitle}>
                    {activeFilterLabel}
                  </Text>

                  <Text style={styles.listSubtitle}>
                    {searchResults
                      ? `${visibleProducts.length} résultat${
                          visibleProducts.length > 1
                            ? 's'
                            : ''
                        }`
                      : `${visibleProducts.length} produit${
                          visibleProducts.length > 1
                            ? 's'
                            : ''
                        }`}
                  </Text>
                </View>

                {selectedCategoryName ? (
                  <View style={styles.activeFilterPill}>
                    <Text
                      style={styles.activeFilterText}
                    >
                      Filtre actif
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            searching ? (
              <View style={styles.emptySearch}>
                <View style={styles.searchLoader}>
                  <View style={styles.searchLoaderDot} />
                </View>

                <Text style={styles.emptySearchTitle}>
                  Recherche en cours
                </Text>

                <Text style={styles.emptySearchText}>
                  Nous cherchons les produits
                  correspondants.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyWrapper}>
                <EmptyState
                  icon="·"
                  title={
                    query
                      ? 'Aucun résultat'
                      : 'Aucun produit pour l’instant'
                  }
                  description={
                    query
                      ? `Rien ne correspond à « ${query} »${
                          selectedCategoryName
                            ? ` dans ${selectedCategoryName}`
                            : ''
                        }.`
                      : 'Le catalogue Livi se remplit. Revenez dès qu’il y aura de nouveaux produits.'
                  }
                  actionLabel={
                    selectedCategoryId
                      ? 'Voir tous les produits'
                      : query
                        ? 'Effacer la recherche'
                        : undefined
                  }
                  onAction={
                    selectedCategoryId
                      ? () =>
                          setSelectedCategoryId(
                            undefined,
                          )
                      : query
                        ? () => setQuery('')
                        : undefined
                  }
                />
              </View>
            )
          }
          renderItem={renderProduct}
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
    gap: spacing[4],
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  titleBlock: {
    flex: 1,
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

  resultBadge: {
    minWidth: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  utilityPill: {
    flex: 1,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  utilityDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  utilityText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  clearFilter: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  clearFilterText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.gold,
  },

  categoriesList: {
    flexGrow: 0,
  },

  categoriesContent: {
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },

  filterChip: {
    minHeight: 38,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    justifyContent: 'center',
  },

  filterChipActive: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  filterChipText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  filterChipTextActive: {
    color: colors.gold,
  },

  errorBox: {
    marginHorizontal: spacing[5],
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

  errorContent: {
    flex: 1,
  },

  errorTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  errorText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
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

  listIntro: {
    paddingBottom: spacing[4],
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
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

  activeFilterPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
  },

  activeFilterText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.gold,
  },

  grid: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[12],
    flexGrow: 1,
  },

  gridRow: {
    justifyContent: 'space-between',
    marginBottom: spacing[4],
    gap: spacing[3],
  },

  productSkeleton: {
    width: '48%',
    gap: spacing[2],
  },

  emptyWrapper: {
    flex: 1,
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptySearch: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },

  searchLoader: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchLoaderDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  emptySearchTitle: {
    marginTop: spacing[4],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  emptySearchText: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
