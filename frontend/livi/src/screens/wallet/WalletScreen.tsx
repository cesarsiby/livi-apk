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
import { useFocusEffect } from '@react-navigation/native';

import { useWalletStore } from '../../features/wallet/walletStore';
import { walletApi } from '../../features/wallet/walletApi';
import { useAuth } from '../../features/auth/AuthProvider';
import type {
  WalletTransaction,
  TransactionListResponse,
} from '../../features/wallet/types';

import {
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

function normalizeTransactions(
  response: TransactionListResponse,
): WalletTransaction[] {
  if (Array.isArray(response)) return response;
  return response.data ?? response.items ?? response.transactions ?? [];
}

function formatDate(value?: string) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return '';
  }
}

function ActionButton({
  symbol,
  title,
  subtitle,
  onPress,
  secondary = false,
}: {
  symbol: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.actionButton,
          secondary && styles.actionButtonSecondary,
        ]}
      >
        <View
          style={[
            styles.actionIcon,
            secondary && styles.actionIconSecondary,
          ]}
        >
          <Text
            style={[
              styles.actionIconText,
              secondary && styles.actionIconTextSecondary,
            ]}
          >
            {symbol}
          </Text>
        </View>

        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </Pressable>
    </Animated.View>
  );
}

function TransactionRow({
  transaction,
  currency,
  navigation,
}: {
  transaction: WalletTransaction;
  currency: string;
  navigation: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={styles.transactionRow}
        onPress={() =>
          navigation.navigate('TransactionDetails', {
            transactionId: transaction.id,
          })
        }
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.985,
            useNativeDriver: true,
            friction: 8,
            tension: 90,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 90,
          }).start()
        }
      >
        <View style={styles.transactionLeft}>
          <View style={styles.transactionGlyph}>
            <Text style={styles.transactionGlyphText}>
              {transaction.status === 'completed' ? '✓' : '•'}
            </Text>
          </View>

          <View style={styles.transactionTextWrap}>
            <Text
              numberOfLines={1}
              style={styles.transactionTitle}
            >
              {transaction.description ||
                transaction.reference ||
                'Transaction'}
            </Text>

            <Text style={styles.transactionDate}>
              {formatDate(transaction.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.transactionRight}>
          <Money
            amount={transaction.amount}
            currency={transaction.currency ?? currency}
            size="sm"
          />

          <StatusBadge
            domain="escrow"
            status={transaction.status}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function WalletScreen({ navigation }: any) {
  const { user } = useAuth();
  const isPayable =
    user?.role === 'vendor' || user?.role === 'transporter';

  const {
    wallet,
    loading: walletLoading,
    error,
    refresh,
  } = useWalletStore();

  const [recent, setRecent] = useState<WalletTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setTxLoading(true);
      }

      try {
        const [transactionsResult] = await Promise.all([
          walletApi.listTransactions({
            page: 1,
            limit: 5,
          }),
          refresh(),
        ]);

        setRecent(normalizeTransactions(transactionsResult));
      } catch {
        setRecent([]);
      } finally {
        setTxLoading(false);
        setRefreshing(false);
      }
    },
    [refresh],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const currency = wallet?.currency ?? 'FCFA';
  const available = Number(wallet?.available_amount ?? 0);
  const locked = Number(wallet?.locked_amount ?? 0);
  const owed =
    wallet?.owed_total != null
      ? Number(wallet.owed_total)
      : null;

  const activeOrders = wallet?.active_order_count;

  const heroTranslate = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const heroOpacity = entrance;

  return (
    <ScrollView
      style={styles.screen}
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
        style={[
          styles.heroSection,
          {
            opacity: heroOpacity,
            transform: [{ translateY: heroTranslate }],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>FINANCES LIVI</Text>
            <Text style={styles.title}>Wallet</Text>
          </View>

          <Pressable
            style={styles.historyButton}
            onPress={() => navigation.navigate('Transactions')}
          >
            <Text style={styles.historyButtonText}>Historique</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => load()}>
              <Text style={styles.errorRetry}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}

        {walletLoading && !wallet ? (
          <Skeleton height={218} radius={radius['2xl']} />
        ) : (
          <View style={styles.balanceCard}>
            <View style={styles.balanceTopRow}>
              <View>
                <Text style={styles.balanceEyebrow}>
                  {isPayable
                    ? 'SOLDE DISPONIBLE'
                    : 'FONDS PROTÉGÉS'}
                </Text>

                <Money
                  amount={isPayable ? available : locked}
                  currency={currency}
                  size="xl"
                  color={colors.textPrimary}
                  style={styles.balanceAmount}
                />
              </View>

              <View style={styles.secureBadge}>
                <Text style={styles.secureBadgeText}>PROTÉGÉ</Text>
              </View>
            </View>

            <View style={styles.balanceDivider} />

            <View style={styles.balanceBottom}>
              {isPayable ? (
                <>
                  <View style={styles.balanceMetric}>
                    <Text style={styles.metricLabel}>
                      En attente
                    </Text>
                    <Money
                      amount={locked}
                      currency={currency}
                      size="sm"
                      color={colors.textPrimary}
                    />
                  </View>

                  {owed !== null ? (
                    <View style={styles.balanceMetric}>
                      <Text style={styles.metricLabel}>
                        Dû au total
                      </Text>
                      <Money
                        amount={owed}
                        currency={currency}
                        size="sm"
                        color={colors.textPrimary}
                      />
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.protectionCopy}>
                  <View style={styles.protectionDot} />
                  <Text style={styles.protectionText}>
                    Vos paiements restent protégés jusqu’à la
                    confirmation de réception.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </Animated.View>

      <Animated.View
        style={[
          styles.section,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionTitle}>Actions</Text>
            <Text style={styles.sectionSubtitle}>
              Les opérations utiles, au bon endroit.
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {isPayable ? (
            <>
              <ActionButton
                symbol="↗"
                title="Retirer"
                subtitle="Demander un retrait"
                onPress={() => navigation.navigate('Withdraw')}
              />

              <ActionButton
                symbol="↻"
                title="Retraits"
                subtitle="Voir les demandes"
                secondary
                onPress={() =>
                  navigation.navigate('WithdrawalDetails')
                }
              />

              <ActionButton
                symbol="⌁"
                title="Protection"
                subtitle="Voir l’escrow"
                secondary
                onPress={() => navigation.navigate('Escrow')}
              />
            </>
          ) : (
            <>
              <ActionButton
                symbol="⌁"
                title="Protection"
                subtitle="Voir vos fonds"
                onPress={() => navigation.navigate('Escrow')}
              />

              <ActionButton
                symbol="↘"
                title="Déposer"
                subtitle="Ajouter des fonds"
                secondary
                onPress={() => navigation.navigate('Deposit')}
              />

              <ActionButton
                symbol="↩"
                title="Remboursements"
                subtitle="Suivre les remboursements"
                secondary
                onPress={() =>
                  navigation.navigate('Refunds')
                }
              />
            </>
          )}
        </View>
      </Animated.View>

      {!isPayable ? (
        <Animated.View
          style={[
            styles.infoCard,
            {
              opacity: entrance,
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>✓</Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Une protection intégrée
            </Text>

            <Text style={styles.infoText}>
              Votre argent reste sécurisé tant que la commande
              n’est pas confirmée comme reçue.
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.section,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionTitle}>
              Transactions récentes
            </Text>
            <Text style={styles.sectionSubtitle}>
              Les 5 dernières opérations.
            </Text>
          </View>

          {recent.length > 0 ? (
            <Pressable
              onPress={() => navigation.navigate('Transactions')}
            >
              <Text style={styles.seeAll}>Tout voir</Text>
            </Pressable>
          ) : null}
        </View>

        {txLoading ? (
          <View style={styles.transactionsSkeleton}>
            <Skeleton height={76} radius={radius.lg} />
            <Skeleton height={76} radius={radius.lg} />
          </View>
        ) : recent.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="·"
              title="Aucune transaction"
              description="Vos paiements, ventes et retraits apparaîtront ici dès qu’ils seront enregistrés."
            />
          </View>
        ) : (
          <View style={styles.transactionList}>
            {recent.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                currency={currency}
                navigation={navigation}
              />
            ))}
          </View>
        )}
      </Animated.View>

      {!isPayable && locked > 0 ? (
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteTitle}>
            {activeOrders != null
              ? `${activeOrders} commande${
                  activeOrders > 1 ? 's' : ''
                } concernée${
                  activeOrders > 1 ? 's' : ''
                }`
              : 'Fonds en cours'}
          </Text>

          <Text style={styles.footerNoteText}>
            Le montant affiché provient directement du service
            financier Livi.
          </Text>
        </View>
      ) : (
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            Les montants affichés proviennent directement des
            données financières disponibles sur votre compte.
          </Text>
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
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  heroSection: {
    gap: spacing[4],
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.6,
    color: colors.gold,
    marginBottom: spacing[1],
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    color: colors.textPrimary,
  },

  historyButton: {
    minHeight: 40,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    justifyContent: 'center',
  },

  historyButtonText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  errorBanner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: colors.dark3,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  errorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textPrimary,
  },

  errorRetry: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  balanceCard: {
    minHeight: 218,
    borderRadius: radius['2xl'],
    padding: spacing[6],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    overflow: 'hidden',
  },

  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  balanceEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },

  balanceAmount: {
    marginTop: spacing[2],
  },

  secureBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  secureBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.gold,
  },

  balanceDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing[5],
  },

  balanceBottom: {
    minHeight: 48,
    justifyContent: 'center',
  },

  balanceMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },

  metricLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  protectionCopy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },

  protectionDot: {
    width: 8,
    height: 8,
    marginTop: 5,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  protectionText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  section: {
    marginTop: spacing[6],
  },

  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
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
    color: colors.textMuted,
  },

  seeAll: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },

  actionButton: {
    minHeight: 128,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.gold,
    justifyContent: 'space-between',
  },

  actionButtonSecondary: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark,
  },

  actionIconSecondary: {
    backgroundColor: colors.dark4,
  },

  actionIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  actionIconTextSecondary: {
    color: colors.textPrimary,
  },

  actionTitle: {
    marginTop: spacing[3],
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  actionSubtitle: {
    marginTop: spacing[1],
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 14,
    color: colors.dark,
    opacity: 0.72,
  },

  actionButtonSecondaryText: {
    color: colors.textPrimary,
  },

  infoCard: {
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    flexDirection: 'row',
    gap: spacing[3],
  },

  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  infoText: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  transactionsSkeleton: {
    gap: spacing[2],
  },

  transactionList: {
    gap: spacing[2],
  },

  transactionRow: {
    minHeight: 76,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  transactionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  transactionGlyph: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  transactionGlyphText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  transactionTextWrap: {
    flex: 1,
  },

  transactionTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  transactionDate: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  transactionRight: {
    alignItems: 'flex-end',
    gap: spacing[1],
  },

  emptyWrapper: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    overflow: 'hidden',
  },

  footerNote: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[2],
    alignItems: 'center',
  },

  footerNoteTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  footerNoteText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
