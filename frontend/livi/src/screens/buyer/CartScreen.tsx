import React, { useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '../../features/cart/cartStore';
import { resolveMediaUrl } from '../../services/api/media';

import {
  Button,
  EmptyState,
  Money,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  shadow,
  spacing,
} from '../../design/theme';

function ScalePressable({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    if (disabled) return;

    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 28,
      bounciness: 2,
    }).start();
  }

  function pressOut() {
    if (disabled) return;

    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 6,
    }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        disabled={disabled}
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

export function CartScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const {
    lines,
    subtotal,
    setQuantity,
    remove,
  } = useCart();

  if (!lines.length) {
    return (
      <View
        style={[
          styles.emptyScreen,
          {
            paddingBottom: Math.max(insets.bottom, spacing[5]),
          },
        ]}
      >
        <View style={styles.emptyHeader}>
          <Text style={styles.kicker}>LIVI</Text>
          <Text style={styles.title}>Votre panier</Text>
        </View>

        <EmptyState
          icon="□"
          title="Votre panier attend sa première trouvaille"
          description="Explorez les produits disponibles sur LIVI et ajoutez vos favoris ici lorsque vous êtes prêt."
          actionLabel="Découvrir le catalogue"
          onAction={() => navigation.navigate('Catalogue')}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(
              insets.top,
              spacing[3],
            ),
          },
        ]}
      >
        <View>
          <Text style={styles.kicker}>LIVI</Text>
          <Text style={styles.title}>Votre panier</Text>
          <Text style={styles.subtitle}>
            {lines.length} article{lines.length > 1 ? 's' : ''} sélectionné
            {lines.length > 1 ? 's' : ''}
          </Text>
        </View>

        <ScalePressable
          onPress={() => navigation.navigate('Catalogue')}
          style={styles.continueButton}
        >
          <Text style={styles.continueText}>
            Continuer
          </Text>
          <Text style={styles.continueArrow}>→</Text>
        </ScalePressable>
      </View>

      <Animated.FlatList
        data={lines}
        keyExtractor={(item) =>
          `${item.product.id}::${item.variant?.id ?? ''}`
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const unitPrice = item.variant
            ? (
                item.variant.display_price_xof ??
                item.variant.price_xof ??
                0
              )
            : (
                item.product.display_price_xof ??
                item.product.price_xof ??
                0
              );

          const lineTotal = Number(unitPrice) * item.quantity;

          const image = resolveMediaUrl(
            item.product.image ??
              item.product.images?.[0],
          );

          const variantLabel = item.variant
            ? String(
                (item.variant.attributes as any)?.name ??
                  (item.variant.attributes as any)?.label ??
                  item.variant.sku ??
                  'Option sélectionnée',
              )
            : null;

          return (
            <View style={styles.itemCard}>
              <Pressable
                onPress={() =>
                  navigation.navigate('Product', {
                    productId: item.product.id,
                  })
                }
                style={styles.imageWrap}
              >
                {image ? (
                  <Image
                    source={{ uri: image }}
                    resizeMode="cover"
                    style={styles.image}
                  />
                ) : (
                  <View
                    style={[
                      styles.image,
                      styles.imagePlaceholder,
                    ]}
                  >
                    <Text
                      style={styles.placeholderText}
                    >
                      LIVI
                    </Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.itemContent}>
                <View style={styles.itemTop}>
                  <View style={styles.itemText}>
                    <Text
                      style={styles.itemName}
                      numberOfLines={2}
                    >
                      {item.product.name ??
                        item.product.title ??
                        'Produit'}
                    </Text>

                    {variantLabel ? (
                      <View style={styles.variantPill}>
                        <Text style={styles.variantPillText}>
                          {variantLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      remove(
                        item.product.id,
                        item.variant?.id,
                      )
                    }
                  >
                    <Text style={styles.removeText}>
                      Retirer
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.itemBottom}>
                  <View style={styles.priceStack}>
                    <Money
                      amount={Number(unitPrice)}
                      currency={
                        item.product.currency ??
                        'FCFA'
                      }
                      size="sm"
                      color={colors.textSecondary}
                    />

                    <Text style={styles.quantityHint}>
                      par article
                    </Text>
                  </View>

                  <View style={styles.quantityControl}>
                    <ScalePressable
                      disabled={item.quantity <= 1}
                      onPress={() =>
                        setQuantity(
                          item.product.id,
                          item.quantity - 1,
                          item.variant?.id,
                        )
                      }
                      style={[
                        styles.quantityButton,
                        item.quantity <= 1 &&
                          styles.quantityButtonDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.quantityButtonText,
                          item.quantity <= 1 &&
                            styles.quantityButtonTextDisabled,
                        ]}
                      >
                        −
                      </Text>
                    </ScalePressable>

                    <Text style={styles.quantityValue}>
                      {item.quantity}
                    </Text>

                    <ScalePressable
                      onPress={() =>
                        setQuantity(
                          item.product.id,
                          item.quantity + 1,
                          item.variant?.id,
                        )
                      }
                      style={styles.quantityButton}
                    >
                      <Text
                        style={styles.quantityButtonText}
                      >
                        +
                      </Text>
                    </ScalePressable>
                  </View>

                  <Money
                    amount={Number(lineTotal)}
                    currency={
                      item.product.currency ??
                      'FCFA'
                    }
                    size="md"
                    color={colors.gold2}
                  />
                </View>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
      />

      <View
        style={[
          styles.footer,
          {
            paddingBottom:
              Math.max(insets.bottom, spacing[4]) +
              spacing[2],
          },
        ]}
      >
        <View style={styles.footerTop}>
          <View>
            <Text style={styles.footerLabel}>
              Sous-total
            </Text>
            <Text style={styles.footerCaption}>
              Livraison calculée à l’étape suivante
            </Text>
          </View>

          <Money
            amount={subtotal}
            currency="FCFA"
            size="lg"
            color={colors.white}
          />
        </View>

        <View style={styles.secureLine}>
          <View style={styles.secureDot}>
            <Text style={styles.secureDotText}>
              ✓
            </Text>
          </View>

          <Text style={styles.secureText}>
            Paiement protégé par LIVI
          </Text>
        </View>

        <Button
          title="Passer à la commande"
          onPress={() =>
            navigation.navigate('Checkout')
          }
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  emptyScreen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: spacing[5],
  },

  emptyHeader: {
    paddingTop: spacing[5],
    gap: spacing[1],
  },

  kicker: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 2,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 34,
    color: colors.textPrimary,
  },

  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing[3],
  },

  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  continueText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold2,
  },

  continueArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold2,
  },

  list: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },

  separator: {
    height: spacing[3],
  },

  itemCard: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  imageWrap: {
    width: 92,
    height: 108,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.dark4,
  },

  image: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderText: {
    fontFamily: fonts.brandBold,
    fontSize: fontSize.sm,
    letterSpacing: 1,
    color: colors.gold2,
  },

  itemContent: {
    flex: 1,
    justifyContent: 'space-between',
    minWidth: 0,
  },

  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },

  itemText: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },

  itemName: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  variantPill: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
  },

  variantPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  removeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
  },

  priceStack: {
    flex: 1,
    gap: 1,
  },

  quantityHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
  },

  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.dark5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quantityButtonDisabled: {
    opacity: 0.4,
  },

  quantityButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    lineHeight: 18,
    color: colors.gold2,
  },

  quantityButtonTextDisabled: {
    color: colors.textMuted,
  },

  quantityValue: {
    minWidth: 18,
    textAlign: 'center',
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    backgroundColor: 'rgba(8, 15, 26, 0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    ...shadow.lg,
    gap: spacing[3],
  },

  footerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  footerLabel: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },

  footerCaption: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  secureLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  secureDot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secureDotText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.green,
  },

  secureText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
