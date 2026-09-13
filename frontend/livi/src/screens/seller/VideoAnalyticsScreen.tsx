import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { liveApi } from '../../features/live/liveApi';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function VideoAnalyticsScreen({ route }: any) {
  const [id] = [route?.params?.videoId];
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setD(await liveApi.videoAnalytics(id)); }
      catch (e: any) { setError(e?.message ?? 'Erreur analytics.'); }
    })();
  }, [id]);

  if (!d && !error) return <View style={s.c}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <View style={s.c}>
      <Text style={s.h}>Analytics vidéo</Text>
      {error ? <Text style={s.error}>{error}</Text> : (
        <Card style={s.card}>
          {Object.entries(d || {}).map(([k, v]) => (
            <View style={s.row} key={k}>
              <Text style={s.key}>{k}</Text>
              <Text style={s.value}>{String(v)}</Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, padding: spacing[4], gap: spacing[3], backgroundColor: colors.dark },
  h: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  card: { padding: spacing[4] },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.border },
  key: { fontFamily: fonts.body, color: colors.gray2 },
  value: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  error: { color: colors.red, fontFamily: fonts.body },
});
