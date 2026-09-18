import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { adminApi } from '../../features/admin/adminApi';
import { Card, Button, Badge, formatMoney } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

const CASE_STATUS_VARIANT: Record<string, 'gold' | 'green' | 'red' | 'gray'> = {
  open: 'gold', approved: 'green', rejected: 'red', executed: 'green',
};
// SESSION 26 (améliorations UX/UI) : Badge affichait la valeur technique
// brute (item.status, ex. "open"/"executed") directement à l'admin — même
// anti-motif que C8 (RAPPORT_UXUI_SESSION21_AUDIT.md), pas couvert par le
// registre StatusBadge partagé puisque ce statut de cas de réconciliation
// est propre à cet écran, pas un des domaines déjà enregistrés.
const CASE_STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert', approved: 'Approuvé', rejected: 'Rejeté', executed: 'Exécuté',
};

export function AdminReconciliationScreen() {
  const [runs, setRuns] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [expandedRun, setExpandedRun] = useState<{ run: any; items: any[] } | null>(null);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true); setError(null);
      const [r, c] = await Promise.all([adminApi.reconciliationRuns(), adminApi.correctionCases()]);
      setRuns(r); setCases(c);
    } catch (e: any) { setError(e?.message ?? 'Impossible de charger la réconciliation.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function toggleRun(run: any) {
    if (expandedRun?.run.id === run.id) { setExpandedRun(null); return; }
    try { setExpandingId(run.id); setExpandedRun(await adminApi.reconciliationRun(run.id)); }
    catch (e: any) { setError(e?.message ?? 'Impossible de charger ce cycle.'); }
    finally { setExpandingId(null); }
  }

  async function act(id: string, action: 'approve' | 'reject' | 'execute') {
    try {
      setBusyId(id);
      if (action === 'approve') await adminApi.approveCorrection(id, reasons[id]);
      else if (action === 'reject') await adminApi.rejectCorrection(id, reasons[id]);
      else await adminApi.executeCompensation(id);
      await load(true);
    } catch (e: any) { setError(e?.message ?? 'Action impossible.'); }
    finally { setBusyId(null); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}>
      <Text style={styles.title}>Réconciliation partenaire</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.heading}>Cycles ({runs.length})</Text>
      {runs.length === 0 && <Text style={styles.muted}>Aucun cycle de réconciliation.</Text>}
      {runs.map((run) => (
        <Pressable key={run.id} onPress={() => toggleRun(run)}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{run.provider} — {new Date(run.period_start).toLocaleDateString()} → {new Date(run.period_end).toLocaleDateString()}</Text>
              <Badge label={run.status} variant={run.status === 'completed' ? 'green' : 'gold'} />
            </View>
            {expandingId === run.id && <ActivityIndicator color={colors.gold} />}
            {expandedRun?.run.id === run.id && (
              <View style={styles.subList}>
                {expandedRun.items.length === 0 && <Text style={styles.muted}>Aucun écart.</Text>}
                {expandedRun.items.map((item) => (
                  <View key={item.id} style={styles.subItem}>
                    <Text style={styles.body}>{item.discrepancy_type} — réf. {item.payment_reference ?? item.external_event_id}</Text>
                    <Text style={styles.muted}>LIVI: {item.expected_amount ?? '—'} / Partenaire: {item.provider_amount ?? '—'} {item.currency}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Pressable>
      ))}

      <Text style={styles.heading}>Dossiers de correction ({cases.length})</Text>
      {cases.length === 0 && <Text style={styles.muted}>Aucun dossier.</Text>}
      {cases.map((item) => (
        <Card key={item.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{item.case_type}</Text>
            <Badge label={CASE_STATUS_LABEL[item.status] ?? item.status} variant={CASE_STATUS_VARIANT[item.status] ?? 'gray'} />
          </View>
          <Text style={styles.body}>{item.reason}</Text>
          {item.proposed_amount != null && <Text style={styles.muted}>Montant proposé : {formatMoney(item.proposed_amount, 'XOF')}</Text>}
          {item.status === 'open' && (
            <>
              <TextInput
                value={reasons[item.id] ?? ''}
                onChangeText={(text) => setReasons((current) => ({ ...current, [item.id]: text }))}
                placeholder="Note (approbation ou rejet)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <View style={styles.actions}>
                <Button title="Approuver" variant="green" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => act(item.id, 'approve')} />
                <Button title="Rejeter" variant="red" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => act(item.id, 'reject')} />
              </View>
            </>
          )}
          {item.status === 'approved' && (
            <Button title="Exécuter la compensation client" variant="blue" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => act(item.id, 'execute')} />
          )}
        </Card>
      ))}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  name: { color: colors.textPrimary, fontFamily: fonts.bodyBold, flexShrink: 1 },
  body: { color: colors.gray2, fontFamily: fonts.body },
  muted: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.sm },
  error: { color: colors.red, fontFamily: fonts.body, marginBottom: spacing[2] },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing[2], color: colors.textPrimary, fontFamily: fonts.body },
  actions: { flexDirection: 'row', gap: spacing[2] },
  subList: { marginTop: spacing[2], gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[2] },
  subItem: { gap: 2 },
});
