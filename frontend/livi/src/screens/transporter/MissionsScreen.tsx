import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  transporterApi,
  Mission,
} from '../../features/transporter/transporterApi';

import { normalizeList } from '../../services/api/normalize';

import {
  Button,
  CountdownTimer,
  EmptyState,
  Money,
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

type Filter =
  | 'available'
  | 'active'
  | 'all';

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active && styles.filterChipActive,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          active && styles.filterTextActive,
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.filterCount,
          active && styles.filterCountActive,
        ]}
      >
        <Text
          style={[
            styles.filterCountText,
            active &&
              styles.filterCountTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function MissionCard({
  mission,
  onOpen,
  onAccept,
  onReject,
  busy,
  isOffer,
}: {
  mission: Mission;
  onOpen: () => void;
  onAccept: () => void;
  onReject: () => void;
  busy: boolean;
  isOffer: boolean;
}) {
  const reference =
    (mission as any).tracking_code ??
    mission.reference ??
    `#${String(
      mission.id,
    ).slice(0, 8)}`;

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        isOffer && styles.offerCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.referenceWrap}>
          <Text style={styles.cardEyebrow}>
            {isOffer
              ? 'NOUVELLE PROPOSITION'
              : 'MISSION'}
          </Text>

          <Text
            numberOfLines={1}
            style={styles.reference}
          >
            {reference}
          </Text>
        </View>

        <StatusBadge
          domain="delivery"
          status={mission.status}
        />
      </View>

      {isOffer &&
      mission.offer_expires_at ? (
        <View style={styles.offerTimer}>
          <View>
            <Text style={styles.timerLabel}>
              Offre réservée pour vous
            </Text>

            <Text style={styles.timerText}>
              Répondez avant son expiration.
            </Text>
          </View>

          <CountdownTimer
            expiresAt={
              mission.offer_expires_at
            }
          />
        </View>
      ) : null}

      <View style={styles.route}>
        <View style={styles.routeRail}>
          <View
            style={[
              styles.routeDot,
              styles.routeDotPickup,
            ]}
          />

          <View style={styles.routeLine} />

          <View
            style={[
              styles.routeDot,
              styles.routeDotDropoff,
            ]}
          />
        </View>

        <View style={styles.routeContent}>
          <View style={styles.routeBlock}>
            <Text style={styles.routeLabel}>
              COLLECTE
            </Text>

            <Text
              numberOfLines={1}
              style={styles.routeTitle}
            >
              {mission.pickup_shop_name ??
                mission.pickup_city ??
                'Boutique'}
            </Text>

            <Text
              numberOfLines={2}
              style={styles.routeText}
            >
              {[
                mission.pickup_address,
                mission.pickup_city,
              ]
                .filter(Boolean)
                .join(', ') ||
                'Adresse non renseignée'}
            </Text>
          </View>

          <View style={styles.routeBlock}>
            <Text style={styles.routeLabel}>
              LIVRAISON
            </Text>

            <Text
              numberOfLines={1}
              style={styles.routeTitle}
            >
              {mission.delivery_recipient_name ??
                mission.delivery_city ??
                'Destinataire'}
            </Text>

            <Text
              numberOfLines={2}
              style={styles.routeText}
            >
              {[
                mission.delivery_address_line,
                mission.delivery_neighborhood,
                mission.delivery_city,
              ]
                .filter(Boolean)
                .join(', ') ||
                'Adresse non renseignée'}
            </Text>
          </View>
        </View>
      </View>

      {mission.delivery_landmark_description ? (
        <View style={styles.landmark}>
          <Text style={styles.landmarkLabel}>
            REPÈRE
          </Text>

          <Text
            numberOfLines={2}
            style={styles.landmarkText}
          >
            {mission.delivery_landmark_type
              ? `${mission.delivery_landmark_type} · `
              : ''}
            {mission.delivery_landmark_description}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.feeLabel}>
            FRAIS DE LIVRAISON
          </Text>

          {mission.shipping_fee != null ? (
            <Money
              amount={mission.shipping_fee}
              currency="FCFA"
              size="sm"
              color={colors.gold}
            />
          ) : (
            <Text style={styles.feeUnavailable}>
              Non renseignés
            </Text>
          )}
        </View>

        {!isOffer ? (
          <Text style={styles.openText}>
            Ouvrir →
          </Text>
        ) : null}
      </View>

      {isOffer ? (
        <View style={styles.offerActions}>
          <Button
            title="Refuser"
            variant="red"
            size="sm"
            disabled={busy}
            onPress={onReject}
            style={styles.offerButton}
          />

          <Button
            title="Accepter"
            variant="green"
            size="sm"
            disabled={busy}
            loading={busy}
            onPress={onAccept}
            style={styles.offerButton}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function LoadingMissionList() {
  return (
    <View style={styles.loadingList}>
      <Skeleton
        height={240}
        radius={radius['2xl']}
      />

      <Skeleton
        height={220}
        radius={radius['2xl']}
      />

      <Skeleton
        height={220}
        radius={radius['2xl']}
      />
    </View>
  );
}

export function MissionsScreen({
  navigation,
}: any) {
  const [items, setItems] =
    useState<Mission[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busyId, setBusyId] =
    useState<string | null>(null);

  const [filter, setFilter] =
    useState<Filter>('available');

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
        const response =
          await transporterApi.missions({
            limit: 50,
          });

        setItems(
          normalizeList<Mission>(
            response,
            ['missions', 'data'],
          ),
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger les missions.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const offers = items.filter(
    (mission) =>
      !mission.transporter_id &&
      Boolean(mission.offered_to),
  );

  const active = items.filter(
    (mission) =>
      Boolean(mission.transporter_id) &&
      ![
        'delivered',
        'completed',
      ].includes(
        String(
          mission.status ?? '',
        ).toLowerCase(),
      ),
  );

  const visibleItems = useMemo(() => {
    if (filter === 'available') {
      return offers;
    }

    if (filter === 'active') {
      return active;
    }

    return items;
  }, [active, filter, items, offers]);

  async function respond(
    mission: Mission,
    action: 'accept' | 'reject',
  ) {
    try {
      setBusyId(mission.id);

      if (action === 'accept') {
        await transporterApi.acceptMission(
          mission.id,
        );
      } else {
        await transporterApi.rejectMission(
          mission.id,
        );
      }

      await load(true);
    } catch (e: any) {
      setError(
        e?.message ??
          "Cette proposition n'est plus disponible.",
      );

      await load(true);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.screen}>
      {loading ? (
        <LoadingMissionList />
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) =>
            String(item.id)
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.list,
            visibleItems.length === 0 &&
              styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                load(true)
              }
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <Text style={styles.eyebrow}>
                    LIVRAISON
                  </Text>

                  <Text style={styles.title}>
                    Missions
                  </Text>

                  <Text style={styles.subtitle}>
                    Les propositions disponibles en
                    priorité autour de votre zone.
                  </Text>
                </View>

                <View style={styles.totalBadge}>
                  <Text
                    style={styles.totalNumber}
                  >
                    {items.length}
                  </Text>

                  <Text
                    style={styles.totalLabel}
                  >
                    missions
                  </Text>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text
                    style={styles.errorText}
                  >
                    {error}
                  </Text>

                  <Pressable
                    onPress={() =>
                      void load()
                    }
                  >
                    <Text
                      style={
                        styles.retryText
                      }
                    >
                      Réessayer
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.filters}>
                <FilterChip
                  label="Propositions"
                  count={offers.length}
                  active={
                    filter === 'available'
                  }
                  onPress={() =>
                    setFilter('available')
                  }
                />

                <FilterChip
                  label="En cours"
                  count={active.length}
                  active={
                    filter === 'active'
                  }
                  onPress={() =>
                    setFilter('active')
                  }
                />

                <FilterChip
                  label="Toutes"
                  count={items.length}
                  active={
                    filter === 'all'
                  }
                  onPress={() =>
                    setFilter('all')
                  }
                />
              </View>

              {filter === 'available' &&
              offers.length > 0 ? (
                <View style={styles.offerIntro}>
                  <View style={styles.offerIntroDot} />

                  <Text style={styles.offerIntroText}>
                    Ces missions sont proposées
                    directement à votre compte. Le
                    minuteur indique la fenêtre de réponse.
                  </Text>
                </View>
              ) : null}

              <Pressable
                style={styles.qrButton}
                onPress={() =>
                  navigation.navigate(
                    'QRValidation',
                  )
                }
              >
                <View style={styles.qrIcon}>
                  <Text style={styles.qrIconText}>
                    QR
                  </Text>
                </View>

                <View style={styles.qrContent}>
                  <Text style={styles.qrTitle}>
                    Vérifier un QR / PIN
                  </Text>

                  <Text style={styles.qrSubtitle}>
                    Outil de validation des preuves de remise.
                  </Text>
                </View>

                <Text style={styles.qrArrow}>
                  ›
                </Text>
              </Pressable>

              {visibleItems.length > 0 ? (
                <View style={styles.listIntro}>
                  <Text style={styles.listTitle}>
                    {filter === 'available'
                      ? 'Propositions reçues'
                      : filter === 'active'
                        ? 'Livraisons en cours'
                        : 'Toutes les missions'}
                  </Text>

                  <Text style={styles.listSubtitle}>
                    {visibleItems.length}{' '}
                    élément
                    {visibleItems.length > 1
                      ? 's'
                      : ''}
                  </Text>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <EmptyState
                icon="→"
                title={
                  filter === 'available'
                    ? 'Aucune proposition'
                    : filter === 'active'
                      ? 'Aucune livraison en cours'
                      : 'Aucune mission'
                }
                description={
                  filter === 'available'
                    ? 'Une nouvelle proposition vous sera présentée lorsqu’une mission vous sera attribuée.'
                    : filter === 'active'
                      ? 'Une mission active apparaîtra ici après votre acceptation.'
                      : 'Les missions de votre compte apparaîtront ici.'
                }
              />
            </View>
          }
          renderItem={({ item }) => {
            const isOffer =
              !item.transporter_id &&
              Boolean(item.offered_to);

            return (
              <MissionCard
                mission={item}
                isOffer={isOffer}
                busy={
                  busyId === item.id
                }
                onOpen={() =>
                  navigation.navigate(
                    'MissionDetails',
                    {
                      missionId:
                        item.id,
                    },
                  )
                }
                onAccept={() =>
                  void respond(
                    item,
                    'accept',
                  )
                }
                onReject={() =>
                  void respond(
                    item,
                    'reject',
                  )
                }
              />
            );
          }}
          ItemSeparatorComponent={() => (
            <View
              style={{ height: spacing[3] }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  loadingList: {
    padding: spacing[5],
    gap: spacing[3],
    backgroundColor: colors.dark,
  },

  list: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  emptyList: {
    flexGrow: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  headerCopy: {
    flex: 1,
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
  },

  title: {
    marginTop: 2,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
  },

  totalBadge: {
    width: 58,
    height: 58,
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalNumber: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  totalLabel: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.textMuted,
  },

  errorBox: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  errorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  filters: {
    marginTop: spacing[5],
    flexDirection: 'row',
    gap: spacing[2],
  },

  filterChip: {
    minHeight: 38,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  filterChipActive: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  filterText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.textSecondary,
  },

  filterTextActive: {
    color: colors.gold,
  },

  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterCountActive: {
    backgroundColor: colors.gold,
  },

  filterCountText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.textMuted,
  },

  filterCountTextActive: {
    color: colors.dark,
  },

  offerIntro: {
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.goldDim,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },

  offerIntroDot: {
    width: 7,
    height: 7,
    marginTop: 5,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  offerIntroText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  qrButton: {
    marginTop: spacing[4],
    minHeight: 70,
    padding: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  qrIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  qrIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.gold,
  },

  qrContent: {
    flex: 1,
  },

  qrTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  qrSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  qrArrow: {
    fontFamily: fonts.body,
    fontSize: fontSize['2xl'],
    color: colors.textMuted,
  },

  listIntro: {
    marginTop: spacing[5],
    marginBottom: spacing[3],
  },

  listTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  listSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  card: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  offerCard: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.dark3,
  },

  cardPressed: {
    opacity: 0.92,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[3],
  },

  referenceWrap: {
    flex: 1,
  },

  cardEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.3,
    color: colors.gold,
  },

  reference: {
    marginTop: 3,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  offerTimer: {
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  timerLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.textPrimary,
  },

  timerText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },

  route: {
    marginTop: spacing[5],
    flexDirection: 'row',
    gap: spacing[3],
  },

  routeRail: {
    width: 18,
    alignItems: 'center',
    paddingTop: 4,
  },

  routeDot: {
    width: 11,
    height: 11,
    borderRadius: radius.full,
    borderWidth: 2,
  },

  routeDotPickup: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },

  routeDotDropoff: {
    backgroundColor: colors.dark3,
    borderColor: colors.gold,
  },

  routeLine: {
    flex: 1,
    width: 1,
    marginVertical: 5,
    backgroundColor: colors.border,
  },

  routeContent: {
    flex: 1,
    gap: spacing[4],
  },

  routeBlock: {
    minHeight: 54,
  },

  routeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },

  routeTitle: {
    marginTop: 3,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  routeText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  landmark: {
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
  },

  landmarkLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.1,
    color: colors.gold,
  },

  landmarkText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  cardFooter: {
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  feeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: 3,
  },

  feeUnavailable: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  openText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  offerActions: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    gap: spacing[3],
  },

  offerButton: {
    flex: 1,
  },

  emptyWrapper: {
    minHeight: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
