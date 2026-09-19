import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  catalogueApi,
  Product,
  ProductVariant,
} from '../../features/catalogue/catalogueApi';

import { useCart } from '../../features/cart/cartStore';

import { resolveMediaUrl } from '../../services/api/media';

import {
  Badge,
  Button,
  Money,
  ReputationBadge,
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

export function ProductScreen({ route, navigation }: any) {
  const { add } = useCart();

  const productId = String(route?.params?.productId ?? '');

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] =
    useState<ProductVariant | null>(null);

  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const imageOpacity = useRef(new Animated.Value(1)).current;
  const addScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [productResult, variantsResult] =
          await Promise.allSettled([
            catalogueApi.get(productId),
            catalogueApi.variants(productId),
          ]);

        if (!mounted) return;

        if (productResult.status === 'fulfilled') {
          setProduct(productResult.value);
        } else {
          setLoadError(
            productResult.reason?.message ??
              'Impossible d’ouvrir ce produit pour le moment.',
          );
        }

        if (variantsResult.status === 'fulfilled') {
          const list = Array.isArray(variantsResult.value)
            ? variantsResult.value
            : [];

          setVariants(list);
          setSelectedVariant(list[0] ?? null);
        } else {
          // Une fiche produit reste consultable même si les variantes
          // ne peuvent momentanément pas être chargées.
          setVariants([]);
          setSelectedVariant(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (productId) {
      void load();
    } else {
      setLoading(false);
      setLoadError('Produit introuvable.');
    }

    return () => {
      mounted = false;
    };
  }, [productId]);

  const images = useMemo(() => {
    if (!product) return [];

    const raw = [
      ...(product.images ?? []),
      ...(product.image ? [product.image] : []),
    ];

    return [...new Set(raw.filter(Boolean))];
  }, [product]);

  useEffect(() => {
    if (activeImage >= images.length && images.length > 0) {
      setActiveImage(0);
    }
  }, [activeImage, images.length]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.loading}>
          <Skeleton height={430} radius={radius['2xl']} />

          <View style={styles.loadingLine}>
            <Skeleton
              width="62%"
              height={24}
              radius={radius.sm}
            />
            <Skeleton
              width="34%"
              height={20}
              radius={radius.sm}
            />
          </View>

          <Skeleton height={90} radius={radius.xl} />
          <Skeleton height={70} radius={radius.xl} />
          <Skeleton height={54} radius={radius.full} />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Ce produit n’est pas disponible
        </Text>

        <Text style={styles.errorText}>
          {loadError ||
            'Nous n’avons pas pu récupérer les informations du produit.'}
        </Text>

        <Button
          title="Retour au catalogue"
          onPress={() => navigation.navigate('Catalogue')}
          fullWidth
        />
      </View>
    );
  }

  const basePrice =
    product.display_price_xof ?? product.price_xof ?? 0;

  const selectedPrice = selectedVariant
    ? selectedVariant.price_xof ?? basePrice
    : basePrice;

  const stock = selectedVariant
    ? selectedVariant.stock_qty
    : product.stock;

  const outOfStock =
    typeof stock === 'number' && stock <= 0;

  function selectImage(index: number) {
    if (index === activeImage) return;

    Animated.timing(imageOpacity, {
      toValue: 0.35,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setActiveImage(index);

      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  }

  function pressAddToCart() {
    if (outOfStock) return;

    Animated.sequence([
      Animated.spring(addScale, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 30,
        bounciness: 2,
      }),
      Animated.spring(addScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 7,
      }),
    ]).start();

    add(product, 1, selectedVariant ?? undefined);
  }

  async function shareProduct() {
    try {
      await Share.share({
        message: `${product.name ?? product.title ?? 'Produit'} sur LIVI : livi://product/${product.id}`,
      });
    } catch {
      // Le partage peut être annulé sans message d’erreur.
    }
  }

  const title =
    product.name ?? product.title ?? 'Produit LIVI';

  const imageUri =
    images.length > 0
      ? resolveMediaUrl(images[activeImage])
      : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroFrame}>
            {imageUri ? (
              <Animated.Image
                source={{ uri: imageUri }}
                resizeMode="cover"
                style={[
                  styles.heroImage,
                  { opacity: imageOpacity },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.heroImage,
                  styles.heroPlaceholder,
                ]}
              >
                <Text style={styles.placeholderLogo}>
                  LIVI
                </Text>
              </View>
            )}

            <View style={styles.heroShade} />

            <View style={styles.heroHeader}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={styles.heroIconButton}
                hitSlop={8}
              >
                <Text style={styles.heroIcon}>‹</Text>
              </Pressable>

              <Pressable
                onPress={shareProduct}
                style={styles.heroIconButton}
                hitSlop={8}
              >
                <Text style={styles.heroShare}>↗</Text>
              </Pressable>
            </View>

            <View style={styles.heroBottom}>
              <View style={styles.heroBadges}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>
                    LIVI
                  </Text>
                </View>

                {outOfStock ? (
                  <View style={styles.heroStockOut}>
                    <Text style={styles.heroStockOutText}>
                      Rupture
                    </Text>
                  </View>
                ) : (
                  <View style={styles.heroStock}>
                    <View style={styles.stockDot} />
                    <Text style={styles.heroStockText}>
                      Disponible
                    </Text>
                  </View>
                )}
              </View>

              {images.length > 1 ? (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {activeImage + 1} / {images.length}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {images.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailRow}
            >
              {images.map((image, index) => {
                const uri = resolveMediaUrl(image);
                const active = index === activeImage;

                return (
                  <Pressable
                    key={`${image}-${index}`}
                    onPress={() => selectImage(index)}
                    style={[
                      styles.thumbnailButton,
                      active &&
                        styles.thumbnailButtonActive,
                    ]}
                  >
                    {uri ? (
                      <Image
                        source={{ uri }}
                        resizeMode="cover"
                        style={styles.thumbnail}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>
              Une découverte LIVI
            </Text>

            <Text style={styles.title}>
              {title}
            </Text>

            <View style={styles.priceRow}>
              <Money
                amount={Number(selectedPrice)}
                currency={product.currency ?? 'FCFA'}
                size="xl"
                color={colors.gold2}
              />

              {product.rating != null ? (
                <Badge
                  label={`★ ${product.rating}`}
                  variant="gold"
                />
              ) : null}
            </View>
          </View>

          {product.description ? (
            <View style={styles.descriptionBlock}>
              <Text style={styles.sectionTitle}>
                À propos
              </Text>

              <Text style={styles.description}>
                {product.description}
              </Text>
            </View>
          ) : null}

          {variants.length > 0 ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Choisir une option
                </Text>

                {selectedVariant ? (
                  <Text style={styles.selectedHint}>
                    Sélectionnée
                  </Text>
                ) : null}
              </View>

              <View style={styles.variantGrid}>
                {variants.map((variant) => {
                  const selected =
                    selectedVariant?.id === variant.id;

                  const label =
                    String(
                      (variant.attributes as any)?.name ??
                        (variant.attributes as any)?.label ??
                        variant.sku ??
                        'Option',
                    );

                  const unavailable =
                    variant.stock_qty <= 0;

                  return (
                    <Pressable
                      key={variant.id}
                      disabled={unavailable}
                      onPress={() =>
                        setSelectedVariant(variant)
                      }
                      style={[
                        styles.variantChip,
                        selected &&
                          styles.variantChipSelected,
                        unavailable &&
                          styles.variantChipDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.variantText,
                          selected &&
                            styles.variantTextSelected,
                          unavailable &&
                            styles.variantTextDisabled,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {selectedVariant ? (
                <View style={styles.variantMeta}>
                  <Text style={styles.variantMetaLabel}>
                    Disponibilité
                  </Text>

                  <Text
                    style={[
                      styles.variantMetaValue,
                      outOfStock &&
                        styles.variantMetaValueOut,
                    ]}
                  >
                    {outOfStock
                      ? 'Indisponible'
                      : `${selectedVariant.stock_qty} disponible${
                          selectedVariant.stock_qty > 1
                            ? 's'
                            : ''
                        }`}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : product.stock != null ? (
            <View style={styles.stockCard}>
              <View style={styles.stockIndicator}>
                <View
                  style={[
                    styles.stockLargeDot,
                    outOfStock &&
                      styles.stockLargeDotOut,
                  ]}
                />
              </View>

              <View style={styles.stockTextBlock}>
                <Text style={styles.stockTitle}>
                  {outOfStock
                    ? 'Produit momentanément indisponible'
                    : 'Produit disponible'}
                </Text>

                <Text style={styles.stockDescription}>
                  {outOfStock
                    ? 'Vous pourrez retrouver cet article dès son retour en stock.'
                    : `${product.stock} article${
                        product.stock > 1 ? 's' : ''
                      } disponible${
                        product.stock > 1 ? 's' : ''
                      }`}
                </Text>
              </View>
            </View>
          ) : null}

          {product.vendor_id ? (
            <View style={styles.trustBlock}>
              <Text style={styles.sectionTitle}>
                Confiance LIVI
              </Text>

              <View style={styles.reputationCard}>
                <View style={styles.reputationMark}>
                  <Text style={styles.reputationMarkText}>
                    ✓
                  </Text>
                </View>

                <View style={styles.reputationContent}>
                  <Text style={styles.reputationTitle}>
                    Évaluation du vendeur
                  </Text>

                  <ReputationBadge
                    userId={product.vendor_id}
                  />
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.protectionCard}>
            <View style={styles.protectionIconWrap}>
              <Text style={styles.protectionIcon}>
                ✓
              </Text>
            </View>

            <View style={styles.protectionContent}>
              <Text style={styles.protectionTitle}>
                Paiement protégé
              </Text>

              <Text style={styles.protectionText}>
                Vos fonds restent sécurisés par LIVI jusqu’à
                la confirmation de réception de votre commande.
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Animated.View
              style={{
                transform: [{ scale: addScale }],
                flex: 1,
              }}
            >
              <Button
                title={
                  outOfStock
                    ? 'Indisponible'
                    : 'Ajouter au panier'
                }
                onPress={pressAddToCart}
                disabled={outOfStock}
                size="lg"
                fullWidth
              />
            </Animated.View>

            <Button
              title="Voir le panier"
              variant="outline"
              onPress={() =>
                navigation.navigate('Cart')
              }
              size="lg"
              fullWidth
            />

            <Button
              title="Partager"
              variant="ghost"
              onPress={shareProduct}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomPrice}>
          <Text style={styles.bottomLabel}>
            Votre sélection
          </Text>

          <Money
            amount={Number(selectedPrice)}
            currency={product.currency ?? 'FCFA'}
            size="md"
            color={colors.white}
          />
        </View>

        <Pressable
          disabled={outOfStock}
          onPress={pressAddToCart}
          style={({ pressed }) => [
            styles.bottomButton,
            outOfStock &&
              styles.bottomButtonDisabled,
            pressed &&
              !outOfStock &&
              styles.bottomButtonPressed,
          ]}
        >
          <Text style={styles.bottomButtonText}>
            {outOfStock ? 'Indisponible' : 'Ajouter'}
          </Text>

          {!outOfStock ? (
            <Text style={styles.bottomButtonArrow}>
              →
            </Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingBottom: 132,
  },

  loading: {
    padding: spacing[5],
    gap: spacing[4],
  },

  loadingLine: {
    gap: spacing[2],
  },

  center: {
    flex: 1,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[4],
  },

  errorTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing[2],
  },

  heroWrap: {
    gap: spacing[3],
  },

  heroFrame: {
    height: 430,
    backgroundColor: colors.dark3,
    overflow: 'hidden',
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
    ...shadow.lg,
  },

  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark3,
  },

  placeholderLogo: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    letterSpacing: 3,
    color: colors.gold2,
  },

  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 15, 26, 0.30)',
  },

  heroHeader: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[5],
    top: spacing[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  heroIconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 15, 26, 0.68)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroIcon: {
    fontFamily: fonts.body,
    fontSize: 32,
    lineHeight: 32,
    color: colors.white,
    marginTop: -4,
  },

  heroShare: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.white,
  },

  heroBottom: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[5],
    bottom: spacing[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  heroBadges: {
    flexDirection: 'row',
    gap: spacing[2],
  },

  heroBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  heroBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.dark,
    letterSpacing: 0.8,
  },

  heroStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 15, 26, 0.78)',
    borderWidth: 1,
    borderColor: colors.greenBorder,
  },

  heroStockText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.green,
  },

  heroStockOut: {
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 15, 26, 0.78)',
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  heroStockOutText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.red,
  },

  stockDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },

  imageCounter: {
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8, 15, 26, 0.78)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },

  imageCounterText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.gray3,
  },

  thumbnailRow: {
    paddingHorizontal: spacing[5],
    gap: spacing[2],
  },

  thumbnailButton: {
    width: 64,
    height: 64,
    padding: 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    overflow: 'hidden',
  },

  thumbnailButtonActive: {
    borderColor: colors.gold,
    borderWidth: 2,
  },

  thumbnail: {
    flex: 1,
    borderRadius: radius.md,
  },

  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[5],
  },

  titleBlock: {
    gap: spacing[2],
  },

  eyebrow: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
    color: colors.gold2,
    textTransform: 'uppercase',
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 35,
    color: colors.textPrimary,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  descriptionBlock: {
    gap: spacing[2],
  },

  sectionBlock: {
    gap: spacing[3],
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  selectedHint: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.gold2,
  },

  description: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  variantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },

  variantChip: {
    minHeight: 46,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  variantChipSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.goldDim,
    ...shadow.sm,
  },

  variantChipDisabled: {
    opacity: 0.4,
  },

  variantText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  variantTextSelected: {
    fontFamily: fonts.bodySemibold,
    color: colors.gold2,
  },

  variantTextDisabled: {
    color: colors.textMuted,
  },

  variantMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[1],
  },

  variantMetaLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  variantMetaValue: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.green,
  },

  variantMetaValueOut: {
    color: colors.red,
  },

  stockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  stockIndicator: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.greenDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stockLargeDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },

  stockLargeDotOut: {
    backgroundColor: colors.red,
  },

  stockTextBlock: {
    flex: 1,
    gap: 2,
  },

  stockTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  stockDescription: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },

  trustBlock: {
    gap: spacing[3],
  },

  reputationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  reputationMark: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reputationMarkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold2,
  },

  reputationContent: {
    flex: 1,
    gap: spacing[1],
  },

  reputationTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  protectionCard: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  protectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  protectionIcon: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.dark,
  },

  protectionContent: {
    flex: 1,
    gap: 2,
  },

  protectionTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  protectionText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  actions: {
    gap: spacing[3],
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: 'rgba(8, 15, 26, 0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  bottomPrice: {
    flex: 1,
    gap: 2,
  },

  bottomLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  bottomButton: {
    minHeight: 50,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    ...shadow.gold,
  },

  bottomButtonPressed: {
    opacity: 0.86,
  },

  bottomButtonDisabled: {
    backgroundColor: colors.dark5,
    shadowOpacity: 0,
  },

  bottomButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  bottomButtonArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.dark,
  },
});
