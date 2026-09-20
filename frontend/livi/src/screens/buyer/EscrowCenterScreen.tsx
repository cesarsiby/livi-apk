import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { escrowApi } from '../../features/escrow/escrowApi';
import { useAuth } from '../../features/auth/AuthProvider';
import { normalizeList } from '../../services/api/normalize';

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

function ProtectionRow({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: string;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Money
        amount={value}
        currency={currency}
        size="sm"
        color={colors.textPrimary}
      />
    </View>
  );
}

function TransactionItem({
  item,
  currency,
  navigation,
}: {
  item: any;
  currency: string;
  navigation: any;
}) {
  return (
    <Pressable
      onPress={() => {
        if (item.order_id) {
          navigation.navigate(
            'OrderDetails',
            {
              orderId: item.order_id,
            },
          );
        }
      }}
      style={({ pressed }) => [
        styles.transaction,
        pressed && styles.transactionPressed,
      ]}
    >
      <View style={styles.transactionIcon}>
        <Text style={styles.transactionIconText}>
          ✓
        </Text>
      </View>

      <View style={styles.transactionContent}>
        <Text style={styles.transactionTitle}>
          Commande #
          {String(
            item.order_id ??
              item.id ??
              '',
          ).slice(0, 8)}
        </Text>

        <Text style={styles.transactionDate}>
          {item.created_at
            ? new Date(
                item.created_at,
              ).toLocaleDateString(
                'fr-FR',
              )
            : 'Date indisponible'}
        </Text>
      </View>

      <View style={styles.transactionRight}>
        <Money
          amount={item.amount}
          currency={
            item.currency ?? currency
          }
          size="sm"
        />

        <StatusBadge
          domain="escrow"
          status={item.status}
        />
      </View>
    </Pressable>
  );
}

export function EscrowCenterScreen({
  navigation,
}: any) {
  const { user } = useAuth();

  const isPayable =
    user?.role === 'vendor' ||
    user?.role === 'transporter';

  const [balance, setBalance] =
    useState<any>(null);

  const [transactions, setTransactions] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
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
        const [balanceResponse, transactionResponse] =
          await Promise.all([
            escrowApi.balance(),
            escrowApi.transactions({
              limit: 10,
            }),
          ]);

        setBalance(balanceResponse);

        setTransactions(
          normalizeList<any>(
            transactionResponse,
            ['transactions', 'data'],
          ),
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger les fonds protégés.',
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

  const currency =
    balance?.currency ?? 'FCFA';

  const locked = Number(
    balance?.locked_amount ?? 0,
  );

  const available = Number(
    balance?.available_amount ?? 0,
  );

  const activeOrders =
    balance?.active_order_count;

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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          SÉCURITÉ DES PAIEMENTS
        </Text>

        <Text style={styles.title}>
          Protection
        </Text>

        <Text style={styles.subtitle}>
          Suivez les fonds protégés associés à vos
          commandes.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      {loading && !balance ? (
        <Skeleton
          height={230}
          radius={radius['2xl']}
        />
      ) : (
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroIconText}>
                ✓
              </Text>
            </View>

            <View style={styles.protectedBadge}>
              <Text
                style={
                  styles.protectedBadgeText
                }
              >
                PROTÉGÉ
              </Text>
            </View>
          </View>

          <Text style={styles.heroLabel}>
            Fonds actuellement protégés
          </Text>

          <Money
            amount={locked}
            currency={currency}
            size="xl"
            color={colors.gold}
          />

          <Text style={styles.heroText}>
            {isPayable
              ? 'Les fonds en attente sont conservés jusqu’à la confirmation de réception.'
              : 'Vos paiements restent protégés jusqu’à la confirmation de réception.'}
          </Text>

          {activeOrders != null &&
          !isPayable ? (
            <Text style={styles.activeOrders}>
              {activeOrders} commande
              {activeOrders > 1
                ? 's'
                : ''}{' '}
              actuellement concernée
              {activeOrders > 1
                ? 's'
                : ''}
            </Text>
          ) : null}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Comment ça fonctionne
          </Text>

          <Text style={styles.sectionSubtitle}>
            Une protection intégrée au parcours de
            commande.
          </Text>
        </View>

        <View style={styles.steps}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>
                1
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                Vous payez
              </Text>

              <Text style={styles.stepText}>
                Le montant est enregistré et protégé
                pendant le parcours de livraison.
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>
                2
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                La commande avance
              </Text>

              <Text style={styles.stepText}>
                L’état réel de la commande détermine
                la suite du processus.
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>
                3
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                La réception est confirmée
              </Text>

              <Text style={styles.stepText}>
                La libération des fonds suit les règles
                du système Livi.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {isPayable ? (
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View>
              <Text style={styles.balanceTitle}>
                Votre solde disponible
              </Text>

              <Text style={styles.balanceSubtitle}>
                Montant actuellement disponible.
              </Text>
            </View>
          </View>

          <Money
            amount={available}
            currency={currency}
            size="lg"
            color={colors.gold}
          />

          <Pressable
            style={styles.walletButton}
            onPress={() =>
              navigation.navigate('Wallet')
            }
          >
            <Text style={styles.walletButtonText}>
              Ouvrir le Wallet →
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Détail par commande
          </Text>

          <Text style={styles.sectionSubtitle}>
            Les transactions de protection récentes.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingTransactions}>
            <Skeleton
              height={78}
              radius={radius.lg}
            />

            <Skeleton
              height={78}
              radius={radius.lg}
            />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="✓"
              title="Aucun fonds protégé"
              description="Les paiements liés à vos commandes apparaîtront ici lorsqu’ils seront protégés."
            />
          </View>
        ) : (
          <View style={styles.transactionList}>
            {transactions.map(
              (item, index) => (
                <TransactionItem
                  key={String(
                    item.id ?? index,
                  )}
                  item={item}
                  currency={currency}
                  navigation={navigation}
                />
              ),
            )}
          </View>
        )}
      </View>

      <Pressable
        style={styles.disputesButton}
        onPress={() =>
          navigation.navigate(
            'Disputes',
          )
        }
      >
        <View>
          <Text style={styles.disputesTitle}>
            Besoin d’aide ?
          </Text>

          <Text style={styles.disputesText}>
            Consultez vos litiges liés aux commandes.
          </Text>
        </View>

        <Text style={styles.disputesArrow}>
          →
        </Text>
      </Pressable>

      <Text style={styles.note}>
        Les montants affichés ici proviennent des données
        du service financier Livi. L’application ne simule
        aucune libération de fonds.
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

  header: {
    marginBottom: spacing[5],
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

  errorBox: {
    marginBottom: spacing[4],
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

  hero: {
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.dark,
  },

  protectedBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  protectedBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
  },

  heroLabel: {
    marginTop: spacing[5],
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  heroText: {
    marginTop: spacing[4],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.gray2,
  },

  activeOrders: {
    marginTop: spacing[3],
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.gold,
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

  steps: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[5],
  },

  step: {
    flexDirection: 'row',
    gap: spacing[3],
  },

  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepNumberText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  stepContent: {
    flex: 1,
  },

  stepTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  stepText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  balanceCard: {
    marginTop: spacing[5],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  balanceHeader: {
    marginBottom: spacing[3],
  },

  balanceTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  balanceSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  walletButton: {
    marginTop: spacing[4],
    minHeight: 44,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  walletButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  loadingTransactions: {
    gap: spacing[2],
  },

  transactionList: {
    gap: spacing[2],
  },

  transaction: {
    minHeight: 78,
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  transactionPressed: {
    opacity: 0.9,
  },

  transactionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  transactionIconText: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },

  transactionContent: {
    flex: 1,
  },

  transactionTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  transactionDate: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  transactionRight: {
    alignItems: 'flex-end',
    gap: spacing[1],
  },

  emptyWrapper: {
    minHeight: 250,
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  disputesButton: {
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  disputesTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  disputesText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  disputesArrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  note: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[2],
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.textMuted,
  },

  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  metricLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
