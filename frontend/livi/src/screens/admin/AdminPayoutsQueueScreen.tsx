import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { adminApi } from '../../features/admin/adminApi';
import { Card, Button, Badge } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function AdminPayoutsQueueScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [providers, setProviders] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async (refresh = false) => {
    try { refresh ? setRefreshing(true) : setLoading(true); setError(null); setItems(await adminApi.payoutsPending()); }
    catch (e: any) { setError(e?.message ?? 'Impossible de charger la file de retraits.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: 'processing' | 'fail' | 'complete') {
    try {
      setBusyId(id);
      if (action === 'processing') await adminApi.payoutMarkProcessing(id);
      else if (action === 'fail') await adminApi.payoutFail(id, notes[id]);
      else await adminApi.payoutComplete(id, (providers[id] ?? '').trim(), (refs[id] ?? '').trim());
      await load(true);
    } catch (e: any) { setError(e?.message ?? 'Action impossible.'); }
    finally { setBusyId(null); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListHeaderComponent={<>
        <Text style={styles.title}>File de retraits</Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </>}
      ListEmptyComponent={<Text style={styles.muted}>Aucun retrait en attente.</Text>}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{item.phone ?? item.email ?? item.user_id}</Text>
            <Badge label={item.role} variant="blue" />
          </View>
          <Text style={styles.value}>{Number(item.net_amount ?? item.amount).toLocaleString('fr-FR')} XOF</Text>
          <Text style={styles.muted}>Vers {item.destination_ref} — demandé le {new Date(item.created_at).toLocaleString()}</Text>
          <TextInput
            value={providers[item.id] ?? ''}
            onChangeText={(text) => setProviders((current) => ({ ...current, [item.id]: text }))}
            placeholder="Opérateur (ex: Orange Money)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <TextInput
            value={refs[item.id] ?? ''}
            onChangeText={(text) => setRefs((current) => ({ ...current, [item.id]: text }))}
            placeholder="Référence de transaction partenaire"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <TextInput
            value={notes[item.id] ?? ''}
            onChangeText={(text) => setNotes((current) => ({ ...current, [item.id]: text }))}
            placeholder="Motif d'échec (si échec)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.actions}>
            <Button title="Marquer en cours" variant="secondary" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => act(item.id, 'processing')} />
            <Button title="Compléter" variant="green" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => act(item.id, 'complete')} />
            <Button title="Échec" variant="red" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => act(item.id, 'fail')} />
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  container: { padding: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, marginBottom: spacing[3], color: colors.textPrimary },
  card: { padding: spacing[4], marginBottom: spacing[3], gap: spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.textPrimary, fontFamily: fonts.bodyBold },
  value: { color: colors.gold, fontFamily: fonts.brandSemibold, fontSize: fontSize.lg },
  muted: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.sm },
  error: { color: colors.red, fontFamily: fonts.body, marginBottom: spacing[2] },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing[2], color: colors.textPrimary, fontFamily: fonts.body },
  actions: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
});
