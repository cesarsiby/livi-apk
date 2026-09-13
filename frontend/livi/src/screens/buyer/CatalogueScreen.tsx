import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { catalogueApi, Product } from '../../features/catalogue/catalogueApi';
import { categoriesApi, Category } from '../../features/catalogue/categoriesApi';
import { buyerApi } from '../../features/buyer/buyerApi';
import { normalizeList } from '../../services/api/normalize';
import { EmptyState, ProductCard, SearchBar, Skeleton } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// ═══════════════════════════════════════════════════════════════
// LIVI 2.0 — Catalogue (RAPPORT_UXUI_SESSION21)
//
// Ajoute recherche + catégories au-dessus de la grille produits : l'ancien
// écran n'avait ni l'un ni l'autre alors que /products/search et
// /categories existent côté backend et n'étaient utilisés nulle part
// (constat C7 de l'audit).
//
// Le filtre par catégorie est appliqué CÔTÉ CLIENT : GET /products
// n'accepte pas de paramètre category_id côté serveur (vérifié dans
// backend/livi/src/routes/products.js — seuls q et limit sont acceptés),
// alors que chaque produit renvoie bien son category_id. On filtre donc la
// liste déjà reçue plutôt que de simuler un filtre serveur qui n'existe
// pas.
// ═══════════════════════════════════════════════════════════════

export function CatalogueScreen({ navigation, route }: any) {
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(route?.params?.categoryId);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadBase = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [list, cats, wishlist] = await Promise.allSettled([
        catalogueApi.list({ limit: 60 }),
        categoriesApi.list(),
        buyerApi.wishlist(),
      ]);
      if (list.status === 'fulfilled') {
        setAllProducts(normalizeList<Product>(list.value, ['products', 'data']));
      }
      if (cats.status === 'fulfilled' && Array.isArray(cats.value)) setCategories(cats.value);
      if (wishlist.status === 'fulfilled') {
        const items = normalizeList<any>(wishlist.value, ['items', 'wishlist', 'data']);
        setFavoriteIds(new Set(items.map((it: any) => String(it.product_id ?? it.id))));
      }
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger le catalogue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadBase(); }, [loadBase]));

  // Un tap sur une catégorie depuis Home renvoie ici avec un nouveau
  // categoryId ; l'écran restant monté (onglet), on doit resynchroniser.
  useEffect(() => {
    if (route?.params?.categoryId !== undefined) setSelectedCategoryId(route.params.categoryId);
  }, [route?.params?.categoryId]);

  // Recherche serveur, avec un court débounce pour ne pas spammer l'API à chaque frappe.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      catalogueApi.search(q)
        .then((res: any) => setSearchResults(normalizeList<Product>(res, ['products', 'data'])))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const activeList = searchResults ?? allProducts;
  const visibleProducts = selectedCategoryId
    ? activeList.filter(p => p.category_id === selectedCategoryId)
    : activeList;
  const selectedCategoryName = categories.find(c => c.id === selectedCategoryId)?.name;

  async function toggleFavorite(product: Product) {
    const id = product.id;
    const isFav = favoriteIds.has(id);
    setFavoriteIds(prev => {
      const next = new Set(prev);
      isFav ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      isFav ? await buyerApi.removeWishlist(id) : await buyerApi.addWishlist(id);
    } catch {
      // Échec réseau : on revient à l'état réel plutôt que de mentir sur le favori.
      setFavoriteIds(prev => {
        const next = new Set(prev);
        isFav ? next.add(id) : next.delete(id);
        return next;
      });
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Rechercher un produit…" />
      </View>

      {categories.length > 0 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.categoryRow}
          renderItem={({ item }) => {
            const active = item.id === selectedCategoryId;
            return (
              <Pressable
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setSelectedCategoryId(active ? undefined : item.id)}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => loadBase()}><Text style={styles.retryLink}>Réessayer</Text></Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingGrid}>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} width="48%" height={210} radius={radius.lg} />)}
        </View>
      ) : (
        <FlatList
          data={visibleProducts}
          keyExtractor={p => p.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadBase(true)} tintColor={colors.gold} />}
          ListEmptyComponent={
            searching ? (
              <Text style={styles.searchingText}>Recherche en cours…</Text>
            ) : (
              <EmptyState
                icon="🔍"
                title={query ? 'Aucun résultat' : 'Aucun produit pour l\u2019instant'}
                description={
                  query
                    ? `Rien ne correspond à « ${query} »${selectedCategoryName ? ` dans ${selectedCategoryName}` : ''}.`
                    : 'Le catalogue LIVI se remplit — revenez bientôt.'
                }
                actionLabel={selectedCategoryId ? 'Voir toutes les catégories' : undefined}
                onAction={selectedCategoryId ? () => setSelectedCategoryId(undefined) : undefined}
              />
            )
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => navigation.navigate('Product', { productId: item.id })}
              isFavorite={favoriteIds.has(item.id)}
              onToggleFavorite={() => toggleFavorite(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  header: { padding: spacing[4], paddingBottom: spacing[2] },
  categoryRow: { gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  categoryChip: { backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: spacing[2], paddingHorizontal: spacing[4] },
  categoryChipActive: { backgroundColor: colors.goldDim, borderColor: colors.goldBorder },
  categoryChipText: { fontFamily: fonts.bodySemibold, fontSize: fontSize.sm, color: colors.textSecondary },
  categoryChipTextActive: { color: colors.gold },
  errorBox: { marginHorizontal: spacing[4], padding: spacing[4], borderRadius: radius.md, backgroundColor: colors.redDim, borderWidth: 1, borderColor: colors.redBorder, gap: spacing[2] },
  errorText: { fontFamily: fonts.body, color: colors.red },
  retryLink: { fontFamily: fonts.bodyBold, color: colors.gold },
  loadingGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing[3], padding: spacing[4] },
  grid: { padding: spacing[4], flexGrow: 1 },
  gridRow: { justifyContent: 'space-between', marginBottom: spacing[3] },
  searchingText: { textAlign: 'center', paddingTop: spacing[10], color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.sm },
});
