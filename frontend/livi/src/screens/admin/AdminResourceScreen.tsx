import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { normalizeCollection } from '../../features/admin/adminApi';
import type { AdminRecord } from '../../features/admin/types';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, périmètre admin) : ce composant générique
// sert 18 écrans admin différents (utilisateurs, commandes, vendeurs…),
// chacun avec sa propre forme de données — construire une présentation sur
// mesure pour chacun dépasse le périmètre de cette session (Niveau 3,
// priorité la plus basse de la mission). Amélioration ciblée et sûre pour
// les 18 à la fois : clés lisibles (underscore → espace) et dates ISO
// affichées en format local plutôt qu'en chaîne brute — sans changer la
// structure "aperçu générique des 5 premiers champs".
function formatValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString('fr-FR');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

type Props = { title: string; loader: () => Promise<unknown> };

export function AdminResourceScreen({ title, loader }: Props) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try { refresh ? setRefreshing(true) : setLoading(true); setError(null); setItems(normalizeCollection(await loader() as any)); }
    catch (e: any) { setError(e?.message ?? `Impossible de charger ${title}.`); }
    finally { setLoading(false); setRefreshing(false); }
  }, [loader, title]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(item, index) => String(item.id ?? index)}
      contentContainerStyle={items.length ? styles.list : styles.center}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      ListHeaderComponent={<Text style={styles.title}>{title}</Text>}
      ListEmptyComponent={<Text style={styles.muted}>Aucune donnée disponible.</Text>}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Text style={styles.id}>{item.id}</Text>
          {Object.entries(item).filter(([key]) => key !== 'id').slice(0, 5).map(([key, value]) => (
            <Text key={key} style={styles.row}>
              <Text style={styles.key}>{humanizeKey(key)}: </Text>
              {formatValue(value)}
            </Text>
          ))}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3] },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], backgroundColor: colors.dark },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary, marginBottom: spacing[4] },
  card: { padding: spacing[4] },
  id: { fontFamily: fonts.bodyBold, marginBottom: spacing[2], color: colors.gold },
  row: { color: colors.gray2, marginTop: 3, fontFamily: fonts.body, fontSize: fontSize.sm },
  key: { color: colors.textMuted },
  error: { color: colors.red, textAlign: 'center', fontFamily: fonts.body },
  muted: { color: colors.textMuted, fontFamily: fonts.body },
});
