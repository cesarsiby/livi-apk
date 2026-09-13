import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { catalogueApi, Product, ProductVariant } from '../../features/catalogue/catalogueApi';
import { useCart } from '../../features/cart/cartStore';
import { resolveMediaUrl } from '../../services/api/media';
import { Badge, Button, ReputationBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function ProductScreen({ route, navigation }: any) {
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    catalogueApi.get(String(route.params.productId)).then(setProduct);
    // V54 (RAPPORT — "VARIANTES PRODUITS"): a vendor could create variants
    // with zero way for a buyer to ever see or pick one — the cart always
    // added the base product regardless.
    catalogueApi.variants(String(route.params.productId)).then((v) => { setVariants(v); if (v[0]) setSelectedVariant(v[0]); }).catch(() => setVariants([]));
  }, [route.params.productId]);

  if (!product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const displayPrice = selectedVariant
    ? (selectedVariant.display_price_xof ?? selectedVariant.price_xof)
    : (product.display_price_xof ?? product.price_xof);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* V54 (RAPPORT — "valable pour les produits ?"): this screen showed
          zero photos at all, even though publishing a product requires at
          least 3 (see PRODUCT_MEDIA_MINIMUM in routes/compatibility.js) —
          the buyer's product detail page just never rendered any Image. */}
      {product.images && product.images.length > 0 ? (
        <View style={{ gap: spacing[2] }}>
          <Image source={{ uri: resolveMediaUrl(product.images[activeImage]) }} style={styles.mainImage} />
          {product.images.length > 1 && (
            <View style={styles.thumbRow}>
              {product.images.map((img, i) => (
                <Pressable key={img} onPress={() => setActiveImage(i)}>
                  <Image source={{ uri: resolveMediaUrl(img) }} style={[styles.thumb, i === activeImage && styles.thumbActive]} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.noImage}><Text style={styles.noImageText}>Aucune photo</Text></View>
      )}

      <Text style={styles.title}>{product.name ?? product.title ?? 'Produit'}</Text>
      <Text style={styles.price}>{Number(displayPrice ?? 0).toLocaleString('fr-FR')} {product.currency ?? 'FCFA'}</Text>
      {!!product.description && <Text style={styles.description}>{product.description}</Text>}

      <View style={styles.badgeRow}>
        {product.rating != null && <Badge label={`⭐ ${product.rating}`} variant="gold" />}
        {product.stock != null && !variants.length && <Badge label={`Stock : ${product.stock}`} variant={product.stock > 0 ? 'green' : 'red'} />}
      </View>
      {/* V54: vendor reputation (Acheteur<->Vendeur ratings, distinct from
          the product-level star badge above) — the endpoint existed with
          nothing rendering it anywhere in the buyer app. */}
      {!!product.vendor_id && <ReputationBadge userId={product.vendor_id} />}

      {variants.length > 0 && (
        <View style={{ gap: spacing[2] }}>
          <Text style={styles.sectionLabel}>Choisir une option</Text>
          <View style={styles.variantRow}>
            {variants.map((v) => (
              <Pressable key={v.id} onPress={() => setSelectedVariant(v)} style={[styles.variantChip, selectedVariant?.id === v.id && styles.variantChipSelected]}>
                <Text style={[styles.variantChipText, selectedVariant?.id === v.id && styles.variantChipTextSelected]}>
                  {String((v.attributes as any)?.name ?? v.sku ?? 'Option')}
                </Text>
              </Pressable>
            ))}
          </View>
          {!!selectedVariant && (
            <Badge label={selectedVariant.stock_qty > 0 ? `Stock : ${selectedVariant.stock_qty}` : 'Rupture de stock'} variant={selectedVariant.stock_qty > 0 ? 'green' : 'red'} />
          )}
        </View>
      )}

      <Button
        title="Ajouter au panier"
        onPress={() => add(product, 1, selectedVariant ?? undefined)}
        disabled={variants.length > 0 && !!selectedVariant && selectedVariant.stock_qty <= 0}
        size="lg"
        fullWidth
      />
      {/* LIVI 2.0 (RAPPORT_UXUI_SESSION21, §15) : la fiche produit doit
          répondre à "comment la transaction est-elle protégée ?" — absent
          jusqu'ici. Pas de nom de boutique/vendeur affiché volontairement :
          GET /products/:id ne renvoie que vendor_id (uuid), aucune route
          publique ne permet de résoudre un nom de vendeur à partir de cet
          id — l'inventer aurait été afficher une fausse identité
          commerciale (voir feuille de route, "gap backend à combler"). */}
      <View style={styles.protection}>
        <Text style={styles.protectionIcon}>🔒</Text>
        <Text style={styles.protectionText}>Paiement protégé — reversé au vendeur seulement après votre confirmation de réception.</Text>
      </View>
      <Button title="Voir le panier" onPress={() => navigation.navigate('Cart')} variant="outline" fullWidth />
      {/* V54: "le vendeur doit pouvoir créer un lien unique partageable pour
          chaque produit" — uses the livi:// deep link now wired in App.tsx. */}
      <Button
        title="Partager ce produit"
        variant="ghost"
        onPress={() => Share.share({ message: `${product.name ?? product.title ?? 'Produit'} sur LIVI : livi://product/${product.id}` })}
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[4] },
  title: { fontFamily: fonts.brand, fontSize: fontSize['2xl'], color: colors.textPrimary },
  price: { fontFamily: fonts.brandSemibold, fontSize: fontSize.xl, color: colors.gold },
  description: { fontFamily: fonts.body, color: colors.gray2, lineHeight: 21 },
  mainImage: { width: '100%', height: 260, borderRadius: radius.md, backgroundColor: colors.dark3 },
  thumbRow: { flexDirection: 'row', gap: spacing[2] },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, opacity: 0.5 },
  thumbActive: { opacity: 1, borderWidth: 2, borderColor: colors.gold },
  noImage: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.dark3, alignItems: 'center', justifyContent: 'center' },
  noImageText: { color: colors.textMuted, fontFamily: fonts.body },
  badgeRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  sectionLabel: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  variantChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.dark3 },
  variantChipSelected: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  variantChipText: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  variantChipTextSelected: { color: colors.gold, fontFamily: fonts.bodySemibold },
  protection: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3] },
  protectionIcon: { fontSize: fontSize.base },
  protectionText: { flex: 1, fontFamily: fonts.body, color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 },
});
