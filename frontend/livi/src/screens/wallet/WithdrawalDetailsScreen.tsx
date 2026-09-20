import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { walletApi } from '../../features/wallet/walletApi';
import type {
  Withdrawal,
  WithdrawalListResponse,
} from '../../features/wallet/types';

import {
  EmptyState,
  Money,
  Skeleton,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

function normalize(
  response: WithdrawalListResponse,
): Withdrawal[] {
  if (Array.isArray(response)) return response;

  return (
    response.data ??
    response.items ??
    response.withdrawals ??
    []
  );
}

function statusLabel(status?: string) {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'processing':
      return 'Traitement';
    case 'completed':
      return 'Terminé';
    case 'failed':
      return 'Échec';
    case 'cancelled':
      return 'Annulé';
    default:
      return status || 'Non précisé';
  }
}

function statusStyle(status?: string) {
  switch (status) {
    case 'completed':
      return styles.statusSuccess;
    case 'failed':
    case 'cancelled':
      return styles.statusDanger;
    case 'processing':
      return styles.statusBlue;
    default:
      return styles.statusPending;
  }
}

function formatDate(value?: string) {
  if (!value) return '';

  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function WithdrawalRow({
  item,
  onPress,
}: {
  item: Withdrawal;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowMain}>
          <Text style={styles.reference} numberOfLines={1}>
            {item.reference ?? item.id}
          </Text>

          <Text style={styles.date}>
            {formatDate(item.created_at)}
          </Text>
        </View>

        <Money
          amount={item.amount}
          currency={item.currency}
          size="sm"
        />
      </View>

      <View style={styles.rowBottom}>
        <View
          style={[
            styles.statusPill,
            statusStyle(item.status),
          ]}
        >
          <Text style={styles.statusText}>
            {statusLabel(item.status)}
          </Text>
        </View>

        {typeof item.net_amount === 'number' ? (
          <Text style={styles.net}>
            Net :{' '}
            {new Intl.NumberFormat('fr-FR').format(item.net_amount)}{' '}
            {item.currency ?? 'XOF'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function WithdrawalDetailsScreen({
  route,
  navigation,
}: any) {
  const withdrawalId = route.params?.withdrawalId as
    | string
    | undefined;

  const [items, setItems] = useState<Withdrawal[]>([]);
  const [detail, setDetail] = useState<Withdrawal | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);

        if (withdrawalId) {
          setDetail(
            await walletApi.getWithdrawal(withdrawalId),
          );
        } else {
          setItems(
            normalize(
              await walletApi.listWithdrawals({
                page: 1,
                limit: 50,
              }),
            ),
          );
        }
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger les retraits.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [withdrawalId],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (withdrawalId) {
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
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>WALLET LIVI</Text>
          <Text style={styles.title}>Détail du retrait</Text>
        </View>

        {loading ? (
          <Skeleton
            height={260}
            radius={radius['2xl']}
          />
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => load()}>
              <Text style={styles.retry}>Réessayer</Text>
            </Pressable>
          </View>
        ) : detail ? (
          <View style={styles.detailCard}>
            <View style={styles.detailAmount}>
              <Text style={styles.detailLabel}>
                Montant demandé
              </Text>

              <Money
                amount={detail.amount}
                currency={detail.currency}
                size="xl"
                color={colors.textPrimary}
              />
            </View>

            <View
              style={[
                styles.statusPill,
                statusStyle(detail.status),
              ]}
            >
              <Text style={styles.statusText}>
                {statusLabel(detail.status)}
              </Text>
            </View>

            <View style={styles.divider} />

            <DetailLine
              label="Référence"
              value={detail.reference ?? detail.id}
            />

            {typeof detail.fee === 'number' ? (
              <DetailLine
                label="Frais"
                value={`${new Intl.NumberFormat(
                  'fr-FR',
                ).format(detail.fee)} ${
                  detail.currency ?? 'XOF'
                }`}
              />
            ) : null}

            {typeof detail.net_amount === 'number' ? (
              <DetailLine
                label="Montant net"
                value={`${new Intl.NumberFormat(
                  'fr-FR',
                ).format(detail.net_amount)} ${
                  detail.currency ?? 'XOF'
                }`}
              />
            ) : null}

            <DetailLine
              label="Créé le"
              value={
                detail.created_at
                  ? new Date(
                      detail.created_at,
                    ).toLocaleString('fr-FR')
                  : '—'
              }
            />

            {detail.updated_at ? (
              <DetailLine
                label="Mis à jour"
                value={new Date(
                  detail.updated_at,
                ).toLocaleString('fr-FR')}
              />
            ) : null}

            {detail.failure_reason ? (
              <View style={styles.failureBox}>
                <Text style={styles.failureLabel}>
                  Motif de l’échec
                </Text>
                <Text style={styles.failureText}>
                  {detail.failure_reason}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={() =>
            withdrawalId
              ? navigation.goBack()
              : navigation.navigate('Withdraw')
          }
          style={styles.bottomLink}
        >
          <Text style={styles.bottomLinkText}>
            {withdrawalId
              ? 'Retour'
              : 'Nouvelle demande de retrait'}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

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
        <Text style={styles.eyebrow}>WALLET LIVI</Text>
        <Text style={styles.title}>Mes retraits</Text>
        <Text style={styles.subtitle}>
          Suivi des demandes transmises au serveur.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => load()}>
            <Text style={styles.retry}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <>
          <Skeleton height={110} radius={radius.xl} />
          <Skeleton height={110} radius={radius.xl} />
          <Skeleton height={110} radius={radius.xl} />
        </>
      ) : items.length === 0 ? (
        <EmptyState
          icon="·"
          title="Aucun retrait"
          description="Les demandes de retrait retournées par le serveur apparaîtront ici."
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <WithdrawalRow
              key={item.id}
              item={item}
              onPress={() =>
                navigation.navigate(
                  'WithdrawalDetails',
                  {
                    withdrawalId: item.id,
                  },
                )
              }
            />
          ))}
        </View>
      )}

      <Pressable
        onPress={() => navigation.navigate('Withdraw')}
        style={styles.actionLink}
      >
        <Text style={styles.actionLinkText}>
          Demander un retrait
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLineLabel}>{label}</Text>
      <Text style={styles.detailLineValue}>{value}</Text>
    </View>
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
    color: colors.textSecondary,
  },

  list: {
    gap: spacing[3],
  },

  row: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[4],
  },

  rowPressed: {
    opacity: 0.92,
  },

  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  rowMain: {
    flex: 1,
    gap: spacing[1],
  },

  reference: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  date: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[3],
  },

  statusPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },

  statusPending: {
    backgroundColor: colors.dark3,
    borderColor: colors.goldBorder,
  },

  statusBlue: {
    backgroundColor: colors.dark3,
    borderColor: colors.blueBorder,
  },

  statusSuccess: {
    backgroundColor: colors.dark3,
    borderColor: colors.greenBorder,
  },

  statusDanger: {
    backgroundColor: colors.dark3,
    borderColor: colors.redBorder,
  },

  statusText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  net: {
    flexShrink: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },

  detailCard: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[4],
  },

  detailAmount: {
    gap: spacing[1],
  },

  detailLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  detailLine: {
    gap: spacing[1],
  },

  detailLineLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  detailLineValue: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  failureBox: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.redBorder,
    gap: spacing[1],
  },

  failureLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  failureText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textSecondary,
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

  bottomLink: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },

  bottomLinkText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  actionLink: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },

  actionLinkText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
