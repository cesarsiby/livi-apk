import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { sellerApi } from '../../features/seller/sellerApi';
import {
  Button,
  Card,
  EmptyState,
  SectionHeader,
  Skeleton,
  StatusBadge,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

function formatXof(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';

  const number = Number(value);
  if (!Number.isFinite(number)) return '—';

  return `${number.toLocaleString('fr-FR')} FCFA`;
}

export function PayoutsScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      setData(await sellerApi.payouts());
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les versements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const payouts = Array.isArray(data?.payouts) ? data.payouts : [];
  const availableBalance = data?.available_balance;

  const numericAmount = useMemo(() => {
    if (!amount.trim()) return null;
    const parsed = Number(amount.replace(/\s/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }, [amount]);

  const canSubmit =
    !busy &&
    numericAmount !== null &&
    numericAmount > 0 &&
    destination.trim().length >= 3;

  const requestPayout = useCallback(async () => {
    if (!canSubmit || numericAmount === null) return;

    setBusy(true);
    setError('');

    try {
      const result = await sellerApi.requestPayout({
        amount: numericAmount,
        destination_ref: destination.trim(),
      });

      setAmount('');
      setDestination('');
      await load();

      if (result?.message) {
        setError(result.message);
      }
    } catch (e: any) {
      setError(e?.message ?? 'La demande de versement a échoué.');
    } finally {
      setBusy(false);
    }
  }, [canSubmit, destination, load, numericAmount]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingHeader}>
          <Skeleton width={120} height={14} radius={radius.pill} />
          <Skeleton width={245} height={34} radius={radius.md} />
          <Skeleton width={290} height={18} radius={radius.md} />
        </View>

        <Skeleton width="100%" height={150} radius={radius.lg} />
        <Skeleton width={150} height={22} radius={radius.md} />
        <Skeleton width="100%" height={120} radius={radius.lg} />
        <Skeleton width="100%" height={92} radius={radius.lg} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FINANCES VENDEUR</Text>
          <Text style={styles.title}>Versements</Text>
          <Text style={styles.subtitle}>
            Consultez votre solde disponible et envoyez une demande de
            versement vers la destination enregistrée.
          </Text>
        </View>

        {error ? (
          <Card style={styles.notice}>
            <View style={styles.noticeIndicator} />
            <View style={styles.noticeBody}>
              <Text style={styles.noticeTitle}>Information</Text>
              <Text style={styles.noticeText}>{error}</Text>
            </View>
            <Pressable onPress={() => setError('')} hitSlop={10}>
              <Text style={styles.dismiss}>Fermer</Text>
            </Pressable>
          </Card>
        ) : null}

        <Card style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>Solde disponible</Text>
              <Text style={styles.balanceHint}>Montant actuellement proposé au versement</Text>
            </View>
            <View style={styles.balanceMark}>
              <Text style={styles.balanceMarkText}>₣</Text>
            </View>
          </View>

          <Text style={styles.balanceValue}>{formatXof(availableBalance)}</Text>

          <View style={styles.balanceFooter}>
            <View style={styles.balanceLine} />
            <Text style={styles.balanceFooterText}>LIVI · Versements</Text>
          </View>
        </Card>

        <View style={styles.formSection}>
          <SectionHeader
            title="Demander un versement"
            subtitle="Saisissez uniquement les informations nécessaires à la demande."
          />

          <Card padded style={styles.formCard}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Montant</Text>
              <View style={styles.inputShell}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="number-pad"
                  placeholder="Ex. 25000"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  accessibilityLabel="Montant du versement"
                />
                <Text style={styles.suffix}>FCFA</Text>
              </View>
              <Text style={styles.helper}>
                Le montant est converti en XOF par le service de versement.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Identifiant de destination</Text>
              <TextInput
                value={destination}
                onChangeText={setDestination}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Identifiant de destination"
                placeholderTextColor={colors.textMuted}
                style={styles.inputStandalone}
                accessibilityLabel="Identifiant de destination"
              />
              <Text style={styles.helper}>
                Utilisez la référence attendue par votre service de paiement.
              </Text>
            </View>

            <Button
              title={busy ? 'Envoi…' : 'Demander le versement'}
              onPress={requestPayout}
              disabled={!canSubmit}
              loading={busy}
              fullWidth
              size="lg"
            />
          </Card>
        </View>

        <View style={styles.historySection}>
          <SectionHeader
            title="Historique"
            subtitle={
              payouts.length === 0
                ? 'Les demandes effectuées apparaîtront ici.'
                : `${payouts.length} demande${payouts.length > 1 ? 's' : ''}`
            }
          />

          {payouts.length === 0 ? (
            <EmptyState
              icon="↗"
              title="Aucun versement"
              description="Votre historique restera vide tant qu'aucune demande de versement n'a été enregistrée."
            />
          ) : (
            <View style={styles.historyList}>
              {payouts.map((item: any, index: number) => {
                const id = item?.id ? String(item.id) : '';
                const label =
                  item?.label ??
                  item?.reference ??
                  item?.name ??
                  `Versement ${index + 1}`;

                return (
                  <Pressable
                    key={id || `${label}-${index}`}
                    disabled={!id}
                    onPress={() =>
                      id &&
                      navigation.navigate('WithdrawalDetails', {
                        withdrawalId: id,
                      })
                    }
                    style={({ pressed }) => [
                      styles.rowPressable,
                      pressed && id ? styles.rowPressed : null,
                    ]}
                  >
                    <Card style={styles.historyCard}>
                      <View style={styles.historyIcon}>
                        <Text style={styles.historyIconText}>↗</Text>
                      </View>

                      <View style={styles.historyMain}>
                        <Text style={styles.historyTitle} numberOfLines={1}>
                          {label}
                        </Text>

                        <View style={styles.statusLine}>
                          <StatusBadge
                            domain="generic"
                            status={item?.status ?? undefined}
                          />
                          {item?.created_at ? (
                            <Text style={styles.date}>
                              {String(item.created_at).slice(0, 10)}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.historyRight}>
                        <Text style={styles.historyAmount}>
                          {formatXof(item?.amount ?? item?.amount_xof)}
                        </Text>
                        {id ? <Text style={styles.chevron}>›</Text> : null}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <Text style={styles.disclaimer}>
          Les données affichées proviennent des services de versement et de
          solde du compte vendeur.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: spacing[5],
    gap: spacing[4],
  },
  loadingHeader: {
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[5],
  },
  header: {
    gap: spacing[2],
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.15,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
  },
  subtitle: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    maxWidth: 360,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(232, 184, 75, 0.28)',
    backgroundColor: 'rgba(232, 184, 75, 0.07)',
  },
  noticeIndicator: {
    width: 8,
    height: 8,
    marginTop: 5,
    borderRadius: 4,
    backgroundColor: colors.gold2,
  },
  noticeBody: {
    flex: 1,
    gap: spacing[1],
  },
  noticeTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  noticeText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  dismiss: {
    color: colors.gold2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  balanceCard: {
    padding: spacing[5],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.34)',
    backgroundColor: 'rgba(201, 151, 28, 0.085)',
    gap: spacing[4],
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  balanceLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  balanceHint: {
    marginTop: 3,
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    maxWidth: 260,
  },
  balanceMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.24)',
  },
  balanceMarkText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 24,
  },
  balanceValue: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['4xl'],
    lineHeight: 44,
  },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  balanceLine: {
    width: 32,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.gold,
  },
  balanceFooterText: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  formSection: {
    gap: spacing[3],
  },
  formCard: {
    gap: spacing[5],
  },
  fieldGroup: {
    gap: spacing[2],
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  inputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.dark4,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
  },
  suffix: {
    paddingRight: spacing[4],
    color: colors.gray2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  inputStandalone: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
  },
  helper: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  historySection: {
    gap: spacing[3],
  },
  historyList: {
    gap: spacing[3],
  },
  rowPressable: {
    borderRadius: radius.lg,
  },
  rowPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.992 }],
  },
  historyCard: {
    minHeight: 84,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyIconText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 20,
  },
  historyMain: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  historyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  date: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  historyRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing[1],
    maxWidth: 125,
  },
  historyAmount: {
    color: colors.gold2,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    textAlign: 'right',
  },
  chevron: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 24,
    lineHeight: 20,
  },
  disclaimer: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing[3],
  },
});
