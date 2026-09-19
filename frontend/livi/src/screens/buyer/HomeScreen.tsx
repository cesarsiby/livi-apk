import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useSafeAreaInsets } from '@react-navigation/native';

import { buyerApi } from '../../features/buyer/buyerApi';
import { ordersApi, Order } from '../../features/orders/ordersApi';
import { catalogueApi, Product } from '../../features/catalogue/catalogueApi';
import { categoriesApi, Category } from '../../features/catalogue/categoriesApi';
import { socialApi, FeedItem } from '../../features/social/socialApi';

import { resolveMediaUrl } from '../../services/api/media';
import { normalizeList } from '../../services/api/normalize';

import { useWalletStore } from '../../features/wallet/walletStore';
import { useNotifications } from '../../features/notifications/NotificationsProvider';
import { useCart } from '../../features/cart/cartStore';

import {
  EmptyState,
  Money,
  OrderCard,
  ProductCard,
  SearchBar,
  SectionHeader,
  Skeleton,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  shadow,
  spacing,
} from '../../design/theme';

type MotionPressableProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
};

function MotionPressable({
  children,
  onPress,
  style,
}: MotionPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 22,
      bounciness: 4,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

type EntranceProps = {
  children: React.ReactNode;
  progress: Animated.Value;
  offset?: number;
};

function Entrance({
  children,
  progress,
  offset = 14,
}: EntranceProps) {
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offset, 0],
  });

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function getFirstName(value?: string) {
  if (!value) return undefined;
  return value.trim().split(/\s+/)[0];
}

export function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const { wallet, refresh: refreshWallet } = useWalletStore();
  const { unreadCount, refresh: refreshNotifications } = useNotifications();
  const { count: cartCount } = useCart();

  const [firstName, setFirstName] = useState<string>();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const entrance = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const [
        meResult,
        ordersResult,
        categoriesResult,
        featuredResult,
        feedResult,
      ] = await Promise.allSettled([
        buyerApi.me(),
        ordersApi.list({
          status: 'active',
          limit: 1,
        }),
        categoriesApi.list(),
        catalogueApi.featured(),
        socialApi.feed({
          limit: 8,
        }),
      ]);

      let successfulSections = 0;

      if (meResult.status === 'fulfilled') {
        setFirstName(getFirstName((meResult.value as any)?.name));
        successfulSections++;
      }

      if (ordersResult.status === 'fulfilled') {
        const items = normalizeList<Order>(
          ordersResult.value,
          ['orders', 'data'],
        );

        setActiveOrder(items[0] ?? null);
        successfulSections++;
      }

      if (categoriesResult.status === 'fulfilled') {
        const items = Array.isArray(categoriesResult.value)
          ? categoriesResult.value
          : [];

        setCategories(items.slice(0, 10));
        successfulSections++;
      }

      if (featuredResult.status === 'fulfilled') {
        let items = normalizeList<Product>(
          featuredResult.value,
          ['products', 'data'],
        );

        if (!items.length) {
          try {
            const trending = await catalogueApi.trending();

            items = normalizeList<Product>(
              trending,
              ['products', 'data'],
            );
          } catch {
            // Pas d'erreur globale :
            // la section produits pourra simplement afficher son état vide.
          }
        }

        setProducts(items.slice(0, 6));
        successfulSections++;
      }

      if (feedResult.status === 'fulfilled') {
        const items = Array.isArray(feedResult.value)
          ? feedResult.value
          : [];

        setFeedItems(items.slice(0, 8));
        successfulSections++;
      }

      void refreshWallet();
      void refreshNotifications();

      if (successfulSections === 0) {
        setError(
          "L'accueil n'a pas pu être actualisé. Vérifiez votre connexion puis réessayez.",
        );
      }
    } catch (e: any) {
      setError(
        e?.message ??
          "L'accueil n'a pas pu être actualisé. Réessayez dans un instant.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshNotifications, refreshWallet]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (loading) {
      entrance.setValue(0);
      return;
    }

    Animated.spring(entrance, {
      toValue: 1,
      useNativeDriver: true,
      speed: 10,
      bounciness: 3,
    }).start();

    return () => {
      entrance.stopAnimation();
    };
  }, [entrance, loading]);

  const heroProduct = products[0];
  const heroImage = heroProduct
    ? resolveMediaUrl(
        heroProduct.image ?? heroProduct.images?.[0],
      )
    : undefined;

  const walletLockedAmount = Number(
    (wallet as any)?.locked_amount ?? 0,
  );

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: Math.max(insets.top, spacing[3]),
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.gold}
          />
        }
        contentContainerStyle={[
          styles.container,
          {
            paddingBottom: insets.bottom + spacing[12],
          },
        ]}
      >
        <Entrance progress={entrance}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                source={require('../../../assets/branding/livi-logo-on-dark.png')}
                resizeMode="contain"
                style={styles.logo}
                accessible
                accessibilityLabel="LIVI — Relier l'Afrique, un colis à la fois"
              />

              <Text style={styles.eyebrow}>
                {firstName ? `Bonjour ${firstName}` : 'Bonjour'}
              </Text>

              <Text style={styles.heading}>
                Qu’est-ce qui vous ferait plaisir ?
              </Text>
            </View>

            <View style={styles.headerActions}>
              <MotionPressable
                onPress={() => navigation.navigate('Notifications')}
                style={styles.iconButton}
              >
                <Text style={styles.iconGlyph}>•</Text>

                {unreadCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </MotionPressable>

              <MotionPressable
                onPress={() => navigation.navigate('Cart')}
                style={styles.cartButton}
              >
                <Text style={styles.cartLabel}>Panier</Text>

                {cartCount > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {cartCount > 99 ? '99+' : cartCount}
                    </Text>
                  </View>
                ) : null}
              </MotionPressable>
            </View>
          </View>
        </Entrance>

        <Entrance progress={entrance} offset={18}>
          <MotionPressable
            onPress={() => navigation.navigate('Catalogue')}
          >
            <SearchBar
              onPress={() => navigation.navigate('Catalogue')}
              placeholder="Rechercher un produit ou une boutique"
            />
          </MotionPressable>
        </Entrance>

        {error ? (
          <Entrance progress={entrance} offset={10}>
            <View style={styles.errorCard}>
              <View style={styles.errorIndicator} />

              <View style={styles.errorContent}>
                <Text style={styles.errorTitle}>
                  Un petit contretemps
                </Text>

                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>

              <Pressable onPress={() => void load()}>
                <Text style={styles.retry}>
                  Actualiser
                </Text>
              </Pressable>
            </View>
          </Entrance>
        ) : null}

        {loading ? (
          <View style={styles.loadingStack}>
            <Skeleton
              height={230}
              radius={radius['2xl']}
            />

            <View style={styles.loadingActions}>
              <Skeleton
                width="23%"
                height={82}
                radius={radius.xl}
              />
              <Skeleton
                width="23%"
                height={82}
                radius={radius.xl}
              />
              <Skeleton
                width="23%"
                height={82}
                radius={radius.xl}
              />
              <Skeleton
                width="23%"
                height={82}
                radius={radius.xl}
              />
            </View>

            <Skeleton
              height={28}
              width="42%"
              radius={radius.sm}
            />

            <View style={styles.loadingProducts}>
              <Skeleton
                width="48%"
                height={230}
                radius={radius.xl}
              />
              <Skeleton
                width="48%"
                height={230}
                radius={radius.xl}
              />
            </View>
          </View>
        ) : (
          <>
            {heroProduct ? (
              <Entrance progress={entrance} offset={22}>
                <MotionPressable
                  onPress={() =>
                    navigation.navigate('Product', {
                      productId: heroProduct.id,
                    })
                  }
                >
                  <ImageBackground
                    source={
                      heroImage
                        ? { uri: heroImage }
                        : undefined
                    }
                    style={styles.hero}
                    imageStyle={styles.heroImage}
                  >
                    <View style={styles.heroOverlay} />

                    <View style={styles.heroTopRow}>
                      <View style={styles.heroPill}>
                        <Text style={styles.heroPillText}>
                          À découvrir
                        </Text>
                      </View>

                      {heroProduct.stock != null &&
                      heroProduct.stock > 0 ? (
                        <View style={styles.stockPill}>
                          <View style={styles.stockDot} />
                          <Text style={styles.stockText}>
                            Disponible
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.heroContent}>
                      <Text style={styles.heroKicker}>
                        Une découverte signée LIVI
                      </Text>

                      <Text
                        numberOfLines={2}
                        style={styles.heroTitle}
                      >
                        {heroProduct.name ??
                          heroProduct.title ??
                          'Produit LIVI'}
                      </Text>

                      <View style={styles.heroFooter}>
                        <View>
                          <Text style={styles.heroPriceLabel}>
                            À partir de
                          </Text>

                          <Money
                            amount={Number(
                              heroProduct.display_price_xof ??
                                heroProduct.price_xof ??
                                0,
                            )}
                            currency={
                              heroProduct.currency ?? 'FCFA'
                            }
                            size="lg"
                            color={colors.white}
                          />
                        </View>

                        <View style={styles.heroCta}>
                          <Text style={styles.heroCtaText}>
                            Voir
                          </Text>
                          <Text style={styles.heroCtaArrow}>
                            →
                          </Text>
                        </View>
                      </View>
                    </View>
                  </ImageBackground>
                </MotionPressable>
              </Entrance>
            ) : null}

            <Entrance progress={entrance} offset={18}>
              <View style={styles.actionRow}>
                <QuickTile
                  mark="C"
                  label="Catalogue"
                  onPress={() =>
                    navigation.navigate('Catalogue')
                  }
                />

                <QuickTile
                  mark="W"
                  label="Wallet"
                  onPress={() =>
                    navigation.navigate('Wallet')
                  }
                />

                <QuickTile
                  mark="O"
                  label="Commandes"
                  onPress={() =>
                    navigation.navigate('Orders')
                  }
                />

                <QuickTile
                  mark="♡"
                  label="Favoris"
                  onPress={() =>
                    navigation.navigate('Wishlist')
                  }
                />
              </View>
            </Entrance>

            {walletLockedAmount > 0 ? (
              <Entrance progress={entrance} offset={14}>
                <MotionPressable
                  onPress={() =>
                    navigation.navigate('Wallet')
                  }
                  style={styles.walletStrip}
                >
                  <View style={styles.walletMark}>
                    <Text style={styles.walletMarkText}>
                      W
                    </Text>
                  </View>

                  <View style={styles.walletStripText}>
                    <Text style={styles.walletStripTitle}>
                      Vos fonds sont protégés
                    </Text>

                    <Text style={styles.walletStripDescription}>
                      {walletLockedAmount.toLocaleString(
                        'fr-FR',
                      )}{' '}
                      FCFA actuellement sécurisés par LIVI.
                    </Text>
                  </View>

                  <Text style={styles.walletArrow}>
                    →
                  </Text>
                </MotionPressable>
              </Entrance>
            ) : null}

            {categories.length > 0 ? (
              <Entrance progress={entrance} offset={18}>
                <View>
                  <SectionHeader
                    title="Explorer"
                    subtitle="Trouvez rapidement votre univers"
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryRow}
                  >
                    {categories.map((category) => (
                      <MotionPressable
                        key={category.id}
                        onPress={() =>
                          navigation.navigate('Catalogue', {
                            categoryId: category.id,
                            categoryName: category.name,
                          })
                        }
                        style={styles.categoryChip}
                      >
                        <View
                          style={styles.categoryDot}
                        />

                        <Text
                          style={styles.categoryText}
                          numberOfLines={1}
                        >
                          {category.name}
                        </Text>
                      </MotionPressable>
                    ))}
                  </ScrollView>
                </View>
              </Entrance>
            ) : null}

            {activeOrder ? (
              <Entrance progress={entrance} offset={18}>
                <View>
                  <SectionHeader
                    title="Votre commande"
                    subtitle="On garde un œil dessus pour vous"
                    actionLabel="Tout voir"
                    onAction={() =>
                      navigation.navigate('Orders')
                    }
                  />

                  <OrderCard
                    order={activeOrder}
                    onPress={() =>
                      navigation.navigate(
                        'OrderDetails',
                        {
                          orderId: activeOrder.id,
                        },
                      )
                    }
                  />
                </View>
              </Entrance>
            ) : null}

            <Entrance progress={entrance} offset={18}>
              <View>
                <SectionHeader
                  title="À découvrir sur LIVI"
                  subtitle="Des produits à retrouver maintenant"
                  actionLabel="Tout voir"
                  onAction={() =>
                    navigation.navigate('Catalogue')
                  }
                />

                {products.length > 0 ? (
                  <View style={styles.productGrid}>
                    {products.map((product) => (
                      <View
                        key={product.id}
                        style={styles.productItem}
                      >
                        <ProductCard
                          product={product}
                          onPress={() =>
                            navigation.navigate(
                              'Product',
                              {
                                productId:
                                  product.id,
                              },
                            )
                          }
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <EmptyState
                    icon="□"
                    title="Le catalogue arrive"
                    description="Aucun produit n'est actuellement mis en avant. Parcourez le catalogue complet pour continuer votre découverte."
                    actionLabel="Ouvrir le catalogue"
                    onAction={() =>
                      navigation.navigate('Catalogue')
                    }
                  />
                )}
              </View>
            </Entrance>

            {feedItems.length > 0 ? (
              <Entrance progress={entrance} offset={18}>
                <View>
                  <SectionHeader
                    title="Voir, découvrir, choisir"
                    subtitle="Le shopping en vidéo"
                    actionLabel="Voir tout"
                    onAction={() =>
                      navigation.navigate('Feed')
                    }
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.feedRow}
                  >
                    {feedItems.map((item) => {
                      const image = resolveMediaUrl(
                        item.thumbnail_url ??
                          item.poster_url,
                      );

                      return (
                        <MotionPressable
                          key={item.id}
                          onPress={() =>
                            navigation.navigate(
                              'Feed',
                            )
                          }
                          style={styles.feedCard}
                        >
                          {image ? (
                            <Image
                              source={{ uri: image }}
                              resizeMode="cover"
                              style={styles.feedImage}
                            />
                          ) : (
                            <View
                              style={[
                                styles.feedImage,
                                styles.feedPlaceholder,
                              ]}
                            >
                              <Text
                                style={
                                  styles.feedPlaceholderMark
                                }
                              >
                                LIVI
                              </Text>
                            </View>
                          )}

                          <View
                            style={styles.feedMeta}
                          >
                            <Text
                              style={styles.feedVendor}
                              numberOfLines={1}
                            >
                              {item.vendor_name ??
                                'Boutique LIVI'}
                            </Text>

                            <Text
                              style={styles.feedTitle}
                              numberOfLines={2}
                            >
                              {item.title ??
                                item.product_name ??
                                'Découvrir la vidéo'}
                            </Text>
                          </View>
                        </MotionPressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </Entrance>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function QuickTile({
  mark,
  label,
  onPress,
}: {
  mark: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      onPress={onPress}
      style={styles.quickTile}
    >
      <View style={styles.quickTileMark}>
        <Text style={styles.quickTileMarkText}>
          {mark}
        </Text>
      </View>

      <Text style={styles.quickTileLabel}>
        {label}
      </Text>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    gap: spacing[5],
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[4],
  },

  headerLeft: {
    flex: 1,
  },

  logo: {
    width: 74,
    height: 28,
    marginBottom: spacing[3],
  },

  eyebrow: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
    marginBottom: spacing[1],
  },

  heading: {
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    lineHeight: 29,
    color: colors.textPrimary,
    maxWidth: 280,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[1],
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },

  iconGlyph: {
    fontFamily: fonts.brandBold,
    fontSize: fontSize.lg,
    lineHeight: 18,
    color: colors.gray3,
  },

  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.dark,
  },

  notificationBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.dark,
  },

  cartButton: {
    minHeight: 42,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold3,
  },

  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 19,
    height: 19,
    borderRadius: radius.full,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold3,
  },

  cartBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.dark,
  },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  errorIndicator: {
    width: 5,
    alignSelf: 'stretch',
    borderRadius: radius.full,
    backgroundColor: colors.red,
  },

  errorContent: {
    flex: 1,
    gap: 2,
  },

  errorTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  retry: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold3,
  },

  loadingStack: {
    gap: spacing[5],
  },

  loadingActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  loadingProducts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  hero: {
    height: 230,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.dark4,
    ...shadow.lg,
  },

  heroImage: {
    borderRadius: radius['2xl'],
  },

  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 15, 26, 0.50)',
  },

  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
  },

  heroPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 15, 26, 0.72)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  heroPillText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.gold3,
  },

  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 15, 26, 0.72)',
    borderWidth: 1,
    borderColor: colors.greenBorder,
  },

  stockDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },

  stockText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.green,
  },

  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },

  heroKicker: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.gray3,
    marginBottom: 4,
  },

  heroTitle: {
    fontFamily: fonts.brand,
    fontSize: fontSize.xl,
    lineHeight: 25,
    color: colors.white,
    maxWidth: '90%',
  },

  heroFooter: {
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  heroPriceLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.gray3,
    marginBottom: 1,
  },

  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    ...shadow.gold,
  },

  heroCtaText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  heroCtaArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.dark,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  quickTile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[2],
  },

  quickTileMark: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },

  quickTileMarkText: {
    fontFamily: fonts.brandBold,
    fontSize: fontSize.md,
    color: colors.gold2,
  },

  quickTileLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  walletStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  walletMark: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  walletMarkText: {
    fontFamily: fonts.brandBold,
    fontSize: fontSize.sm,
    color: colors.gold2,
  },

  walletStripText: {
    flex: 1,
    gap: 2,
  },

  walletStripTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  walletStripDescription: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 15,
    color: colors.textMuted,
  },

  walletArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.gold2,
  },

  categoryRow: {
    gap: spacing[2],
    paddingVertical: 2,
  },

  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 11,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  categoryText: {
    maxWidth: 140,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gray3,
  },

  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing[4],
  },

  productItem: {
    width: '48%',
  },

  feedRow: {
    gap: spacing[3],
  },

  feedCard: {
    width: 160,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  feedImage: {
    width: 160,
    height: 190,
    backgroundColor: colors.dark4,
  },

  feedPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  feedPlaceholderMark: {
    fontFamily: fonts.brandBold,
    fontSize: fontSize.lg,
    letterSpacing: 2,
    color: colors.gold2,
  },

  feedMeta: {
    padding: spacing[3],
    gap: 4,
  },

  feedVendor: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.gold2,
  },

  feedTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: 17,
    color: colors.textPrimary,
  },
});
