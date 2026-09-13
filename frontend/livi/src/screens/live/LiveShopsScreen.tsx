import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { liveApi, LiveShop } from '../../features/live/liveApi';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function LiveShopsScreen({ navigation }: any) {
  const [items, setItems] = useState<LiveShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const d = await liveApi.active();
      setItems(Array.isArray(d) ? d : (d as any)?.items ?? []);
    } catch (e: any) { setError(e?.message ?? 'Erreur de chargement.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={s.c}><ActivityIndicator color={colors.gold} /><Text style={s.emptyText}>Chargement des lives…</Text></View>;

  return (
    <FlatList
      style={s.screen}
      data={items}
      keyExtractor={(x) => x.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />}
      ListEmptyComponent={<View style={s.c}><Text style={s.emptyText}>Aucun live actif.</Text></View>}
      renderItem={({ item }) => (
        <TouchableOpacity style={s.card} onPress={() => navigation.navigate('LiveShop', { liveId: item.id })}>
          {item.thumbnail_url ? <Image source={{ uri: item.thumbnail_url }} style={s.img} /> : <View style={s.img} />}
          <View style={s.p}>
            <Text style={s.live}>● LIVE · {item.viewer_count || 0} spectateurs</Text>
            <Text style={s.t}>{item.title || 'Live Shopping'}</Text>
            <Text style={s.meta}>{item.vendor_name || 'Vendeur'}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], backgroundColor: colors.dark },
  emptyText: { fontFamily: fonts.body, color: colors.textMuted },
  card: {
    margin: spacing[3],
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  img: { height: 200, width: '100%', backgroundColor: colors.dark2 },
  p: { padding: spacing[4], gap: 5 },
  live: { fontFamily: fonts.bodyBold, color: colors.red, fontSize: fontSize.sm },
  t: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
});
