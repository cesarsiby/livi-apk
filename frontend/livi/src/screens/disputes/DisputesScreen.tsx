import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { disputesApi, normalizeDisputes } from '../../features/disputes/disputesApi';
import type { Dispute } from '../../features/disputes/types';
import { Badge, Card } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

type Props = { navigation: any };

export function DisputesScreen({ navigation }: Props) {
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      setItems(normalizeDisputes(await disputesApi.list()));
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les litiges.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;
  if (error) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <Pressable onPress={() => load()}><Text style={styles.link}>Réessayer</Text></Pressable>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={items.length ? styles.list : styles.center}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListHeaderComponent={<Text style={styles.title}>Litiges</Text>}
      ListEmptyComponent={<Text style={styles.muted}>Aucun litige.</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate('DisputeDetails', { disputeId: item.id })}>
          <Card style={styles.card}>
            <Text style={styles.id}>#{item.id}</Text>
            <Text style={styles.row}>Commande : {item.order_id ?? '—'}</Text>
            <Text style={styles.row}>Motif : {item.reason ?? '—'}</Text>
            <Badge label={`Statut : ${item.status ?? '—'}`} variant="gold" />
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  list: { padding: spacing[4] },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], backgroundColor: colors.dark },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary, marginBottom: spacing[4] },
  card: { padding: spacing[4], marginBottom: spacing[3], gap: spacing[2] },
  id: { fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  row: { color: colors.gray2, fontFamily: fonts.body, fontSize: fontSize.sm },
  muted: { color: colors.textMuted, fontFamily: fonts.body },
  error: { color: colors.red, textAlign: 'center', marginBottom: spacing[3], fontFamily: fonts.body },
  link: { color: colors.gold, fontFamily: fonts.bodyBold },
});
