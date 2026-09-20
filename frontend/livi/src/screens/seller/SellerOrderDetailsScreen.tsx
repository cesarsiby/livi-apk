import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';

import {
  sellerApi,
  SellerOrder,
} from '../../features/seller/sellerApi';

import {
  Button,
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

function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionCard,
        pressed && styles.actionCardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <Text style={styles.actionIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>
          {title}
        </Text>

        <Text style={styles.actionSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Text style={styles.actionArrow}>
        →
      </Text>
    </Pressable>
  );
}

function TimelineStep({
  title,
  description,
  active,
  completed,
  last,
}: {
  title: string;
  description: string;
  active: boolean;
  completed: boolean;
  last?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
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

        <Text
          style={styles.timelineDescription}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

function getTimelineIndex(
  status?: string,
) {
  switch (
    String(status ?? '').toLowerCase()
  ) {
    case 'pending_payment':
      return 0;

    case 'paid':
      return 1;

    case 'preparing':
      return 2;

    case 'shipping':
      return 3;

    case 'delivered':
    case 'completed':
    case 'received':
      return 4;

    default:
      return 1;
  }
}

function AddressBlock({
  address,
}: {
  address: any;
}) {
  if (!address) {
    return (
      <View style={styles.noAddress}>
        <Text style={styles.noAddressText}>
          Adresse de livraison non disponible.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressIcon}>
          <Text style={styles.addressIconText}>
            ⌂
          </Text>
        </View>

        <View style={styles.addressIdentity}>
          <Text style={styles.addressTitle}>
            Adresse de livraison
          </Text>

          {address.recipient_name ? (
            <Text style={styles.addressRecipient}>
              {address.recipient_name}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.addressBody}>
        {address.address_line ? (
          <Text style={styles.addressText}>
            {address.address_line}
          </Text>
        ) : null}

        {address.neighborhood ? (
          <Text style={styles.addressText}>
            {address.neighborhood}
          </Text>
        ) : null}

        {address.city ||
        address.region ||
        address.country ? (
          <Text style={styles.addressText}>
            {[
              address.city,
              address.region,
              address.country,
            ]
              .filter(Boolean)
              .join(', ')}
          </Text>
        ) : null}

        {address.phone ? (
          <Text style={styles.addressMeta}>
            {address.phone}
          </Text>
        ) : null}

        {address.landmark_description ? (
          <View style={styles.landmark}>
            <Text style={styles.landmarkLabel}>
              Repère
            </Text>

            <Text style={styles.landmarkText}>
              {address.landmark_type
                ? `${address.landmark_type} : `
                : ''}
              {address.landmark_description}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function SellerOrderDetailsScreen({
  route,
  navigation,
}: any) {
  const orderId = String(
    route?.params?.orderId ?? '',
  );

  const [order, setOrder] =
    useState<SellerOrder | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const data =
          await sellerApi.order(
            orderId,
          );

        setOrder(data);
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger cette commande.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const status = String(
    order?.status ?? '',
  ).toLowerCase();

  const timelineIndex =
    getTimelineIndex(status);

  const canAccept =
    status === 'paid' ||
    status === 'pending_payment';

  const canPrepare =
    status === 'preparing';

  const canShowPickupProof =
    status === 'shipping' ||
    status === 'delivered' ||
    status === 'completed' ||
    status === 'received';

  const isCompleted =
    status === 'delivered' ||
    status === 'completed' ||
    status === 'received';

  const itemCount = useMemo(() => {
    if (!order?.items?.length) {
      return 0;
    }

    return order.items.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity ?? 0),
      0,
    );
  }, [order]);

  const executeAction = async (
    kind: 'accept' | 'prepare',
  ) => {
    if (!order) return;

    try {
      setBusy(true);
      setError('');

      if (kind === 'accept') {
        await sellerApi.acceptOrder(
          order.id,
        );
      } else {
        await sellerApi.prepareOrder(
          order.id,
        );
      }

      await load();
    } catch (e: any) {
      setError(
        e?.message ??
          'Action refusée par le serveur.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.loadingContainer
        }
      >
        <Skeleton
          height={50}
          radius={radius.lg}
        />

        <Skeleton
          height={170}
          radius={radius['2xl']}
        />

        <Skeleton
          height={250}
          radius={radius.xl}
        />

        <Skeleton
          height={180}
          radius={radius.xl}
        />
      </ScrollView>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorState}>
        <View style={styles.errorStateIcon}>
          <Text
            style={styles.errorStateIconText}
          >
            !
          </Text>
        </View>

        <Text style={styles.errorStateTitle}>
          Commande indisponible
        </Text>

        <Text style={styles.errorStateText}>
          {error ||
            'Impossible de récupérer cette commande.'}
        </Text>

        <Button
          title="Réessayer"
          onPress={() =>
            void load()
          }
          fullWidth
        />
      </View>
    );
  }

  const timeline = [
    {
      title: 'Commande reçue',
      description:
        'La commande est enregistrée dans votre boutique.',
    },
    {
      title: 'Commande acceptée',
      description:
        'Vous avez accepté le traitement de la commande.',
    },
    {
      title: 'Préparation',
      description:
        'Les articles sont en cours de préparation.',
    },
    {
      title: 'Expédition',
      description:
        'La commande est prête et entre dans le circuit de livraison.',
    },
    {
      title: 'Commande terminée',
      description:
        'La réception a été confirmée par le client.',
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            load(true)
          }
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>
            COMMANDE VENDEUR
          </Text>

          <Text
            numberOfLines={1}
            style={styles.title}
          >
            {order.reference ??
              `#${String(
                order.id,
              ).slice(0, 8)}`}
          </Text>
        </View>

        <StatusBadge
          domain="order"
          status={order.status}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.totalCard}>
        <Text style={styles.totalEyebrow}>
          TOTAL DE LA COMMANDE
        </Text>

        <Money
          amount={
            order.total_amount ??
            order.total
          }
          currency={
            order.currency ??
            'FCFA'
          }
          size="xl"
          color={colors.gold}
        />

        <View style={styles.totalMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>
              Articles
            </Text>

            <Text style={styles.metaValue}>
              {itemCount}
            </Text>
          </View>

          <View style={styles.metaDivider} />

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>
              Transporteur
            </Text>

            <Text style={styles.metaValue}>
              {order.transporter_id
                ? 'Assigné'
                : 'À assigner'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Avancement
          </Text>

          <Text style={styles.sectionSubtitle}>
            L’état est piloté par le backend Livi.
          </Text>
        </View>

        <View style={styles.timelineCard}>
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
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Articles
          </Text>

          <Text style={styles.sectionSubtitle}>
            Contenu de la commande à préparer.
          </Text>
        </View>

        {order.items?.length ? (
          <View style={styles.itemsCard}>
            {order.items.map(
              (item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    index <
                      order.items!.length -
                        1 &&
                      styles.itemRowBorder,
                  ]}
                >
                  <View
                    style={styles.itemIndex}
                  >
                    <Text
                      style={
                        styles.itemIndexText
                      }
                    >
                      {item.quantity}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.itemIdentity
                    }
                  >
                    <Text
                      numberOfLines={2}
                      style={
                        styles.itemName
                      }
                    >
                      {item.product_name}
                    </Text>

                    <Text
                      style={
                        styles.itemUnit
                      }
                    >
                      {item.unit_price !=
                      null
                        ? 'Prix unitaire'
                        : 'Article'}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.itemAmount
                    }
                  >
                    <Money
                      amount={
                        item.total_price
                      }
                      currency={
                        order.currency ??
                        'FCFA'
                      }
                      size="sm"
                      color={
                        colors.textPrimary
                      }
                    />

                    <Text
                      style={
                        styles.itemQuantity
                      }
                    >
                      × {item.quantity}
                    </Text>
                  </View>
                </View>
              ),
            )}
          </View>
        ) : (
          <View style={styles.emptyItems}>
            <Text
              style={styles.emptyItemsText}
            >
              Aucun article détaillé disponible.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Livraison
          </Text>

          <Text style={styles.sectionSubtitle}>
            Informations transmises pour l’acheminement.
          </Text>
        </View>

        <AddressBlock
          address={
            order.shipping_address
          }
        />

        <View style={styles.deliveryStatusCard}>
          <View
            style={styles.deliveryStatusIcon}
          >
            <Text
              style={
                styles.deliveryStatusIconText
              }
            >
              →
            </Text>
          </View>

          <View
            style={
              styles.deliveryStatusContent
            }
          >
            <Text
              style={
                styles.deliveryStatusTitle
              }
            >
              {order.transporter_id
                ? 'Transporteur assigné'
                : 'Transporteur non encore assigné'}
            </Text>

            <Text
              style={
                styles.deliveryStatusText
              }
            >
              {order.transporter_id
                ? 'La livraison est reliée à un transporteur.'
                : 'La commande doit encore être récupérée par un transporteur.'}
            </Text>
          </View>
        </View>
      </View>

      {(canAccept ||
        canPrepare ||
        canShowPickupProof) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Actions
            </Text>

            <Text style={styles.sectionSubtitle}>
              Seules les actions compatibles avec l’état actuel sont proposées.
            </Text>
          </View>

          <View style={styles.actions}>
            {canAccept ? (
              <ActionCard
                title="Accepter la commande"
                subtitle="Commencer son traitement."
                icon="✓"
                onPress={() => {
                  if (busy) return;

                  Alert.alert(
                    'Accepter la commande ?',
                    'La commande passera dans le traitement vendeur.',
                    [
                      {
                        text: 'Annuler',
                        style: 'cancel',
                      },
                      {
                        text: 'Accepter',
                        onPress: () =>
                          void executeAction(
                            'accept',
                          ),
                      },
                    ],
                  );
                }}
              />
            ) : null}

            {canPrepare ? (
              <ActionCard
                title="Marquer comme préparée"
                subtitle="Passer la commande à l’expédition."
                icon="□"
                onPress={() => {
                  if (busy) return;

                  Alert.alert(
                    'Commande prête ?',
                    'Cette action ouvre le circuit de livraison.',
                    [
                      {
                        text: 'Annuler',
                        style: 'cancel',
                      },
                      {
                        text: 'Confirmer',
                        onPress: () =>
                          void executeAction(
                            'prepare',
                          ),
                      },
                    ],
                  );
                }}
              />
            ) : null}

            {canShowPickupProof ? (
              <ActionCard
                title="Code de remise"
                subtitle="Afficher le QR et le PIN au transporteur."
                icon="⌁"
                onPress={() =>
                  navigation.navigate(
                    'SellerPickupProof',
                    {
                      orderId:
                        order.id,
                    },
                  )
                }
              />
            ) : null}
          </View>

          {busy ? (
            <View style={styles.processing}>
              <Text style={styles.processingText}>
                Mise à jour de la commande…
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {isCompleted &&
      order.transporter_id ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Évaluer la livraison
            </Text>

            <Text style={styles.sectionSubtitle}>
              Votre retour sur le transporteur.
            </Text>
          </View>

          <RatingPrompt
            orderId={order.id}
            ratedId={
              order.transporter_id
            }
            ratedLabel="le transporteur"
          />
        </View>
      ) : null}

      <Pressable
        style={styles.refreshButton}
        onPress={() =>
          void load(true)
        }
      >
        <Text style={styles.refreshText}>
          Actualiser la commande
        </Text>
      </Pressable>

      <Text style={styles.footer}>
        Les changements d’état sont autorisés et validés
        par le backend Livi.
      </Text>
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
    backgroundColor: colors.dark,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  headerCopy: {
    flex: 1,
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.5,
    color: colors.gold,
  },

  title: {
    marginTop: 2,
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
  },

  errorBox: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  totalCard: {
    marginTop: spacing[5],
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  totalEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.textMuted,
    marginBottom: spacing[2],
  },

  totalMeta: {
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },

  metaItem: {
    flex: 1,
  },

  metaLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  metaValue: {
    marginTop: 3,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  metaDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing[4],
  },

  section: {
    marginTop: spacing[6],
  },

  sectionHeader: {
    marginBottom: spacing[3],
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

  timelineCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  timelineRow: {
    minHeight: 75,
    flexDirection: 'row',
  },

  timelineRail: {
    width: 28,
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
    fontSize: 9,
    color: colors.gold,
  },

  timelineLine: {
    width: 1,
    flex: 1,
    marginVertical: 4,
    backgroundColor: colors.border,
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
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  itemsCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  itemRow: {
    minHeight: 82,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  itemIndex: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemIndexText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  itemIdentity: {
    flex: 1,
  },

  itemName: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  itemUnit: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  itemAmount: {
    alignItems: 'flex-end',
  },

  itemQuantity: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  emptyItems: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyItemsText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  addressCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  addressIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  addressIdentity: {
    flex: 1,
  },

  addressTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  addressRecipient: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  addressBody: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  addressText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },

  addressMeta: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  landmark: {
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
  },

  landmarkLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.gold,
  },

  landmarkText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  noAddress: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  noAddressText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  deliveryStatusCard: {
    marginTop: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  deliveryStatusIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deliveryStatusIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  deliveryStatusContent: {
    flex: 1,
  },

  deliveryStatusTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  deliveryStatusText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  actions: {
    gap: spacing[3],
  },

  actionCard: {
    minHeight: 76,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  actionCardPressed: {
    opacity: 0.9,
  },

  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  actionContent: {
    flex: 1,
  },

  actionTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  actionSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  actionArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  processing: {
    marginTop: spacing[3],
    alignItems: 'center',
  },

  processingText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  refreshButton: {
    marginTop: spacing[6],
    minHeight: 46,
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

  footer: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[3],
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: colors.textMuted,
  },

  errorState: {
    flex: 1,
    padding: spacing[6],
    backgroundColor: colors.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorStateIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },

  errorStateIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xl,
    color: colors.red,
  },

  errorStateTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  errorStateText: {
    marginTop: spacing[2],
    marginBottom: spacing[5],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
