import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { liveApi, VendorVideo } from '../../features/live/liveApi';
import { Button, Card } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function VideoManagerScreen({ navigation }: any) {
  const [items, setItems] = useState<VendorVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await liveApi.vendorVideos();
      setItems(Array.isArray(d) ? d : (d as any)?.items ?? []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={s.c}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <FlatList
      style={s.screen}
      data={items}
      keyExtractor={(x) => x.id}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />}
      ListEmptyComponent={
        <View style={s.c}>
          <Text style={s.empty}>Aucune vidéo.</Text>
          <Button title="Uploader une vidéo" onPress={() => navigation.navigate('VideoUpload')} />
        </View>
      }
      renderItem={({ item }) => (
        <Card style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.t}>{item.title || 'Sans titre'}</Text>
            <Text style={s.meta}>{item.status || '—'} · {item.views || 0} vues</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('VideoAnalytics', { videoId: item.id })}>
            <Text style={s.link}>Analytics</Text>
          </Pressable>
        </Card>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3], backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3] },
  row: { padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  t: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  link: { color: colors.gold, fontFamily: fonts.bodyBold },
  empty: { color: colors.textMuted, fontFamily: fonts.body },
});
