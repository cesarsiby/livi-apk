import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ordersApi,
  Order,
} from '../../features/orders/ordersApi';

import {
  Button,
  CountdownTimer,
  Money,
  RatingPrompt,
  Skeleton,
  StatusBadge,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

const ACTIVE_DELIVERY_STATUSES = new Set([
  'paid',
  'preparing',
  'shipping',
]);

const DELIVERED_STATUSES = new Set([
  'delivered',
  'completed',
  'received',
]);

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>
          {title}
        </Text>

        {subtitle ? (
          <Text style={styles.sectionSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {children}
    </View>
  );
}

function TimelineStep({
  title,
  description,
  active,
  completed,
  last = false,
}: {
  title: string;
  description: string;
  active: boolean;
  completed: boolean;
  last?: boolean;
}) {
  return (
    <View style={styles.timelineStep}>
      <View style={styles.timelineRail}>
        <View
          style={[
            styles.timelineDot,
            (active || completed) &&
              styles.timelineDotActive,
          ]}
        >
          {completed ? (
            <Text style={styles.timelineCheck}>
              ✓
            </Text>
          ) : null}
        </View>

        {!last ? (
          <View
            style={[
              styles.timelineLine,
              completed &&
                styles.timelineLineActive,
            ]}
          />
        ) : null}
      </View>

      <View style={styles.timelineContent}>
        <Text
          style={[
            styles.timelineTitle,
            active &&
              styles.timelineTitleActive,
          ]}
        >
          {title}
        </Text>

        <Text style={styles.timelineDescription}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function trackingText(order: Order) {
  const tracking = order.tracking;

  if (!tracking) {
    return 'Aucune information de suivi disponible pour le moment.';
  }

  if (typeof tracking === 'string') {
    return tracking;
  }

  return (
    tracking.status ??
    tracking.current_status ??
    'Suivi disponible'
  );
}

function getTimelineStatus(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === 'pending_payment') {
    return 0;
  }

  if (normalized === 'payment_pending') {
    return 1;
  }

  if (normalized === 'paid') {
    return 2;
  }

  if (normalized === 'preparing') {
    return 3;
  }

  if (normalized === 'shipping') {
    return 4;
  }

  if (
    normalized === 'delivered' ||
    normalized === 'completed' ||
    normalized === 'received'
  ) {
    return 5;
  }

  return 2;
}

export function OrderDetailsScreen({
  route,
  navigation,
}: any) {
  const orderId = String(
    route?.params?.orderId ?? '',
  );

  const [order, setOrder] =
    useState<Order | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [pin, setPin] = useState('');

  const [reviewProductId, setReviewProductId] =
    useState('');

  const [reviewRating, setReviewRating] =
    useState('5');

  const [reviewComment, setReviewComment] =
    useState('');

  const entrance = useRef(
    new Animated.Value(0),
  ).current;

  const load = useCallback(async () => {
    try {
      const data = await ordersApi.get(orderId);
      setOrder(data);
    } catch (e: any) {
      Alert.alert(
        'Commande',
        e?.message ??
          'Impossible de charger la commande.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();

    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [load, entrance]);

  useEffect(() => {
    const items = (order as any)?.items;

    if (
      Array.isArray(items) &&
      items.length === 1 &&
      !reviewProductId
    ) {
      setReviewProductId(
        String(
          items[0].product_id ??
            items[0].id ??
            '',
        ),
      );
    }
  }, [order, reviewProductId]);

  async function confirmReceipt() {
    if (!pin.trim()) {
      Alert.alert(
        'Validation',
        'Entrez le PIN remis pour la réception.',
      );
      return;
    }

    try {
      setRefreshing(true);

      await ordersApi.confirmReceipt(orderId, {
        pin: pin.trim(),
      });

      await load();

      setPin('');

      Alert.alert(
        'Livraison confirmée',
        'La réception a été enregistrée par LIVI.',
      );
    } catch (e: any) {
      Alert.alert(
        'Validation refusée',
        e?.message ??
          "Le PIN n'a pas été accepté.",
      );

      setRefreshing(false);
    }
  }

  async function submitReview() {
    if (!reviewProductId) return;

    const rating = Number(reviewRating);

    if (
      !Number.isFinite(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      Alert.alert(
        'Avis',
        'La note doit être comprise entre 1 et 5.',
      );
      return;
    }

    try {
      setRefreshing(true);

      await ordersApi.review(orderId, {
        product_id: reviewProductId,
        rating,
        comment:
          reviewComment.trim() || undefined,
      });

      setReviewComment('');

      Alert.alert(
        'Avis',
        'Votre avis a été enregistré.',
      );
    } catch (e: any) {
      Alert.alert(
        'Avis',
        e?.message ??
          "Impossible d'enregistrer l'avis.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  const status = String(
    order?.status ?? '',
  ).toLowerCase();

  const timelineIndex =
    getTimelineStatus(status);

  const delivered =
    DELIVERED_STATUSES.has(status);

  const canTrack =
    ACTIVE_DELIVERY_STATUSES.has(status) ||
    status === 'delivered';

  const disputeContent = useMemo(() => {
    if (!order) return null;

    if (
      status !== 'delivered' ||
      !order.delivered_at
    ) {
      return (
        <Pressable
          onPress={() =>
            navigation.navigate(
              'CreateDispute',
              { orderId },
            )
          }
          style={styles.disputeButton}
        >
          <Text style={styles.disputeButtonTitle}>
            Signaler un problème
          </Text>

          <Text style={styles.disputeButtonText}>
            Une difficulté avec cette commande ?
          </Text>
        </Pressable>
      );
    }

    const expiresAt = new Date(
      new Date(order.delivered_at).getTime() +
        10 * 60 * 1000,
    ).toISOString();

    const expired =
      new Date(expiresAt).getTime() <=
      Date.now();

    if (expired) {
      return (
        <View
          style={[
            styles.disputeButton,
            styles.disputeDisabled,
          ]}
        >
          <Text
            style={styles.disputeDisabledTitle}
          >
            Délai de signalement expiré
          </Text>

          <Text
            style={styles.disputeDisabledText}
          >
            Le délai prévu après la livraison est
            terminé.
          </Text>
        </View>
      );
    }

    return (
      <Pressable
        onPress={() =>
          navigation.navigate(
            'CreateDispute',
            { orderId },
          )
        }
        style={styles.disputeButton}
      >
        <Text style={styles.disputeButtonTitle}>
          Signaler un problème
        </Text>

        <CountdownTimer
          expiresAt={expiresAt}
          style={styles.countdown}
        />
      </Pressable>
    );
  }, [
    order,
    orderId,
    navigation,
    status,
  ]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingContainer}>
          <Skeleton
            height={34}
            width="65%"
            radius={radius.md}
          />
          <Skeleton
            height={165}
            radius={radius['2xl']}
          />
          <Skeleton
            height={180}
            radius={radius.xl}
          />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.helpText}>
          Commande introuvable.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>
            Retour
          </Text>
        </Pressable>
      </View>
    );
  }

  const timeline = [
    {
      title: 'Commande créée',
      description:
        'Votre commande a bien été enregistrée.',
    },
    {
      title: 'Paiement',
      description:
        'La confirmation du paiement est traitée par Livi.',
    },
    {
      title: 'Préparation',
      description:
        'Le vendeur prépare votre commande.',
    },
    {
      title: 'Expédition',
      description:
        'La commande est remise pour livraison.',
    },
    {
      title: 'Livraison',
      description:
        'La commande est en cours d’acheminement.',
    },
    {
      title: 'Réception',
      description:
        'La réception est confirmée.',
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={{
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
        }}
      >
        <View style={styles.header}>
          <View style={styles.referenceBlock}>
            <Text style={styles.eyebrow}>
              COMMANDE
            </Text>

            <Text style={styles.title}>
              {order.reference ??
                `#${String(order.id).slice(
                  0,
                  8,
                )}`}
            </Text>
          </View>

          <StatusBadge
            domain="order"
            status={order.status}
          />
        </View>

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>
            TOTAL
          </Text>

          <Money
            amount={
              order.total_amount ??
              order.total
            }
            currency={
              order.currency ?? 'FCFA'
            }
            size="xl"
            color={colors.gold}
          />

          <View style={styles.protectedRow}>
            <View style={styles.protectedIcon}>
              <Text
                style={styles.protectedIconText}
              >
                ✓
              </Text>
            </View>

            <Text style={styles.protectedText}>
              Paiement protégé par Livi.
            </Text>
          </View>
        </View>

        <Section
          title="État de la commande"
          subtitle="Une vue simple de l’avancement."
        >
          <View style={styles.timeline}>
            {timeline.map(
              (step, index) => (
                <TimelineStep
                  key={step.title}
                  title={step.title}
                  description={
                    step.description
                  }
                  active={
                    index ===
                    timelineIndex
                  }
                  completed={
                    index <
                    timelineIndex
                  }
                  last={
                    index ===
                    timeline.length - 1
                  }
                />
              ),
            )}
          </View>
        </Section>

        {canTrack ? (
          <Pressable
            style={styles.primaryLink}
            onPress={() =>
              navigation.navigate(
                'DeliveryTracking',
                { orderId },
              )
            }
          >
            <View>
              <Text style={styles.primaryLinkTitle}>
                Ouvrir le suivi détaillé
              </Text>

              <Text
                style={styles.primaryLinkSubtitle}
              >
                {trackingText(order)}
              </Text>
            </View>

            <Text style={styles.primaryLinkArrow}>
              →
            </Text>
          </Pressable>
        ) : null}

        {!delivered ? (
          <Section
            title="Confirmer la réception"
            subtitle="Utilisez le PIN remis lors de la livraison."
          >
            <TextInput
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={8}
              placeholder="PIN de réception"
              placeholderTextColor={
                colors.textMuted
              }
              style={styles.pinInput}
            />

            <Button
              title={
                refreshing
                  ? 'Validation…'
                  : 'Confirmer la réception'
              }
              disabled={
                refreshing ||
                !pin.trim()
              }
              loading={refreshing}
              onPress={confirmReceipt}
              fullWidth
            />
          </Section>
        ) : null}

        {disputeContent}

        {delivered ? (
          <Section
            title="Évaluer votre expérience"
            subtitle="Votre retour peut être laissé une fois la commande terminée."
          >
            {!!order.vendor_id ? (
              <RatingPrompt
                orderId={orderId}
                ratedId={order.vendor_id}
                ratedLabel="le vendeur"
              />
            ) : null}

            {!!order.transporter_id ? (
              <RatingPrompt
                orderId={orderId}
                ratedId={order.transporter_id}
                ratedLabel="le transporteur"
              />
            ) : null}
          </Section>
        ) : null}

        {delivered &&
        Array.isArray(
          (order as any).items,
        ) &&
        (order as any).items.length > 0 ? (
          <Section
            title="Laisser un avis"
            subtitle="Partagez votre retour sur l’article."
          >
            {(order as any).items.length >
            1 ? (
              <View
                style={styles.reviewProducts}
              >
                {(order as any).items.map(
                  (
                    item: any,
                    index: number,
                  ) => {
                    const productId =
                      String(
                        item.product_id ??
                          item.id ??
                          index,
                      );

                    const selected =
                      reviewProductId ===
                      productId;

                    return (
                      <Pressable
                        key={productId}
                        onPress={() =>
                          setReviewProductId(
                            productId,
                          )
                        }
                        style={[
                          styles.reviewChip,
                          selected &&
                            styles.reviewChipActive,
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.reviewChipText,
                            selected &&
                              styles.reviewChipTextActive,
                          ]}
                        >
                          {item.product_name ??
                            item.name ??
                            `Article ${
                              index + 1
                            }`}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            ) : (
              <Text style={styles.reviewProductName}>
                {(order as any).items[0]
                  ?.product_name ??
                  (order as any).items[0]
                    ?.name ??
                  'Cet article'}
              </Text>
            )}

            <TextInput
              value={reviewRating}
              onChangeText={setReviewRating}
              keyboardType="number-pad"
              maxLength={1}
              placeholder="Note de 1 à 5"
              placeholderTextColor={
                colors.textMuted
              }
              style={styles.textInput}
            />

            <TextInput
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Votre commentaire (optionnel)"
              placeholderTextColor={
                colors.textMuted
              }
              multiline
              style={[
                styles.textInput,
                styles.commentInput,
              ]}
            />

            <Button
              title="Publier l’avis"
              disabled={
                refreshing ||
                !reviewProductId
              }
              onPress={submitReview}
              fullWidth
            />
          </Section>
        ) : null}

        <Pressable
          onPress={async () => {
            setRefreshing(true);
            await load();
          }}
          style={styles.refreshButton}
        >
          <Text style={styles.refreshText}>
            Actualiser l’état
          </Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  loadingContainer: {
    padding: spacing[5],
    gap: spacing[4],
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[5],
    backgroundColor: colors.dark,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  referenceBlock: {
    flex: 1,
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.gold,
    marginBottom: 2,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
  },

  amountCard: {
    marginTop: spacing[5],
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  amountLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textMuted,
    marginBottom: spacing[2],
  },

  protectedRow: {
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  protectedIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  protectedIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  protectedText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  section: {
    marginTop: spacing[5],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionHeading: {
    marginBottom: spacing[4],
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  timeline: {
    gap: 0,
  },

  timelineStep: {
    flexDirection: 'row',
    minHeight: 72,
  },

  timelineRail: {
    width: 30,
    alignItems: 'center',
  },

  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timelineDotActive: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  timelineCheck: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.gold,
  },

  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  timelineLineActive: {
    backgroundColor: colors.goldBorder,
  },

  timelineContent: {
    flex: 1,
    paddingLeft: spacing[3],
    paddingBottom: spacing[4],
  },

  timelineTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  timelineTitleActive: {
    color: colors.textPrimary,
  },

  timelineDescription: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },

  primaryLink: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  primaryLinkTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  primaryLinkSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.dark,
    opacity: 0.65,
  },

  primaryLinkArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xl,
    color: colors.dark,
  },

  pinInput: {
    minHeight: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xl,
    letterSpacing: 5,
    marginBottom: spacing[3],
  },

  disputeButton: {
    marginTop: spacing[4],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.orangeDim,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
  },

  disputeButtonTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.orange,
  },

  disputeButtonText: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  countdown: {
    marginTop: spacing[2],
  },

  disputeDisabled: {
    backgroundColor: colors.dark3,
    borderColor: colors.border,
  },

  disputeDisabledTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  disputeDisabledText: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  reviewProducts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },

  reviewChip: {
    maxWidth: '100%',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
  },

  reviewChipActive: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  reviewChipText: {
    maxWidth: 180,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  reviewChipTextActive: {
    fontFamily: fonts.bodySemibold,
    color: colors.gold,
  },

  reviewProductName: {
    marginBottom: spacing[3],
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  textInput: {
    minHeight: 50,
    marginBottom: spacing[3],
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },

  commentInput: {
    minHeight: 110,
    paddingTop: spacing[3],
    textAlignVertical: 'top',
  },

  refreshButton: {
    minHeight: 46,
    marginTop: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  refreshText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  helpText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },

  backButton: {
    marginTop: spacing[4],
    minHeight: 44,
    paddingHorizontal: spacing[5],
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    justifyContent: 'center',
  },

  backButtonText: {
    fontFamily: fonts.bodyBold,
    color: colors.dark,
  },
});
    
