import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { buyerApi } from '../../features/buyer/buyerApi';
import { normalizeList } from '../../services/api/normalize';
import { Card, EmptyState, Skeleton } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, constat C0) : `r?.items ?? r?.wishlist
// ?? r?.data ?? []` ne fonctionnait jamais — GET /users/me/wishlist renvoie
// un tableau brut une fois déballé par apiRequest() (routes/compatibility.js,
// `ok(res, rows)`). Cet écran affichait "Votre wishlist est vide" en
// permanence, quels que soient les favoris réels. Remplacé par normalizeList().
export function WishlistScreen({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    buyerApi.wishlist()
      .then((r) => setItems(normalizeList<any>(r, ['items', 'wishlist', 'data'])))
      .catch((e) => setError(e?.message ?? 'Impossible de charger la wishlist.'))
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function remove(id: string) {
    try { await buyerApi.removeWishlist(id); load(); }
    catch (e: any) { setError(e?.message ?? 'Erreur.'); }
  }

  if (loading) {
    return (
      <View style={s.list}>
        <Skeleton height={90} radius={14} />
        <Skeleton height={90} radius={14} />
      </View>
    );
  }

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.list}
      data={items}
      keyExtractor={(x, i) => String(x.product_id ?? x.id ?? i)}
      ListEmptyComponent={
        <EmptyState
          icon="❤️"
          title="Aucun favori pour l'instant"
          description="Touchez le cœur sur un produit du catalogue pour le retrouver ici."
          actionLabel="Parcourir le catalogue"
          onAction={() => navigation.navigate('Catalogue')}
        />
      }
      ListHeaderComponent={error ? <Text style={s.error}>{error}</Text> : null}
      renderItem={({ item }) => (
        <Card style={s.card}>
          <Text style={s.vendor}>{item.vendor_name ?? '—'}</Text>
          <Text style={s.title}>{item.name ?? item.title ?? 'Produit'}</Text>
          <Text style={s.price}>{item.price != null ? `${Number(item.price).toLocaleString('fr-FR')} ${item.currency ?? 'FCFA'}` : '—'}</Text>
          {item.in_stock === false ? <Text style={s.danger}>Rupture de stock</Text> : null}
          <View style={s.row}>
            <Pressable onPress={() => navigation.navigate('Product', { productId: item.product_id ?? item.id })}>
              <Text style={s.link}>Voir</Text>
            </Pressable>
            <Pressable onPress={() => remove(String(item.product_id ?? item.id))}>
              <Text style={s.danger}>Retirer</Text>
            </Pressable>
          </View>
        </Card>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  card: { padding: spacing[4], gap: 7 },
  vendor: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.sm },
  title: { fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, color: colors.textPrimary },
  price: { fontFamily: fonts.bodySemibold, color: colors.gold },
  row: { flexDirection: 'row', gap: spacing[5], marginTop: spacing[2] },
  link: { fontFamily: fonts.bodyBold, color: colors.gold },
  danger: { color: colors.red, fontFamily: fonts.bodySemibold },
  error: { color: colors.red, fontFamily: fonts.body, marginBottom: spacing[2] },
});
