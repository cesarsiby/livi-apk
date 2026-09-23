import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { liveApi, type VendorVideo } from '../../features/live/liveApi';
import { Button, Card, EmptyState, SectionHeader, Skeleton, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

function count(value?: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('fr-FR') : '0';
}

function date(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function VideoManagerScreen({ navigation }: any) {
  const [items, setItems] = useState<VendorVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const result = await liveApi.vendorVideos();
      setItems(Array.isArray(result) ? result : Array.isArray((result as any)?.items) ? (result as any).items : []);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger vos vidéos.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalViews = useMemo(
    () => items.reduce((sum, item) => sum + (Number.isFinite(Number(item.views)) ? Number(item.views) : 0), 0),
    [items],
  );
  const totalSales = useMemo(
    () => items.reduce((sum, item) => sum + (Number.isFinite(Number(item.sales)) ? Number(item.sales) : 0), 0),
    [items],
  );

  const remove = useCallback((item: VendorVideo) => {
    Alert.alert(
      'Supprimer la vidéo',
      `Supprimer « ${item.title?.trim() || 'Sans titre'} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id); setError('');
            try {
              await liveApi.deleteVideo(item.id);
              setItems(current => current.filter(video => video.id !== item.id));
            } catch (e: any) {
              setError(e?.message ?? 'Impossible de supprimer cette vidéo.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width={125} height={14} radius={radius.pill} />
        <Skeleton width={230} height={34} radius={radius.md} />
        <Skeleton width="100%" height={82} radius={radius.lg} />
        <Skeleton width="100%" height={110} radius={radius.lg} />
        <Skeleton width="100%" height={110} radius={radius.lg} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.id ?? index)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, items.length === 0 && styles.emptyContent]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>CONTENU VIDÉO</Text>
            <Text style={styles.title}>Mes vidéos</Text>
            <Text style={styles.subtitle}>
              Gérez vos contenus vidéo et ouvrez les statistiques de chaque publication.
            </Text>
            <Button title="Uploader une vidéo" onPress={() => navigation.navigate('VideoUpload')} fullWidth size="lg" />

            {error ? (
              <Card style={styles.errorCard}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            ) : null}

            {items.length > 0 ? (
              <>
                <View style={styles.overview}>
                  <View style={styles.metric}><Text style={styles.metricValue}>{count(items.length)}</Text><Text style={styles.metricLabel}>vidéos</Text></View>
                  <View style={styles.divider} />
                  <View style={styles.metric}><Text style={styles.metricValue}>{count(totalViews)}</Text><Text style={styles.metricLabel}>vues</Text></View>
                  <View style={styles.divider} />
                  <View style={styles.metric}><Text style={styles.metricValue}>{count(totalSales)}</Text><Text style={styles.metricLabel}>ventes</Text></View>
                </View>
                <SectionHeader title="Bibliothèque" subtitle="Consultez les analytics ou supprimez un contenu." />
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="▶"
            title="Aucune vidéo"
            description="Ajoutez votre première vidéo pour développer votre contenu sur Livi."
            actionLabel="Uploader une vidéo"
            onAction={() => navigation.navigate('VideoUpload')}
          />
        }
        renderItem={({ item }) => {
          const busy = busyId === item.id;
          return (
            <Card style={styles.card}>
              <View style={styles.top}>
                <View style={styles.mark}><Text style={styles.markText}>▶</Text></View>
                <View style={styles.main}>
                  <Text style={styles.videoTitle} numberOfLines={2}>{item.title?.trim() || 'Sans titre'}</Text>
                  <View style={styles.meta}>
                    <StatusBadge domain="generic" status={item.status ?? undefined} />
                    {item.created_at ? <Text style={styles.date}>{date(item.created_at)}</Text> : null}
                  </View>
                </View>
              </View>

              <View style={styles.stats}>
                <View style={styles.stat}><Text style={styles.statValue}>{count(item.views)}</Text><Text style={styles.statLabel}>Vues</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{count(item.likes)}</Text><Text style={styles.statLabel}>J’aime</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{count(item.sales)}</Text><Text style={styles.statLabel}>Ventes</Text></View>
              </View>

              <View style={styles.actions}>
                <Button
                  title="Analytics"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onPress={() => navigation.navigate('VideoAnalytics', { videoId: item.id })}
                  style={styles.action}
                />
                <Button
                  title={busy ? 'Suppression…' : 'Supprimer'}
                  variant="red"
                  size="sm"
                  disabled={busy}
                  loading={busy}
                  onPress={() => remove(item)}
                  style={styles.action}
                />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  loading: { flex: 1, backgroundColor: colors.dark, padding: spacing[5], gap: spacing[4] },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[10], gap: spacing[3] },
  emptyContent: { flexGrow: 1 },
  header: { gap: spacing[3], marginBottom: spacing[1] },
  eyebrow: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: fontSize.xs, letterSpacing: 1.1 },
  title: { color: colors.textPrimary, fontFamily: fonts.brand, fontSize: fontSize['3xl'], lineHeight: 36 },
  subtitle: { color: colors.gray2, fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 21 },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], padding: spacing[3], borderWidth: 1, borderColor: 'rgba(255,94,94,0.25)', backgroundColor: 'rgba(255,94,94,0.07)' },
  errorDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: colors.red },
  errorText: { flex: 1, color: colors.gray2, fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 19 },
  overview: { minHeight: 84, paddingHorizontal: spacing[4], paddingVertical: spacing[3], flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(201,151,28,0.06)', borderWidth: 1, borderColor: 'rgba(201,151,28,0.22)', borderRadius: radius.lg },
  metric: { flex: 1, alignItems: 'center', gap: spacing[1] },
  divider: { width: 1, height: 34, backgroundColor: colors.border },
  metricValue: { color: colors.gold2, fontFamily: fonts.brand, fontSize: fontSize.lg },
  metricLabel: { color: colors.gray3, fontFamily: fonts.body, fontSize: fontSize.xs },
  card: { padding: spacing[4], gap: spacing[4] },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  mark: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(201,151,28,0.12)', borderWidth: 1, borderColor: 'rgba(201,151,28,0.22)' },
  markText: { color: colors.gold2, fontFamily: fonts.brand, fontSize: 16 },
  main: { flex: 1, minWidth: 0, gap: spacing[2] },
  videoTitle: { color: colors.textPrimary, fontFamily: fonts.brandSemibold, fontSize: fontSize.md, lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
  date: { color: colors.gray3, fontFamily: fonts.body, fontSize: fontSize.xs },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing[3] },
  stat: { flex: 1, alignItems: 'center', gap: spacing[1] },
  statValue: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  statLabel: { color: colors.gray3, fontFamily: fonts.body, fontSize: fontSize.xs },
  actions: { flexDirection: 'row', gap: spacing[3] },
  action: { flex: 1 },
});
