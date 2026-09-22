import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';

import { adminApi } from '../../features/admin/adminApi';
import { Card, Button, Money, SectionHeader, Skeleton, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

function formatBps(value: unknown) {
  const bps = Number(value);
  if (!Number.isFinite(bps)) return '—';
  return `${(bps / 100).toFixed(2)} %`;
}

export function AdminFinanceScreen() {
  const [summary, setSummary] = useState<{ code: string; name: string; balance: string }[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [ruleName, setRuleName] = useState('');
  const [ruleBps, setRuleBps] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  const [refundOrderId, setRefundOrderId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'info' | 'error'>('info');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setMessage('');

    try {
      const [financeSummary, feeRules] = await Promise.all([
        adminApi.financeSummary(),
        adminApi.feeRules(),
      ]);

      setSummary(financeSummary ?? []);
      setRules(feeRules ?? []);
    } catch (e: any) {
      setMessage(e?.message ?? 'Impossible de charger les données financières.');
      setMessageKind('error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRules = useMemo(
    () => rules.filter((rule) => rule?.active),
    [rules],
  );

  const saveRule = useCallback(async () => {
    const name = ruleName.trim();
    const bps = Number.parseInt(ruleBps.trim(), 10);

    if (!name) {
      setMessage('Le nom de la règle est obligatoire.');
      setMessageKind('error');
      return;
    }

    if (!Number.isFinite(bps) || bps < 0 || bps > 10000) {
      setMessage('La commission doit être comprise entre 0 et 10 000 points de base.');
      setMessageKind('error');
      return;
    }

    setSavingRule(true);
    setMessage('');

    try {
      await adminApi.setFeeRule(name, bps);
      setRuleName('');
      setRuleBps('');
      setMessage('La règle a été enregistrée.');
      setMessageKind('info');
      await load();
    } catch (e: any) {
      setMessage(e?.message ?? 'Impossible de créer la règle.');
      setMessageKind('error');
    } finally {
      setSavingRule(false);
    }
  }, [load, ruleBps, ruleName]);

  const submitRefund = useCallback(async () => {
    const orderId = refundOrderId.trim();

    if (!orderId) {
      setMessage('L’identifiant de commande est obligatoire.');
      setMessageKind('error');
      return;
    }

    setRefunding(true);
    setMessage('');

    try {
      await adminApi.refundOrder(orderId, refundReason.trim() || undefined);
      setMessage(`Demande de remboursement envoyée pour la commande ${orderId}.`);
      setMessageKind('info');
      setRefundOrderId('');
      setRefundReason('');
    } catch (e: any) {
      setMessage(e?.message ?? 'Le remboursement est impossible.');
      setMessageKind('error');
    } finally {
      setRefunding(false);
    }
  }, [refundOrderId, refundReason]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={90} height={14} radius={radius.pill} />
        <Skeleton width={180} height={34} radius={radius.md} />
        <Skeleton width="100%" height={118} radius={radius.lg} />
        <Skeleton width="100%" height={84} radius={radius.lg} />
        <Skeleton width="100%" height={84} radius={radius.lg} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONTRÔLE FINANCIER</Text>
        <Text style={styles.title}>Finance</Text>
        <Text style={styles.subtitle}>
          Consultez les soldes, la commission active et les outils financiers
          disponibles pour l’administration.
        </Text>
      </View>

      {message ? (
        <Card
          style={[
            styles.messageCard,
            messageKind === 'error' ? styles.messageError : styles.messageInfo,
          ]}
        >
          <View
            style={[
              styles.messageDot,
              messageKind === 'error' ? styles.messageDotError : styles.messageDotInfo,
            ]}
          />
          <Text style={styles.messageText}>{message}</Text>
          <Pressable onPress={() => setMessage('')} hitSlop={10}>
            <Text style={styles.dismiss}>Fermer</Text>
          </Pressable>
        </Card>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Soldes de la plateforme"
          subtitle={`${summary.length} compte${summary.length > 1 ? 's' : ''} retourné${summary.length > 1 ? 's' : ''} par le service financier.`}
        />

        {summary.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun solde</Text>
            <Text style={styles.emptyText}>
              Le service financier n’a retourné aucun compte pour le moment.
            </Text>
          </Card>
        ) : (
          <View style={styles.balanceList}>
            {summary.map((row) => (
              <Card key={row.code} style={styles.balanceCard}>
                <View style={styles.balanceIcon}>
                  <Text style={styles.balanceIconText}>₣</Text>
                </View>

                <View style={styles.balanceMain}>
                  <Text style={styles.balanceName}>{row.name}</Text>
                  <Text style={styles.balanceCode}>{row.code}</Text>
                </View>

                <Money
                  amount={row.balance}
                  currency="XOF"
                  size="lg"
                  style={styles.balanceValue}
                />
              </Card>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Commission"
          subtitle="Seules les règles marquées comme actives sont présentées ci-dessous."
        />

        {activeRules.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucune règle active</Text>
            <Text style={styles.emptyText}>
              Le service financier n’a retourné aucune règle active.
            </Text>
          </Card>
        ) : (
          <View style={styles.rulesList}>
            {activeRules.map((rule, index) => (
              <Card key={String(rule?.id ?? index)} style={styles.ruleCard}>
                <View style={styles.ruleMain}>
                  <Text style={styles.ruleName}>
                    {rule?.name ?? 'Règle de commission'}
                  </Text>
                  <StatusBadge domain="generic" status={rule?.active ? 'active' : 'inactive'} />
                </View>
                <Text style={styles.ruleValue}>
                  {formatBps(rule?.commission_bps)}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <Card padded style={styles.formCard}>
          <Text style={styles.formTitle}>Nouvelle règle</Text>
          <Text style={styles.formHint}>
            La valeur de commission est saisie en points de base.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nom</Text>
            <TextInput
              value={ruleName}
              onChangeText={setRuleName}
              placeholder="Nom de la règle"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="sentences"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Commission (points de base)</Text>
            <TextInput
              value={ruleBps}
              onChangeText={setRuleBps}
              placeholder="Ex. 500"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          <Button
            title={savingRule ? 'Enregistrement…' : 'Enregistrer la règle'}
            onPress={saveRule}
            disabled={savingRule}
            loading={savingRule}
            fullWidth
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Remboursement manuel"
          subtitle="Cette action utilise directement le service financier d’administration."
        />

        <Card padded style={styles.formCard}>
          <View style={styles.warningStrip}>
            <Text style={styles.warningText}>
              Vérifiez l’identifiant de commande et le motif avant validation.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Identifiant de commande</Text>
            <TextInput
              value={refundOrderId}
              onChangeText={setRefundOrderId}
              placeholder="ID de la commande"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Motif</Text>
            <TextInput
              value={refundReason}
              onChangeText={setRefundReason}
              placeholder="Motif du remboursement"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.textArea]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Button
            title={refunding ? 'Remboursement…' : 'Rembourser la commande'}
            variant="red"
            onPress={submitRefund}
            disabled={refunding}
            loading={refunding}
            fullWidth
          />
        </Card>
      </View>

      <Text style={styles.footerNote}>
        Les montants, règles et résultats d’action sont fournis par les
        services financiers du backend.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: spacing[5],
    gap: spacing[4],
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[6],
  },
  header: {
    gap: spacing[2],
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
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
    maxWidth: 370,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1,
  },
  messageInfo: {
    backgroundColor: 'rgba(201, 151, 28, 0.07)',
    borderColor: 'rgba(201, 151, 28, 0.24)',
  },
  messageError: {
    backgroundColor: 'rgba(255, 94, 94, 0.07)',
    borderColor: 'rgba(255, 94, 94, 0.25)',
  },
  messageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  messageDotInfo: {
    backgroundColor: colors.gold,
  },
  messageDotError: {
    backgroundColor: colors.red,
  },
  messageText: {
    flex: 1,
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
  section: {
    gap: spacing[3],
  },
  balanceList: {
    gap: spacing[3],
  },
  balanceCard: {
    minHeight: 82,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  balanceIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.22)',
  },
  balanceIconText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 22,
  },
  balanceMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  balanceName: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  balanceCode: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  balanceValue: {
    color: colors.gold2,
    fontFamily: fonts.brandSemibold,
  },
  emptyCard: {
    padding: spacing[5],
    gap: spacing[2],
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  emptyText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  rulesList: {
    gap: spacing[3],
  },
  ruleCard: {
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  ruleMain: {
    flex: 1,
    gap: spacing[2],
  },
  ruleName: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  ruleValue: {
    color: colors.gold2,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
  },
  formCard: {
    gap: spacing[4],
  },
  formTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  formHint: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  fieldGroup: {
    gap: spacing[2],
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },
  textArea: {
    minHeight: 110,
    paddingTop: spacing[4],
  },
  warningStrip: {
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  footerNote: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing[3],
  },
});
