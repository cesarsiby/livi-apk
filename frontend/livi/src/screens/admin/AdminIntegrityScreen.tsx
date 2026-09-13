import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { adminApi } from '../../features/admin/adminApi';
import { Card, Badge, Button } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function AdminIntegrityScreen() {
  const [data, setData] = useState<{ ok: boolean; ledger_unbalanced: any[]; escrow_inconsistencies: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try { refresh ? setRefreshing(true) : setLoading(true); setError(null); setData(await adminApi.getIntegrity()); }
    catch (e: any) { setError(e?.message ?? "Impossible de lancer le contrôle d'intégrité."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text><Button title="Réessayer" onPress={() => load()} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}>
      <Text style={styles.title}>Intégrité comptable</Text>
      <Card style={styles.statusCard} padded>
        <Badge label={data?.ok ? 'OK — aucune anomalie' : 'Anomalies détectées'} variant={data?.ok ? 'green' : 'red'} />
      </Card>

      <Text style={styles.heading}>Grand livre déséquilibré ({data?.ledger_unbalanced.length ?? 0})</Text>
      {(data?.ledger_unbalanced.length ?? 0) === 0 ? (
        <Text style={styles.muted}>Rien à signaler.</Text>
      ) : data?.ledger_unbalanced.map((row, i) => (
        <Card key={i} style={styles.card}><Text style={styles.body}>{JSON.stringify(row)}</Text></Card>
      ))}

      <Text style={styles.heading}>Incohérences escrow ({data?.escrow_inconsistencies.length ?? 0})</Text>
      {(data?.escrow_inconsistencies.length ?? 0) === 0 ? (
        <Text style={styles.muted}>Rien à signaler.</Text>
      ) : data?.escrow_inconsistencies.map((row, i) => (
        <Card key={i} style={styles.card}><Text style={styles.body}>{JSON.stringify(row)}</Text></Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  container: { padding: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], backgroundColor: colors.dark },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, marginBottom: spacing[3], color: colors.textPrimary },
  statusCard: { marginBottom: spacing[5] },
  heading: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: fontSize.md, marginTop: spacing[3], marginBottom: spacing[2] },
  card: { padding: spacing[3], marginBottom: spacing[2] },
  body: { color: colors.gray2, fontFamily: fonts.body, fontSize: fontSize.sm },
  muted: { color: colors.textMuted, fontFamily: fonts.body },
  error: { color: colors.red, fontFamily: fonts.body },
});
