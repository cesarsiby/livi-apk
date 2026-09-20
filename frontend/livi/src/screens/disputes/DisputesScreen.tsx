import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  disputesApi,
  normalizeDisputes,
} from '../../features/disputes/disputesApi';

import type { Dispute } from '../../features/disputes/types';

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

function formatDate(value?: string) {
  if (!value) return '';

  return new Date(value).toLocaleDateString(
    'fr-FR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  );
}

export function DisputesScreen({
  navigation,
}: any) {
  const [items, setItems] = useState<Dispute[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);

        const result =
          await disputesApi.list();

        setItems(normalizeDisputes(result));
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger les litiges.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const openCount = useMemo(
    () =>
      items.filter(
        (item) => item.status === 'open',
      ).length,
    [items],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.gold}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ASSISTANCE LIVI</Text>
        <Text style={styles.title}>Mes litiges</Text>
        <Text style={styles.subtitle}>
          Suivez vos demandes d’assistance et les échanges associés.
        </Text>
      </View>

      {!loading && items.length > 0 ? (
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>
              Dossiers
            </Text>
            <Text style={styles.summaryValue}>
              {items.length}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View>
            <Text style={styles.summaryLabel}>
              En cours
            </Text>
            <Text style={styles.summaryValue}>
              {openCount}
            </Text>
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>

          <Pressable onPress={() => load()}>
            <Text style={styles.retry}>
              Réessayer
            </Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingList}>
          <Skeleton
            height={128}
            radius={radius.xl}
          />
          <Skeleton
            height={128}
            radius={radius.xl}
          />
          <Skeleton
            height={128}
            radius={radius.xl}
          />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="·"
          title="Aucun litige"
          description="Les dossiers créés depuis vos commandes apparaîtront ici."
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                navigation.navigate(
                  'DisputeDetails',
                  {
                    disputeId: item.id,
                  },
                )
              }
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={styles.caseLabel}>
                    LITIGE
                  </Text>

                  <Text
                    style={styles.caseId}
                    numberOfLines={1}
                  >
                    #{item.id}
                  </Text>
                </View>

                <StatusBadge
                  domain="dispute"
                  status={item.status}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.line}>
                <Text style={styles.lineLabel}>
                  Commande
                </Text>

                <Text
                  style={styles.lineValue}
                  numberOfLines={1}
                >
                  {item.order_id ?? '—'}
                </Text>
              </View>

              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>
                  Motif
                </Text>

                <Text
                  style={styles.reason}
                  numberOfLines={3}
                >
                  {item.reason ?? '—'}
                </Text>
              </View>

              <View style={styles.footer}>
                <Text style={styles.date}>
                  {formatDate(item.created_at)}
                </Text>

                <Text style={styles.openLink}>
                  Ouvrir →
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
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
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
    gap: spacing[4],
  },

  header: {
    gap: spacing[1],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.6,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  summaryLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  summaryValue: {
    marginTop: 2,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
  },

  summaryDivider: {
    width: 1,
    height: 34,
    backgroundColor: colors.border,
  },

  loadingList: {
    gap: spacing[3],
  },

  list: {
    gap: spacing[3],
  },

  card: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },

  cardPressed: {
    opacity: 0.92,
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[3],
  },

  cardCopy: {
    flex: 1,
    gap: 2,
  },

  caseLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    color: colors.gold,
  },

  caseId: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  lineLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  lineValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  reasonBox: {
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    gap: spacing[1],
  },

  reasonLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  reason: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[3],
  },

  date: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  openLink: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  errorCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.redBorder,
    gap: spacing[2],
  },

  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  retry: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
