import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ordersApi, Order } from '../../features/orders/ordersApi';

import {
  Button,
  Card,
  Screen,
  Skeleton,
  StatusBadge,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  shadow,
  spacing,
} from '../../design/theme';

const REFRESH_INTERVAL_MS = 15_000;

type TrackingEvent = {
  id?: string | number;
  type?: string;
  status?: string;
  message?: string;
  description?: string;
  timestamp?: string;
  created_at?: string;
  [key: string]: unknown;
};

function normalizeTracking(order: Order | null) {
  const raw = order?.tracking as any;

  if (!raw) {
    return {
      label: '',
      currentLocation: '',
      message: '',
      events: [] as TrackingEvent[],
    };
  }

  if (typeof raw === 'string') {
    return {
      label: raw,
      currentLocation: '',
      message: raw,
      events: [] as TrackingEvent[],
    };
  }

  return {
    label: String(raw.status ?? raw.current_status ?? ''),
    currentLocation: String(raw.current_location ?? raw.location ?? ''),
    message: String(raw.message ?? raw.description ?? ''),
    events: Array.isArray(raw.events) ? (raw.events as TrackingEvent[]) : [],
  };
}

function formatDate(value?: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function humanizeEventType(raw?: string) {
  if (!raw) return '';
  return raw.replace(/_/g, ' ').replace(/^./, (match) => match.toUpperCase());
}

function EventRow({ event, first }: { event: TrackingEvent; first: boolean }) {
  const statusKey = String(event.status ?? event.type ?? '').toLowerCase();
  const title = event.message || event.description || humanizeEventType(statusKey) || 'Événement de suivi';
  const timestamp = formatDate(String(event.timestamp ?? event.created_at ?? ''));

  return (
    <View style={styles.eventRow}>
      <View style={styles.eventRail}>
        <View style={[styles.eventDot, first && styles.eventDotActive]} />
        <View style={styles.eventLine} />
      </View>

      <View style={styles.eventBody}>
        <View style={styles.eventTopRow}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {title}
          </Text>
          {event.status && statusKey !== 'shipping' ? (
            <StatusBadge domain="delivery" status={statusKey} />
          ) : null}
        </View>

        {timestamp ? <Text style={styles.eventTime}>{timestamp}</Text> : null}
      </View>
    </View>
  );
}

function TrackingSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Skeleton width="26%" height={11} radius={radius.sm} />
      <Skeleton width="62%" height={30} radius={radius.md} />

      <Card style={styles.heroCard}>
        <Skeleton width="32%" height={14} radius={radius.sm} />
        <Skeleton width="72%" height={24} radius={radius.sm} />
        <Skeleton width="100%" height={9} radius={radius.full} />
        <Skeleton width="82%" height={14} radius={radius.sm} />
      </Card>

      <Card style={styles.card}>
        <Skeleton width="42%" height={17} radius={radius.sm} />
        <Skeleton width="78%" height={14} radius={radius.sm} />
        <Skeleton width="64%" height={14} radius={radius.sm} />
      </Card>

      <Card style={styles.card}>
        <Skeleton width="38%" height={17} radius={radius.sm} />
        <Skeleton width="100%" height={48} radius={radius.md} />
        <Skeleton width="92%" height={48} radius={radius.md} />
      </Card>
    </ScrollView>
  );
}

export function DeliveryTrackingScreen({ route, navigation }: any) {
  const orderId = String(route?.params?.orderId ?? '');

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(
    async (isRefresh = false) => {
      if (!orderId) {
        setError('Commande introuvable.');
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError('');

      try {
        const next = await ordersApi.get(orderId);
        setOrder(next);
      } catch (e: any) {
        setError(e?.message ?? 'Impossible de charger le suivi de la livraison.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId],
  );

  useFocusEffect(
    useCallback(() => {
      load();

      const timer = setInterval(() => {
        load(true);
      }, REFRESH_INTERVAL_MS);

      return () => clearInterval(timer);
    }, [load]),
  );

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const tracking = useMemo(() => normalizeTracking(order), [order]);

  const deliveryStatus = String(
    order?.delivery_status ?? tracking.label ?? order?.status ?? '',
  ).toLowerCase();

  const isDelivered = deliveryStatus === 'delivered';
  const hasEvents = tracking.events.length > 0;

  const progressWidth = (() => {
    switch (deliveryStatus) {
      case 'pending': return '12%';
      case 'assigned': return '30%';
      case 'picked_up': return '50%';
      case 'in_transit': return '68%';
      case 'arrived': return '88%';
      case 'delivered': return '100%';
      default: return '50%';
    }
  })();
  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  if (loading && !order) {
    return (
      <Screen>
        <TrackingSkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
      >
        <Animated.View
          style={{
            opacity: entrance,
            transform: [{ translateY }],
          }}
        >
          <View style={styles.topBar}>
            <View style={styles.headingBlock}>
              <Text style={styles.kicker}>LIVRAISON</Text>
              <Text style={styles.title} numberOfLines={2}>
                {order?.reference ?? `Commande #${orderId}`}
              </Text>
            </View>

            <Pressable
              onPress={() => navigation?.goBack?.()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.backButtonText}>Retour</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <View style={styles.errorCopy}>
                <Text style={styles.errorTitle}>Suivi indisponible</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
              <Pressable onPress={() => load()} style={styles.retryButton}>
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null}

          <Card style={styles.heroCard} padded={false}>
            <View style={styles.heroInner}>
              <View style={styles.heroHeader}>
                <View>
                  <Text style={styles.heroEyebrow}>ÉTAT DE LA LIVRAISON</Text>
                  <View style={styles.statusLine}>
                    <Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} />
                    <StatusBadge domain="delivery" status={deliveryStatus} />
                  </View>
                </View>

                <View style={styles.livePill}>
                  <View style={styles.livePillDot} />
                  <Text style={styles.livePillText}>Synchronisé</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: progressWidth },
                    isDelivered && styles.progressFillComplete,
                    deliveryStatus === 'arrived' && styles.progressFillArrived,
                  ]}
                />
              </View>

              <Text style={styles.heroHelper}>
                {tracking.message ||
                  (isDelivered
                    ? 'La livraison est marquée comme livrée par LIVI.'
                    : 'Le suivi affiché correspond aux informations actuellement fournies par LIVI.')}
              </Text>
            </View>
          </Card>

          {tracking.currentLocation ? (
            <Card style={styles.card}>
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionEyebrow}>POSITION</Text>
                  <Text style={styles.sectionTitle}>Localisation actuelle</Text>
                </View>
                <View style={styles.locationBadge}>
                  <Text style={styles.locationBadgeText}>LIVI</Text>
                </View>
              </View>

              <View style={styles.locationRow}>
                <View style={styles.locationIcon}>
                  <Text style={styles.locationIconText}>•</Text>
                </View>
                <Text style={styles.locationText}>{tracking.currentLocation}</Text>
              </View>
            </Card>
          ) : null}

          <Card style={styles.card}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>JOURNAL</Text>
                <Text style={styles.sectionTitle}>Historique du suivi</Text>
              </View>
              {hasEvents ? (
                <View style={styles.eventCountBadge}>
                  <Text style={styles.eventCountText}>{tracking.events.length}</Text>
                </View>
              ) : null}
            </View>

            {hasEvents ? (
              <View style={styles.eventsList}>
                {tracking.events.map((event, index) => (
                  <EventRow
                    key={String(event.id ?? `${index}-${event.timestamp ?? event.created_at ?? ''}`)}
                    event={event}
                    first={index === 0}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.noEventsBox}>
                <View style={styles.noEventsIcon}>
                  <View style={styles.noEventsIconInner} />
                </View>
                <Text style={styles.noEventsTitle}>Pas encore de détail d’étape</Text>
                <Text style={styles.noEventsText}>
                  Les événements apparaîtront ici dès qu’ils seront transmis par le backend LIVI.
                </Text>
              </View>
            )}
          </Card>

          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>Suivi en temps réel</Text>
            <Text style={styles.infoText}>
              Cette page se synchronise automatiquement pendant qu’elle est ouverte. Les changements affichés proviennent directement du service LIVI.
            </Text>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoDot} />
              <Text style={styles.infoMeta}>Actualisation automatique toutes les 15 secondes</Text>
            </View>
          </Card>

          {isDelivered ? (
            <Button
              title="Voir la commande"
              variant="secondary"
              fullWidth
              onPress={() => navigation?.navigate?.('OrderDetails', { orderId })}
            />
          ) : null}

          <Text style={styles.footnote}>
            Le mobile ne valide aucune transition de livraison localement.
          </Text>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
    gap: spacing[4],
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  headingBlock: {
    flex: 1,
  },

  kicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.gold,
    marginBottom: 2,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    lineHeight: 30,
    color: colors.textPrimary,
  },

  backButton: {
    minHeight: 36,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  pressed: {
    opacity: 0.82,
  },

  heroCard: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.dark3,
    ...shadow.md,
  },

  heroInner: {
    padding: spacing[5],
    gap: spacing[4],
  },

  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[3],
  },

  heroEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textMuted,
    marginBottom: spacing[2],
  },

  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: colors.greenBorder,
  },

  livePillDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },

  livePillText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.green,
  },

  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.dark5,
    overflow: 'hidden',
  },

  progressFill: {
    width: '50%',
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  progressFillArrived: {
    width: '88%',
    backgroundColor: colors.gold2,
  },

  progressFillComplete: {
    width: '100%',
    backgroundColor: colors.green,
  },

  heroHelper: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
  },

  card: {
    gap: spacing[4],
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  sectionEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.3,
    color: colors.gold,
    marginBottom: 2,
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  locationBadge: {
    minWidth: 42,
    minHeight: 28,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locationBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  locationIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locationIconText: {
    fontFamily: fonts.brand,
    fontSize: 20,
    lineHeight: 20,
    color: colors.gold,
  },

  locationText: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  eventCountBadge: {
    minWidth: 30,
    minHeight: 30,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventCountText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  eventsList: {
    gap: spacing[1],
  },

  eventRow: {
    flexDirection: 'row',
    minHeight: 62,
  },

  eventRail: {
    width: 22,
    alignItems: 'center',
  },

  eventDot: {
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: radius.full,
    backgroundColor: colors.dark5,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    zIndex: 2,
  },

  eventDotActive: {
    backgroundColor: colors.gold,
    borderColor: colors.goldBorder,
  },

  eventLine: {
    position: 'absolute',
    top: 15,
    bottom: -1,
    width: 1,
    backgroundColor: colors.border,
  },

  eventBody: {
    flex: 1,
    paddingLeft: spacing[2],
    paddingBottom: spacing[4],
  },

  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  eventTitle: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  eventTime: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },

  noEventsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[6],
    borderRadius: radius.lg,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  noEventsIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noEventsIconInner: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  noEventsTitle: {
    marginTop: spacing[3],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  noEventsText: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },

  infoCard: {
    backgroundColor: colors.dark2,
  },

  infoTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },

  infoText: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
  },

  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  infoDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },

  infoMeta: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  errorBox: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  errorCopy: {
    flex: 1,
  },

  errorTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  errorText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },

  retryButton: {
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  footnote: {
    paddingHorizontal: spacing[2],
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
