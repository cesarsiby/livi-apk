import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { buyerApi } from '../../features/buyer/buyerApi';
import { ordersApi, Order } from '../../features/orders/ordersApi';
import { catalogueApi, Product } from '../../features/catalogue/catalogueApi';
import { categoriesApi, Category } from '../../features/catalogue/categoriesApi';
import { socialApi, FeedItem } from '../../features/social/socialApi';
import { resolveMediaUrl } from '../../services/api/media';
import { normalizeList } from '../../services/api/normalize';
import { useWalletStore } from '../../features/wallet/walletStore';
import { useNotifications } from '../../features/notifications/NotificationsProvider';
import { EmptyState, Money, OrderCard, ProductCard, QuickAction, SearchBar, SectionHeader, Skeleton } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// ═══════════════════════════════════════════════════════════════
// LIVI 2.0 — Accueil acheteur (RAPPORT_UXUI_SESSION21)
//
// Remplace l'ancien tab "Feed" (feed vidéo pur, sans utilité marchande)
// comme accueil, et récupère le contenu utile de BuyerDashboardScreen
// (écran "Accueil" complet mais totalement inatteignable — voir audit,
// constat C1). Rien n'est perdu : le feed vidéo reste consultable en
// entier via "Découvrir en vidéo → Voir tout" (route Feed, désormais un
// écran de pile plutôt que l'onglet d'accueil).
//
// Chaque appel réseau est indépendant (Promise.allSettled) : si un seul
// endpoint échoue (ex. /products/featured pas encore peuplé), le reste de
// l'accueil s'affiche quand même — contrairement à l'ancien Promise.all
// de BuyerDashboardScreen où un seul échec cassait tout l'écran.
// ═══════════════════════════════════════════════════════════════

export function HomeScreen({ navigation }: any) {
  const { wallet, refresh: refreshWallet } = useWalletStore();
  const { unreadCount, refresh: refreshNotifications } = useNotifications();

  const [firstName, setFirstName] = useState<string | undefined>();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [meResult, ordersResult, catsResult, productsResult, feedResult] = await Promise.allSettled([
        buyerApi.me(),
        ordersApi.list({ status: 'active', limit: 1 }),
        categoriesApi.list(),
        catalogueApi.featured(),
        socialApi.feed({ limit: 8 }),
      ]);

      if (meResult.status === 'fulfilled') setFirstName((meResult.value as any)?.name);

      if (ordersResult.status === 'fulfilled') {
        const list = normalizeList<Order>(ordersResult.value, ['orders', 'data']);
        setActiveOrder(list.length > 0 ? list[0] : null);
      }

      if (catsResult.status === 'fulfilled' && Array.isArray(catsResult.value)) {
        setCategories(catsResult.value);
      }

      let productList: Product[] = [];
      if (productsResult.status === 'fulfilled') {
        productList = normalizeList<Product>(productsResult.value, ['products', 'data']);
      }
      if (!productList || productList.length === 0) {
        try {
          const trending = await catalogueApi.trending();
          productList = normalizeList<Product>(trending, ['products', 'data']);
        } catch {
          // Silencieux : la sélection reste vide, l'état vide gère l'affichage.
        }
      }
      setProducts(productList.slice(0, 6));

      if (feedResult.status === 'fulfilled' && Array.isArray(feedResult.value)) {
        setFeedItems(feedResult.value.slice(0, 8));
      }

      void refreshWallet();
      void refreshNotifications();
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger l'accueil.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshWallet, refreshNotifications]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>LIVI</Text>
          <Text style={styles.greeting}>Bonjour{firstName ? `, ${firstName}` : ''}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.bell} hitSlop={10}>
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadCount > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <SearchBar onPress={() => navigation.navigate('Catalogue')} placeholder="Rechercher un produit, une boutique…" />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()}><Text style={styles.retryLink}>Réessayer</Text></Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={{ gap: spacing[3] }}>
          <Skeleton height={88} radius={radius.xl} />
          <Skeleton height={64} radius={radius.xl} />
          <Skeleton height={140} radius={radius.xl} />
        </View>
      ) : (
        <>
          {activeOrder ? (
            <View>
              <SectionHeader title="Commande en cours" actionLabel="Toutes mes commandes" onAction={() => navigation.navigate('Orders')} />
              <OrderCard order={activeOrder} onPress={() => navigation.navigate('OrderDetails', { orderId: activeOrder.id })} />
            </View>
          ) : null}

          <View>
            <View style={styles.quickActions}>
              <QuickAction icon="💳" label="Wallet" onPress={() => navigation.navigate('Wallet')} />
              <QuickAction icon="🔒" label="Protection" onPress={() => navigation.navigate('Escrow')} />
              <QuickAction icon="📦" label="Commandes" onPress={() => navigation.navigate('Orders')} />
              <QuickAction icon="❤️" label="Favoris" onPress={() => navigation.navigate('Wishlist')} />
            </View>
            {wallet ? (
              <Text style={styles.walletPeek}>
                Fonds protégés : <Money amount={wallet.locked_amount ?? 0} currency={wallet.currency ?? 'FCFA'} size="sm" color={colors.gold} />
              </Text>
            ) : null}
          </View>

          {categories.length > 0 ? (
            <View>
              <SectionHeader title="Catégories" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {categories.map(cat => (
                  <Pressable key={cat.id} style={styles.categoryChip} onPress={() => navigation.navigate('Catalogue', { categoryId: cat.id, categoryName: cat.name })}>
                    <Text style={styles.categoryChipText}>{cat.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View>
            <SectionHeader title="Sélection du moment" actionLabel="Voir tout" onAction={() => navigation.navigate('Catalogue')} />
            {products.length > 0 ? (
              <View style={styles.productGrid}>
                {products.map(p => (
                  <ProductCard key={p.id} product={p} onPress={() => navigation.navigate('Product', { productId: p.id })} />
                ))}
              </View>
            ) : (
              <EmptyState icon="🛍️" title="Aucun produit mis en avant pour l'instant" description="Le catalogue LIVI se remplit — revenez bientôt, ou parcourez le catalogue complet." actionLabel="Parcourir le catalogue" onAction={() => navigation.navigate('Catalogue')} />
            )}
          </View>

          {feedItems.length > 0 ? (
            <View>
              <SectionHeader title="Découvrir en vidéo" actionLabel="Voir tout" onAction={() => navigation.navigate('Feed')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedRow}>
                {feedItems.map(item => (
                  <Pressable key={item.id} style={styles.feedCard} onPress={() => navigation.navigate('Feed')}>
                    {item.thumbnail_url || item.poster_url ? (
                      <Image source={{ uri: resolveMediaUrl(item.thumbnail_url ?? item.poster_url) }} style={styles.feedImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.feedImage, styles.feedImagePlaceholder]}>
                        <Text style={{ fontSize: 24 }}>🎬</Text>
                      </View>
                    )}
                    <Text style={styles.feedTitle} numberOfLines={2}>{item.title ?? item.product_name ?? 'Vidéo LIVI'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[5], paddingBottom: spacing[12] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: fonts.bodyBold, letterSpacing: 2, color: colors.gold, fontSize: fontSize.xs },
  greeting: { fontFamily: fonts.brand, fontSize: fontSize['2xl'], color: colors.textPrimary, marginTop: 2 },
  bell: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: fontSize.md },
  bellBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: radius.full, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: colors.dark },
  bellBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.white },
  errorBox: { padding: spacing[4], borderRadius: radius.md, backgroundColor: colors.redDim, borderWidth: 1, borderColor: colors.redBorder, gap: spacing[2] },
  errorText: { fontFamily: fonts.body, color: colors.red },
  retryLink: { fontFamily: fonts.bodyBold, color: colors.gold },
  quickActions: { flexDirection: 'row', gap: spacing[3] },
  walletPeek: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing[3], textAlign: 'center' },
  categoryRow: { gap: spacing[2], paddingVertical: 2 },
  categoryChip: { backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: spacing[2], paddingHorizontal: spacing[4] },
  categoryChipText: { fontFamily: fonts.bodySemibold, fontSize: fontSize.sm, color: colors.textSecondary },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing[3] },
  feedRow: { gap: spacing[3], paddingVertical: 2 },
  feedCard: { width: 120 },
  feedImage: { width: 120, height: 160, borderRadius: radius.lg, backgroundColor: colors.dark4 },
  feedImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  feedTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing[2] },
});
