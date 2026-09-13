import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { socialApi, FeedItem } from '../../features/social/socialApi';
import { VideoPlayer } from '../../design/components';
import { resolveMediaUrl } from '../../services/api/media';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function FeedScreen({ navigation }: any) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [commenting, setCommenting] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await socialApi.feed({ limit: 20 });
      setItems(Array.isArray(data) ? data : (data as any)?.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger le feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleLike = async (item: FeedItem) => {
    try {
      if (item.liked) await socialApi.unlike(item.type || 'video', item.id);
      else await socialApi.like(item.type || 'video', item.id);
      setItems((v) => v.map((x) => x.id === item.id ? { ...x, liked: !x.liked, likes_count: Math.max(0, (x.likes_count || 0) + (x.liked ? -1 : 1)) } : x));
    } catch (e) {}
  };

  const submitComment = async (item: FeedItem) => {
    if (!comment.trim()) return;
    try {
      await socialApi.comment(item.type || 'video', item.id, comment.trim());
      setComment('');
      setCommenting(null);
      setItems((v) => v.map((x) => x.id === item.id ? { ...x, comments_count: (x.comments_count || 0) + 1 } : x));
    } catch (e: any) {
      Alert.alert('Commentaire', e?.message ?? "Impossible d'envoyer le commentaire.");
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.gold} />
        <Text style={s.loadingText}>Chargement du feed…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error}</Text>
        <TouchableOpacity style={s.btn} onPress={load}><Text style={s.btnText}>Réessayer</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={s.screen}
      data={items}
      keyExtractor={(x) => x.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />}
      ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>Aucun contenu disponible.</Text></View>}
      ListHeaderComponent={
        <TouchableOpacity style={s.liveBanner} onPress={() => navigation.navigate('LiveShops')}>
          <Text style={s.liveBannerText}>🔴 Live Shopping — voir les lives en cours</Text>
        </TouchableOpacity>
      }
      renderItem={({ item }) => (
        <View style={s.card}>
          {/* V54: real in-app playback (expo-video) replaces the static
              thumbnail + "open externally" link — see design/components/
              VideoPlayer.tsx. Falls back to the thumbnail for posts that
              genuinely have no video (image-only content). */}
          {item.video_url ? (
            <VideoPlayer uri={resolveMediaUrl(item.video_url)!} style={s.poster} />
          ) : item.thumbnail_url || item.poster_url ? (
            <Image source={{ uri: resolveMediaUrl(item.thumbnail_url || item.poster_url) }} style={s.poster} />
          ) : (
            <View style={s.posterPlaceholder}><Text style={s.posterPlaceholderText}>VIDÉO</Text></View>
          )}
          <View style={s.body}>
            <Text style={s.vendor}>{item.vendor_name || 'Vendeur'}</Text>
            <Text style={s.title}>{item.title || 'Contenu LIVI'}</Text>
            {item.description ? <Text numberOfLines={3} style={s.description}>{item.description}</Text> : null}

            <View style={s.actions}>
              <TouchableOpacity onPress={() => toggleLike(item)}>
                <Text style={s.actionText}>{item.liked ? '♥' : '♡'} {item.likes_count || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCommenting(commenting === item.id ? null : item.id)}>
                <Text style={s.actionText}>💬 {item.comments_count || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => { try { await socialApi.share(item.type || 'video', item.id); await Share.share({ message: item.video_url || item.title || 'LIVI' }); } catch (e) {} }}>
                <Text style={s.actionText}>↗ {item.shares_count || 0}</Text>
              </TouchableOpacity>
            </View>

            {item.product_id ? (
              <TouchableOpacity style={s.product} onPress={() => navigation.navigate('Product', { productId: item.product_id })}>
                <Text style={s.productName}>{item.product_name || 'Voir le produit'}</Text>
                {item.product_price != null ? <Text style={s.productPrice}>{item.product_price} FCFA</Text> : null}
              </TouchableOpacity>
            ) : null}

            {commenting === item.id ? (
              <View style={{ gap: spacing[2] }}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Votre commentaire…"
                  placeholderTextColor={colors.textMuted}
                  style={s.input}
                />
                <TouchableOpacity style={s.btn} onPress={() => submitComment(item)}>
                  <Text style={s.btnText}>Publier</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3], backgroundColor: colors.dark },
  loadingText: { fontFamily: fonts.body, color: colors.textMuted },
  error: { textAlign: 'center', fontFamily: fonts.body, color: colors.red },
  emptyText: { fontFamily: fonts.body, color: colors.textMuted },
  liveBanner: {
    margin: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.red,
    alignItems: 'center',
  },
  liveBannerText: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: fontSize.sm },
  card: {
    margin: spacing[3],
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  poster: { width: '100%', height: 360, backgroundColor: colors.dark2 },
  posterPlaceholder: { height: 360, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark2 },
  posterPlaceholderText: { color: colors.textMuted, fontFamily: fonts.bodySemibold, letterSpacing: 2 },
  body: { padding: spacing[4], gap: spacing[2] },
  vendor: { fontFamily: fonts.bodySemibold, color: colors.gold },
  title: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  description: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2] },
  actionText: { fontFamily: fonts.bodyMedium, color: colors.gray2 },
  product: { padding: spacing[3], borderRadius: radius.md, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.goldBorder },
  productName: { fontFamily: fonts.bodySemibold, color: colors.gold },
  productPrice: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], color: colors.textPrimary, fontFamily: fonts.body, backgroundColor: colors.dark4 },
  btn: { backgroundColor: colors.gold, padding: spacing[3], borderRadius: radius.full, alignItems: 'center' },
  btnText: { color: colors.dark, fontFamily: fonts.bodyBold },
});
