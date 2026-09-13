import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { liveApi, LiveShop } from '../../features/live/liveApi';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function LiveShopScreen({ route }: any) {
  const [id] = [route?.params?.liveId];
  const [item, setItem] = useState<LiveShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setItem(await liveApi.get(id)); }
      catch (e: any) { setError(e?.message ?? 'Impossible de charger le live.'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <View style={s.c}><ActivityIndicator color={colors.gold} /><Text style={s.white}>Chargement du live…</Text></View>;
  if (error || !item) return <View style={s.c}><Text style={s.white}>{error || 'Live indisponible.'}</Text></View>;

  return (
    <View style={s.c}>
      <View style={s.video}>
        <Text style={s.liveTag}>● LIVE</Text>
        <Text style={s.white}>Le lecteur vidéo natif doit être raccordé au flux backend.</Text>
      </View>
      <Text style={s.t}>{item.title || 'Live Shopping'}</Text>
      <Text style={s.meta}>{item.vendor_name || 'Vendeur'} · {item.viewer_count || 0} spectateurs</Text>
      {item.stream_url ? (
        <TouchableOpacity style={s.btn} onPress={() => Linking.openURL(item.stream_url!)}>
          <Text style={s.btnText}>Ouvrir le flux</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, padding: spacing[4], gap: spacing[3], backgroundColor: colors.dark },
  video: { height: 360, backgroundColor: colors.dark2, alignItems: 'center', justifyContent: 'center', gap: spacing[3], borderRadius: radius.xl },
  white: { color: colors.gray2, fontFamily: fonts.body },
  liveTag: { color: colors.red, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  t: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2 },
  btn: { backgroundColor: colors.gold, padding: spacing[4], borderRadius: radius.full, alignItems: 'center' },
  btnText: { color: colors.dark, fontFamily: fonts.bodyBold },
});
