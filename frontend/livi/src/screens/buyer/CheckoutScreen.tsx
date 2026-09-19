import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '../../features/cart/cartStore';

import {
  Address,
  checkoutApi,
  OrderQuote,
  PaymentMethod,
} from '../../features/checkout/checkoutApi';

import { normalizeList } from '../../services/api/normalize';

import {
  Button,
  Money,
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

function OptionCard({
  selected,
  title,
  subtitle,
  onPress,
  disabled = false,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        selected && styles.optionCardSelected,
        disabled && styles.optionCardDisabled,
        pressed && !disabled && styles.optionCardPressed,
      ]}
    >
      <View
        style={[
          styles.optionRadio,
          selected && styles.optionRadioSelected,
        ]}
      >
        {selected ? (
          <View style={styles.optionRadioInner} />
        ) : null}
      </View>

      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>
          {title}
        </Text>

        {subtitle ? (
          <Text style={styles.optionSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {selected ? (
        <Text style={styles.optionCheck}>✓</Text>
      ) : null}
    </Pressable>
  );
}

export function CheckoutScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const {
    lines,
    subtotal,
    clear,
  } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);

  const [addressId, setAddressId] = useState('');
  const [paymentId, setPaymentId] = useState('');

  const [quote, setQuote] =
    useState<OrderQuote | null>(null);

  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [loadError, setLoadError] = useState('');

  const entrance = useRef(
    new Animated.Value(0),
  ).current;

  useEffect(() => {
    if (!lines.length) {
      navigation.replace('Cart');
      return;
    }

    let mounted = true;

    async function load() {
      setLoading(true);
      setLoadError('');

      const [addressResult, paymentResult] =
        await Promise.allSettled([
          checkoutApi.addresses(),
          checkoutApi.paymentMethods(),
        ]);

      if (!mounted) return;

      if (addressResult.status === 'fulfilled') {
        const list = normalizeList<Address>(
          addressResult.value,
          ['addresses', 'data'],
        );

        setAddresses(list);

        if (list[0]) {
          setAddressId(String(list[0].id));
        }
      }

      if (paymentResult.status === 'fulfilled') {
        const list = normalizeList<PaymentMethod>(
          paymentResult.value,
          [
            'payment_methods',
            'methods',
            'data',
          ],
        );

        setPayments(list);

        if (list[0]) {
          setPaymentId(String(list[0].id));
        }
      }

      const addressFailed =
        addressResult.status === 'rejected';

      const paymentFailed =
        paymentResult.status === 'rejected';

      if (addressFailed || paymentFailed) {
        setLoadError(
          "Certaines informations n'ont pas pu être chargées. Vous pouvez actualiser l'écran ou compléter ce qui manque.",
        );
      }

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [lines.length, navigation]);

  useEffect(() => {
    if (
      !addressId ||
      !lines.length
    ) {
      setQuote(null);
      return;
    }

    let mounted = true;

    setQuoting(true);

    checkoutApi
      .quote(lines, addressId)
      .then((result) => {
        if (mounted) {
          setQuote(result);
        }
      })
      .catch(() => {
        if (mounted) {
          setQuote(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setQuoting(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [addressId, lines]);

  useEffect(() => {
    if (loading) return;

    Animated.spring(entrance, {
      toValue: 1,
      useNativeDriver: true,
      speed: 11,
      bounciness: 2,
    }).start();

    return () => {
      entrance.stopAnimation();
    };
  }, [entrance, loading]);

  async function pay() {
    if (!addressId || !paymentId) {
      return;
    }

    try {
      setPaying(true);

      const order =
        await checkoutApi.createOrder(
          lines,
          addressId,
          paymentId,
        );

      const orderId =
        (order as any)?.id ??
        (order as any)?.order?.id;

      if (!orderId) {
        throw new Error(
          "La commande n'a pas retourné d'identifiant.",
        );
      }

      const amount = Number(
        (order as any)?.total_amount ??
          quote?.total_xof ??
          subtotal,
      );

      const payment =
        await checkoutApi.initPayment(
          String(orderId),
          amount,
          paymentId,
        );

      const reference =
        (payment as any)?.reference ??
        (payment as any)?.payment_reference ??
        (payment as any)?.id;

      if (!reference) {
        throw new Error(
          "Le paiement n'a pas retourné de référence.",
        );
      }

      clear();

      navigation.replace(
        'OrderDetails',
        {
          orderId,
        },
      );
    } catch (error: any) {
      // L'écran parent peut gérer les erreurs globales.
      // On conserve ici un message visible dans le flux.
      setLoadError(
        error?.message ??
          "Le paiement n'a pas pu être initialisé. Vos informations n'ont pas été perdues.",
      );
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton
          height={34}
          width="55%"
          radius={radius.sm}
        />

        <Skeleton
          height={160}
          radius={radius.xl}
        />

        <Skeleton
          height={150}
          radius={radius.xl}
        />

        <Skeleton
          height={130}
          radius={radius.xl}
        />

        <Skeleton
          height={54}
          radius={radius.full}
        />
      </View>
    );
  }

  const total = quote?.total_xof ?? subtotal;

  const hasAddress = addresses.length > 0;
  const hasPayment = payments.length > 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              insets.bottom + 150,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.inner,
            {
              opacity: entrance,
              transform: [
                {
                  translateY:
                    entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.kicker}>
              LIVI
            </Text>

            <Text style={styles.title}>
              Finaliser la commande
            </Text>

            <Text style={styles.subtitle}>
              Encore quelques détails et votre commande sera prête.
            </Text>
          </View>

          {loadError ? (
            <View style={styles.feedback}>
              <View style={styles.feedbackMark}>
                <Text style={styles.feedbackMarkText}>
                  !
                </Text>
              </View>

              <View style={styles.feedbackText}>
                <Text style={styles.feedbackTitle}>
                  Un petit contretemps
                </Text>

                <Text style={styles.feedbackBody}>
                  {loadError}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Résumé
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Le montant final est calculé par LIVI.
                </Text>
              </View>

              {quoting ? (
                <ActivityIndicator
                  size="small"
                  color={colors.gold}
                />
              ) : null}
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Produits
              </Text>

              <Money
                amount={
                  quote?.subtotal_xof ??
                  subtotal
                }
                currency="FCFA"
                size="sm"
                color={colors.textPrimary}
              />
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Livraison
              </Text>

              {quote ? (
                <Money
                  amount={quote.shipping_fee_xof}
                  currency="FCFA"
                  size="sm"
                  color={colors.textPrimary}
                />
              ) : (
                <Text style={styles.pendingValue}>
                  Calcul…
                </Text>
              )}
            </View>

            <View style={styles.totalDivider} />

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>
                  Total
                </Text>

                <Text style={styles.totalHint}>
                  {quote?.distance_km != null
                    ? `${quote.distance_km.toFixed(1)} km de livraison`
                    : 'Montant final de la commande'}
                </Text>
              </View>

              <Money
                amount={total}
                currency="FCFA"
                size="lg"
                color={colors.gold2}
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>
                  1
                </Text>
              </View>

              <View>
                <Text style={styles.sectionTitle}>
                  Livraison
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Où souhaitez-vous recevoir votre commande ?
                </Text>
              </View>
            </View>

            {hasAddress ? (
              <View style={styles.options}>
                {addresses.map((address) => {
                  const selected =
                    addressId ===
                    String(address.id);

                  const title =
                    address.label ??
                    address.name ??
                    'Adresse de livraison';

                  const subtitle =
                    address.address ??
                    address.line1 ??
                    address.city ??
                    '';

                  return (
                    <OptionCard
                      key={address.id}
                      selected={selected}
                      title={title}
                      subtitle={subtitle}
                      onPress={() =>
                        setAddressId(
                          String(address.id),
                        )
                      }
                    />
                  );
                })}
              </View>
            ) : (
              <Pressable
                onPress={() =>
                  navigation.navigate(
                    'Addresses',
                  )
                }
                style={styles.addCard}
              >
                <View style={styles.addIcon}>
                  <Text style={styles.addIconText}>
                    +
                  </Text>
                </View>

                <View style={styles.addContent}>
                  <Text style={styles.addTitle}>
                    Ajouter une adresse
                  </Text>

                  <Text style={styles.addSubtitle}>
                    Indiquez où nous devons livrer votre commande.
                  </Text>
                </View>

                <Text style={styles.addArrow}>
                  →
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>
                  2
                </Text>
              </View>

              <View>
                <Text style={styles.sectionTitle}>
                  Paiement
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Choisissez le moyen de paiement enregistré.
                </Text>
              </View>
            </View>

            {hasPayment ? (
              <View style={styles.options}>
                {payments.map((payment) => {
                  const selected =
                    paymentId ===
                    String(payment.id);

                  const title =
                    payment.label ??
                    payment.type ??
                    'Moyen de paiement';

                  const subtitle =
                    payment.last4
                      ? `•••• ${payment.last4}`
                      : 'Moyen de paiement enregistré';

                  return (
                    <OptionCard
                      key={payment.id}
                      selected={selected}
                      title={title}
                      subtitle={subtitle}
                      onPress={() =>
                        setPaymentId(
                          String(payment.id),
                        )
                      }
                    />
                  );
                })}
              </View>
            ) : (
              <Pressable
                onPress={() =>
                  navigation.navigate(
                    'PaymentMethods',
                  )
                }
                style={styles.addCard}
              >
                <View style={styles.addIcon}>
                  <Text style={styles.addIconText}>
                    +
                  </Text>
                </View>

                <View style={styles.addContent}>
                  <Text style={styles.addTitle}>
                    Ajouter un moyen de paiement
                  </Text>

                  <Text style={styles.addSubtitle}>
                    Enregistrez votre moyen de paiement pour poursuivre.
                  </Text>
                </View>

                <Text style={styles.addArrow}>
                  →
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.trustCard}>
            <View style={styles.trustIcon}>
              <Text style={styles.trustIconText}>
                ✓
              </Text>
            </View>

            <View style={styles.trustContent}>
              <Text style={styles.trustTitle}>
                Vos fonds restent protégés
              </Text>

              <Text style={styles.trustText}>
                LIVI sécurise la transaction jusqu’à la confirmation de réception.
                Le vendeur n’est payé qu’une fois la commande correctement livrée.
              </Text>
            </View>
          </View>

          <View style={styles.finalNote}>
            <Text style={styles.finalNoteTitle}>
              Vous gardez le contrôle
            </Text>

            <Text style={styles.finalNoteText}>
              Vérifiez l’adresse, le paiement et le montant avant de confirmer.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom:
              Math.max(insets.bottom, spacing[4]) +
              spacing[1],
          },
        ]}
      >
        <View style={styles.bottomSummary}>
          <Text style={styles.bottomLabel}>
            Total à payer
          </Text>

          <Money
            amount={total}
            currency="FCFA"
            size="md"
            color={colors.white}
          />
        </View>

        <Button
          title={
            paying
              ? 'Sécurisation en cours…'
              : 'Payer et sécuriser'
          }
          disabled={
            paying ||
            !addressId ||
            !paymentId
          }
          loading={paying}
          onPress={pay}
          size="lg"
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

  content: {
    paddingHorizontal: spacing[5],
  },

  inner: {
    gap: spacing[5],
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: spacing[5],
    gap: spacing[4],
  },

  header: {
    paddingTop: spacing[5],
    gap: spacing[2],
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
    lineHeight: 35,
    color: colors.textPrimary,
  },

  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
    maxWidth: 340,
  },

  feedback: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  feedbackMark: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },

  feedbackMarkText: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
    fontSize: fontSize.sm,
  },

  feedbackText: {
    flex: 1,
    gap: 2,
  },

  feedbackTitle: {
    fontFamily: fonts.bodySemibold,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
  },

  feedbackBody: {
    fontFamily: fonts.body,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },

  summaryCard: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
    gap: spacing[3],
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: 2,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  summaryLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  pendingValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  totalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing[1],
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  totalLabel: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },

  totalHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  section: {
    gap: spacing[3],
  },

  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepNumber: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold2,
  },

  options: {
    gap: spacing[2],
  },

  optionCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  optionCardSelected: {
    backgroundColor: colors.goldDim,
    borderColor: colors.gold,
  },

  optionCardDisabled: {
    opacity: 0.45,
  },

  optionCardPressed: {
    opacity: 0.86,
  },

  optionRadio: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionRadioSelected: {
    borderColor: colors.gold,
  },

  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  optionContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  optionTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  optionSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },

  optionCheck: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold2,
  },

  addCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  addIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addIconText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xl,
    color: colors.gold2,
  },

  addContent: {
    flex: 1,
    gap: 2,
  },

  addTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  addSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },

  addArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.gold2,
  },

  trustCard: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  trustIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  trustIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.dark,
  },

  trustContent: {
    flex: 1,
    gap: 2,
  },

  trustTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  trustText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  finalNote: {
    paddingBottom: spacing[2],
    gap: 2,
  },

  finalNoteTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  finalNoteText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: 'rgba(8, 15, 26, 0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    ...shadow.lg,
  },

  bottomSummary: {
    flex: 1,
    gap: 2,
  },

  bottomLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
