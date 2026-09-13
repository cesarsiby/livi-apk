import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { sellerApi, SellerProduct } from '../../features/seller/sellerApi';
import { normalizeList } from '../../services/api/normalize';
import { resolveMediaUrl } from '../../services/api/media';
import { Button, Card, EmptyState, Money, Skeleton } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21) : trois corrections sur cet écran.
// - Constat C0 : r?.products ?? r?.data ?? [] ne fonctionnait jamais (GET
//   /vendor/products renvoie un tableau brut) — remplacé par normalizeList().
// - Constat C0-ter : item.price est toujours undefined, la vraie colonne
//   est price_xof — voir le commentaire sur SellerProduct dans sellerApi.ts.
// - Passage à <Money> (le formatage manuel .toLocaleString() sans locale
//   explicite était incohérent avec le reste de l'app).
export function SellerProductsScreen({ navigation }: any) {
  const [items, setItems] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback((isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    sellerApi.products({ limit: 50 })
      .then((r) => setItems(normalizeList<SellerProduct>(r, ['products', 'data'])))
      .catch((e) => setError(e?.message ?? 'Erreur de chargement.'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.loadingList}>
        <Skeleton height={84} radius={radius.lg} />
        <Skeleton height={84} radius={radius.lg} />
        <Skeleton height={84} radius={radius.lg} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(x) => String(x.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListHeaderComponent={
        <Button title="+ Ajouter un produit" onPress={() => navigation.navigate('SellerProductEditor', {})} style={{ marginBottom: spacing[2] }} />
      }
      ListEmptyComponent={
        <EmptyState
          icon="🛍️"
          title="Aucun produit pour l'instant"
          description={error || 'Ajoutez votre premier produit pour commencer à vendre sur LIVI.'}
        />
      }
      renderItem={({ item }) => {
        const image = resolveMediaUrl(item.images?.[0]);
        const outOfStock = typeof item.stock === 'number' && item.stock <= 0;
        return (
          <Pressable onPress={() => navigation.navigate('SellerProductEditor', { productId: item.id })}>
            <Card style={styles.card}>
              <View style={styles.thumbWrap}>
                {image ? (
                  <View style={[styles.thumb, { backgroundColor: colors.dark4 }]}>
                    <Text style={{ fontSize: 20 }}>🖼️</Text>
                  </View>
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}><Text style={{ fontSize: 20 }}>📦</Text></View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{item.name ?? item.title ?? 'Produit'}</Text>
                <Money amount={item.price_xof ?? item.price} currency={item.currency ?? 'FCFA'} size="sm" color={colors.gold} />
                <Text style={styles.meta}>{outOfStock ? 'Rupture de stock' : `Stock : ${item.stock ?? '—'}`} · {item.status ?? '—'}</Text>
              </View>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  loadingList: { flex: 1, backgroundColor: colors.dark, padding: spacing[4], gap: spacing[3] },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] },
  thumbWrap: {},
  thumb: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholder: { backgroundColor: colors.dark4 },
  title: { fontFamily: fonts.brandSemibold, fontSize: fontSize.base, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm, marginTop: 2 },
});
