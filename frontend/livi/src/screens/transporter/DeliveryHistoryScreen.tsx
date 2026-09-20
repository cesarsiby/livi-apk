import React, { useCallback, useMemo, useState } from 'react';
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
} from '../../features/transporter/transporterApi';

import { normalizeList } from '../../services/api/normalize';

import {
  EmptyState,
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

function HistoryCard({
  item,
  onPress,
}: {
  item: any;
  onPress: () => void;
}) {
  const trackingCode =
    item.tracking_code ??
    `#${String(item.id ?? '').slice(0, 8)}`;

  const delivered =
    item.delivered_at
      ? new Date(
          item.delivered_at,
        ).toLocaleDateString('fr-FR')
      : null;

  const city =
    item.delivery_city ??
    item.dropoff_city ??
    item.city;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>
            ✓
          </Text>
        </View>

        <View style={styles.identity}>
          <Text
            numberOfLines={1}
            style={styles.reference}
          >
            {trackingCode}
          </Text>

          <Text style={styles.date}>
            {delivered
              ? `Livrée le ${delivered}`
              : 'Livraison terminée'}
          </Text>
        </View>

        <StatusBadge
          domain="delivery"
          status={item.status}
        />
      </View>

      <View style={styles.infoRow}>
        <View style={styles.info}>
          <Text style={styles.infoLabel}>
            Destination
          </Text>

          <Text
            numberOfLines={2}
            style={styles.infoValue}
          >
            {city ??
              item.delivery_address_line ??
              'Adresse non renseignée'}
          </Text>
        </View>

        <Text style={styles.arrow}>
          →
        </Text>
      </View>
    </Pressable>
  );
}

export function DeliveryHistoryScreen({
  navigation,
}: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState('');

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
          await transporterApi.history({
            limit: 50,
          });

        setItems(
          normalizeList<any>(
            response,
            [
              'missions',
              'deliveries',
              'history',
              'data',
            ],
          ),
        );
      } catch (e: any) {
        setError(
          e?.message ??
            "Impossible de charger l'historique.",
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

  const completedCount = useMemo(
    () =>
      items.filter((item) =>
        [
          'delivered',
          'completed',
          'received',
        ].includes(
          String(
            item.status ?? '',
          ).toLowerCase(),
        ),
      ).length,
    [items],
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton
          height={105}
          radius={radius.xl}
        />
        <Skeleton
          height={105}
          radius={radius.xl}
        />
        <Skeleton
          height={105}
          radius={radius.xl}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          String(item.id ?? index)
        }
        contentContainerStyle={[
          styles.list,
          items.length === 0 &&
            styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>
                  MON ACTIVITÉ
                </Text>

                <Text style={styles.title}>
                  Historique
                </Text>

                <Text style={styles.subtitle}>
                  Retrouvez les livraisons déjà effectuées.
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countNumber}>
                  {completedCount}
                </Text>

                <Text style={styles.countLabel}>
                  terminées
                </Text>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {error}
                </Text>

                <Pressable
                  onPress={() => void load()}
                >
                  <Text style={styles.retryText}>
                    Réessayer
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {items.length > 0 ? (
              <View style={styles.intro}>
                <Text style={styles.introTitle}>
                  Livraisons passées
                </Text>

                <Text style={styles.introText}>
                  {items.length} élément
                  {items.length > 1
                    ? 's'
                    : ''}{' '}
                  enregistré
                  {items.length > 1
                    ? 's'
                    : ''}
                </Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="✓"
            title="Aucune livraison terminée"
            description="Votre historique se remplira automatiquement après vos premières livraisons."
          />
        }
        ItemSeparatorComponent={() => (
          <View
            style={{ height: spacing[3] }}
          />
        )}
        renderItem={({ item }) => (
          <HistoryCard
            item={item}
            onPress={() =>
              navigation.navigate(
                'MissionDetails',
                {
                  missionId: item.id,
                },
              )
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  loading: {
    flex: 1,
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
    marginBottom: spacing[5],
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

  countBadge: {
    width: 62,
    height: 62,
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countNumber: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  countLabel: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.textMuted,
  },

  errorBox: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'center',
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

  intro: {
    marginBottom: spacing[3],
  },

  introTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  introText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  card: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  cardPressed: {
    opacity: 0.92,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  identity: {
    flex: 1,
  },

  reference: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  date: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  infoRow: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  info: {
    flex: 1,
  },

  infoLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.textMuted,
  },

  infoValue: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.gray2,
  },

  arrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },
});
