import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
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
  Screen,
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
      return 'En traitement';
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

function statusTone(status?: string) {
  switch (status) {
    case 'completed':
      return styles.statusSuccess;
    case 'failed':
    case 'cancelled':
      return styles.statusDanger;
    case 'processing':
      return styles.statusInfo;
    default:
      return styles.statusPending;
  }
}

function statusDot(status?: string) {
  switch (status) {
    case 'completed':
      return styles.dotSuccess;
    case 'failed':
    case 'cancelled':
      return styles.dotDanger;
    case 'processing':
      return styles.dotInfo;
    default:
      return styles.dotPending;
  }
}

function formatDate(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('fr-FR');
}

function WithdrawalRow({
  item,
  onPress,
}: {
  item: Withdrawal;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View
      style={[
        styles.rowShell,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          Animated.spring(scale, {
            toValue: 0.985,
            useNativeDriver: true,
            friction: 8,
            tension: 110,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 110,
          }).start();
        }}
        style={styles.row}
      >
        <View style={styles.rowMain}>
          <View style={styles.rowTitleBlock}>
            <View style={[styles.statusDot, statusDot(item.status)]} />
            <Text style={styles.reference} numberOfLines={1}>
              {item.reference ?? item.id}
            </Text>
          </View>

          <Text style={styles.date}>
            {formatDate(item.created_at)}
          </Text>
        </View>

        <View style={styles.rowAmount}>
          <Money
            amount={item.amount}
            currency={item.currency}
            size="sm"
          />

          <View style={[styles.statusPill, statusTone(item.status)]}>
            <Text style={styles.statusText}>
              {statusLabel(item.status)}
            </Text>
          </View>
        </View>

        {typeof item.net_amount === 'number' ? (
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net</Text>
            <Text style={styles.netValue}>
              {new Intl.NumberFormat('fr-FR').format(item.net_amount)}{' '}
              {item.currency ?? 'XOF'}
            </Text>
          </View>
        ) : null}

        <View style={styles.rowArrow}>
          <Text style={styles.rowArrowText}>›</Text>
        </View>
      </Pressable>
    </Animated.View>
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
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function WithdrawalDetailsScreen({
  route,
  navigation,
}: any) {
  const withdrawalId = route?.params?.withdrawalId
    ? String(route.params.withdrawalId)
    : '';

  const [items, setItems] = useState<Withdrawal[]>([]);
  const [detail, setDetail] = useState<Withdrawal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const entrance = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      if (withdrawalId) {
        setDetail(
          await walletApi.getWithdrawal(withdrawalId),
        );
      } else {
        const response = await walletApi.listWithdrawals({
          page: 1,
          limit: 50,
        });

        setItems(normalize(response));
      }
    } catch (e: any) {
      setError(
        e?.message ?? 'Impossible de charger les retraits.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [withdrawalId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  if (withdrawalId) {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={styles.container}
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
            <View style={styles.header}>
              <Text style={styles.eyebrow}>WALLET LIVI</Text>
              <Text style={styles.title}>Détail du retrait</Text>
              <Text style={styles.subtitle}>
                État et informations retournés par le serveur.
              </Text>
            </View>

            {loading ? (
              <View style={styles.detailLoading}>
                <Skeleton height={230} radius={radius['2xl']} />
                <Skeleton height={120} radius={radius.xl} />
              </View>
            ) : error ? (
              <View style={styles.errorCard}>
                <View style={styles.errorIcon}>
                  <Text style={styles.errorIconText}>!</Text>
                </View>

                <View style={styles.errorCopy}>
                  <Text style={styles.errorTitle}>
                    Retrait indisponible
                  </Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>

                <Pressable
                  onPress={() => load()}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Réessayer</Text>
                </Pressable>
              </View>
            ) : detail ? (
              <>
                <View style={styles.heroCard}>
                  <View style={styles.heroTop}>
                    <View>
                      <Text style={styles.heroLabel}>
                        MONTANT DEMANDÉ
                      </Text>
                      <Money
                        amount={detail.amount}
                        currency={detail.currency}
                        size="xl"
                        color={colors.textPrimary}
                      />
                    </View>

                    <View style={styles.heroStatusWrap}>
                      <View
                        style={[
                          styles.largeStatusDot,
                          statusDot(detail.status),
                        ]}
                      />
                      <Text style={styles.heroStatus}>
                        {statusLabel(detail.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.heroDivider} />

                  <View style={styles.referenceBlock}>
                    <Text style={styles.referenceLabel}>RÉFÉRENCE</Text>
                    <Text style={styles.referenceValue}>
                      {detail.reference ?? detail.id}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsCard}>
                  <Text style={styles.sectionEyebrow}>DÉTAILS</Text>

                  {typeof detail.fee === 'number' ? (
                    <DetailLine
                      label="Frais"
                      value={`${new Intl.NumberFormat('fr-FR').format(
                        detail.fee,
                      )} ${detail.currency ?? 'XOF'}`}
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
                    value={formatDateTime(detail.created_at)}
                  />

                  {detail.updated_at ? (
                    <DetailLine
                      label="Mis à jour"
                      value={formatDateTime(detail.updated_at)}
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
              </>
            ) : (
              <EmptyState
                icon="·"
                title="Retrait introuvable"
                description="Le serveur n’a pas retourné le retrait demandé."
              />
            )}

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
          </Animated.View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
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
        <Animated.View
          style={{
            opacity: entrance,
            transform: [{ translateY }],
          }}
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
              <View style={styles.errorIcon}>
                <Text style={styles.errorIconText}>!</Text>
              </View>

              <View style={styles.errorCopy}>
                <Text style={styles.errorTitle}>
                  Historique indisponible
                </Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>

              <Pressable
                onPress={() => load()}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.listLoading}>
              <Skeleton height={122} radius={radius.xl} />
              <Skeleton height={122} radius={radius.xl} />
              <Skeleton height={122} radius={radius.xl} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyWrapper}>
              <EmptyState
                icon="·"
                title="Aucun retrait"
                description="Les demandes de retrait retournées par le serveur apparaîtront ici."
              />
            </View>
          ) : (
            <View style={styles.list}>
              {items.map((item, index) => (
                <WithdrawalRow
                  key={String(item.id ?? `${item.reference}-${index}`)}
                  item={item}
                  onPress={() =>
                    navigation.navigate('WithdrawalDetails', {
                      withdrawalId: item.id,
                    })
                  }
                />
              ))}
            </View>
          )}

          <Pressable
            onPress={() => navigation.navigate('Withdraw')}
            style={styles.primaryLink}
          >
            <Text style={styles.primaryLinkText}>
              Demander un retrait
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
  },

  header: {
    gap: spacing[1],
    marginBottom: spacing[5],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  list: {
    gap: spacing[3],
  },

  rowShell: {
    borderRadius: radius.xl,
  },

  row: {
    minHeight: 132,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },

  rowMain: {
    paddingRight: spacing[6],
  },

  rowTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },

  dotPending: {
    backgroundColor: colors.gold,
  },

  dotInfo: {
    backgroundColor: colors.blue,
  },

  dotSuccess: {
    backgroundColor: colors.green,
  },

  dotDanger: {
    backgroundColor: colors.red,
  },

  reference: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  date: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  rowAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  statusPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },

  statusPending: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  statusInfo: {
    backgroundColor: colors.blueDim,
    borderColor: colors.blueBorder,
  },

  statusSuccess: {
    backgroundColor: colors.greenDim,
    borderColor: colors.greenBorder,
  },

  statusDanger: {
    backgroundColor: colors.redDim,
    borderColor: colors.redBorder,
  },

  statusText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.textPrimary,
  },

  netRow: {
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  netLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  netValue: {
    flexShrink: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },

  rowArrow: {
    position: 'absolute',
    top: spacing[4],
    right: spacing[4],
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
  },

  rowArrowText: {
    marginTop: -2,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: fontSize.lg,
  },

  listLoading: {
    gap: spacing[3],
  },

  emptyWrapper: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailLoading: {
    gap: spacing[3],
  },

  heroCard: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    gap: spacing[5],
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[4],
  },

  heroLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.1,
    color: colors.textMuted,
    marginBottom: spacing[2],
  },

  heroStatusWrap: {
    maxWidth: '42%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  largeStatusDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },

  heroStatus: {
    flexShrink: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  heroDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  referenceBlock: {
    gap: spacing[1],
  },

  referenceLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textMuted,
  },

  referenceValue: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  detailsCard: {
    marginTop: spacing[4],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[4],
  },

  sectionEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.1,
    color: colors.gold,
  },

  detailLine: {
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing[1],
  },

  detailLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  detailValue: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  failureBox: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.redDim,
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
    lineHeight: 20,
    color: colors.textSecondary,
  },

  errorCard: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  errorIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.red,
  },

  errorCopy: {
    flex: 1,
    gap: spacing[1],
  },

  errorTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
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

  bottomLink: {
    alignSelf: 'center',
    marginTop: spacing[5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },

  bottomLinkText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  primaryLink: {
    alignSelf: 'center',
    marginTop: spacing[5],
    minHeight: 44,
    paddingHorizontal: spacing[5],
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryLinkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },
});
