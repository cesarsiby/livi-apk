import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme';
import { formatMoney } from './Money';
import { resolveMediaUrl } from '../../services/api/media';
import type { Product } from '../../features/catalogue/catalogueApi';

type Props = {
  product: Product;
  onPress?: () => void;
  isFavorite?: boolean;
  /** Omettre si l'écran appelant ne suit pas les favoris (pas de coeur affiché) */
  onToggleFavorite?: () => void;
  style?: ViewStyle;
};

/**
 * Carte produit unique de l'app — pensée pour une grille 2 colonnes
 * (width: '48%', à utiliser avec justifyContent: 'space-between' sur le
 * conteneur). N'affiche que des champs réellement renvoyés par
 * GET /products : name/title, display_price_xof (prix payé par
 * l'acheteur — jamais price_xof qui est le prix vendeur), image, stock.
 */
export function ProductCard({ product, onPress, isFavorite, onToggleFavorite, style }: Props) {
  const name = product.name ?? product.title ?? 'Produit';
  const price = product.display_price_xof ?? product.price_xof;
  const image = resolveMediaUrl(product.image ?? product.images?.[0]);
  const outOfStock = typeof product.stock === 'number' && product.stock <= 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>📦</Text>
          </View>
        )}
        {outOfStock ? (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockText}>Épuisé</Text>
          </View>
        ) : null}
        {onToggleFavorite ? (
          <Pressable onPress={onToggleFavorite} hitSlop={8} style={styles.favoriteButton}>
            <Text style={styles.favoriteIcon}>{isFavorite ? '♥' : '♡'}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <Text style={styles.price}>{price != null ? formatMoney(price, product.currency ?? 'FCFA') : 'Prix sur demande'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', backgroundColor: colors.dark3, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  imageWrap: { aspectRatio: 1, backgroundColor: colors.dark4 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontSize: 28 },
  outOfStockBadge: { position: 'absolute', top: spacing[2], left: spacing[2], backgroundColor: 'rgba(8,15,26,0.85)', borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 8 },
  outOfStockText: { fontFamily: fonts.bodySemibold, fontSize: fontSize.xs, color: colors.gray2 },
  favoriteButton: { position: 'absolute', top: spacing[2], right: spacing[2], width: 28, height: 28, borderRadius: radius.full, backgroundColor: 'rgba(8,15,26,0.65)', alignItems: 'center', justifyContent: 'center' },
  favoriteIcon: { fontSize: fontSize.md, color: colors.gold },
  info: { padding: spacing[3], gap: 4 },
  name: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 17, minHeight: 34 },
  price: { fontFamily: fonts.bodyBold, fontSize: fontSize.base, color: colors.gold },
});
