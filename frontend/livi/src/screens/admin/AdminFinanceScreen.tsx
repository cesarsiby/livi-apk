import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { adminApi } from '../../features/admin/adminApi';
import { Card, Button } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function AdminFinanceScreen() {
  const [summary, setSummary] = useState<{ code: string; name: string; balance: string }[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ruleName, setRuleName] = useState('');
  const [ruleBps, setRuleBps] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  const [refundOrderId, setRefundOrderId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true); setError(null);
      const [s, r] = await Promise.all([adminApi.financeSummary(), adminApi.feeRules()]);
      setSummary(s); setRules(r);
    } catch (e: any) { setError(e?.message ?? 'Impossible de charger les données financières.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function saveRule() {
    const bps = parseInt(ruleBps, 10);
    if (!ruleName.trim() || !Number.isFinite(bps) || bps < 0 || bps > 10000) { setActionMessage('Nom requis, commission entre 0 et 10000 (points de base).'); return; }
    try { setSavingRule(true); setActionMessage(null); await adminApi.setFeeRule(ruleName.trim(), bps); setRuleName(''); setRuleBps(''); await load(); }
    catch (e: any) { setActionMessage(e?.message ?? 'Impossible de créer la règle.'); }
    finally { setSavingRule(false); }
  }

  async function submitRefund() {
    if (!refundOrderId.trim()) { setActionMessage('Identifiant de commande requis.'); return; }
    try { setRefunding(true); setActionMessage(null); await adminApi.refundOrder(refundOrderId.trim(), refundReason.trim() || undefined); setActionMessage(`Commande ${refundOrderId.trim()} remboursée.`); setRefundOrderId(''); setRefundReason(''); }
    catch (e: any) { setActionMessage(e?.message ?? 'Remboursement impossible.'); }
    finally { setRefunding(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}>
      <Text style={styles.title}>Finance</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {actionMessage && <Text style={styles.info}>{actionMessage}</Text>}

      <Text style={styles.heading}>Soldes de la plateforme</Text>
      {summary.map((row) => (
        <Card key={row.code} style={styles.card}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.value}>{Number(row.balance).toLocaleString('fr-FR')} XOF</Text>
        </Card>
      ))}

      <Text style={styles.heading}>Règle de commission active</Text>
      {rules.filter((rule) => rule.active).map((rule) => (
        <Card key={rule.id} style={styles.card}>
          <Text style={styles.name}>{rule.name}</Text>
          <Text style={styles.muted}>{(rule.commission_bps / 100).toFixed(2)}%</Text>
        </Card>
      ))}
      <Card style={styles.card}>
        <TextInput value={ruleName} onChangeText={setRuleName} placeholder="Nom de la nouvelle règle" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={ruleBps} onChangeText={setRuleBps} placeholder="Commission (points de base, ex: 500 = 5%)" placeholderTextColor={colors.textMuted} keyboardType="number-pad" style={styles.input} />
        <Button title={savingRule ? '…' : 'Activer cette règle'} disabled={savingRule} loading={savingRule} onPress={saveRule} fullWidth />
      </Card>

      <Text style={styles.heading}>Remboursement manuel</Text>
      <Card style={styles.card}>
        <TextInput value={refundOrderId} onChangeText={setRefundOrderId} placeholder="ID de la commande" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={refundReason} onChangeText={setRefundReason} placeholder="Motif" placeholderTextColor={colors.textMuted} style={styles.input} />
        <Button title={refunding ? '…' : 'Rembourser la commande'} variant="red" disabled={refunding} loading={refunding} onPress={submitRefund} fullWidth />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  container: { padding: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, marginBottom: spacing[3], color: colors.textPrimary },
  heading: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: fontSize.md, marginTop: spacing[4], marginBottom: spacing[2] },
  card: { padding: spacing[4], marginBottom: spacing[3], gap: spacing[2] },
  name: { color: colors.textPrimary, fontFamily: fonts.bodyBold },
  value: { color: colors.gold, fontFamily: fonts.brandSemibold, fontSize: fontSize.lg },
  muted: { color: colors.textMuted, fontFamily: fonts.body },
  error: { color: colors.red, fontFamily: fonts.body, marginBottom: spacing[2] },
  info: { color: colors.gold, fontFamily: fonts.body, marginBottom: spacing[2] },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing[3], color: colors.textPrimary, fontFamily: fonts.body },
});
