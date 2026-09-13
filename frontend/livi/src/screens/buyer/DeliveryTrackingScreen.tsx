import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ordersApi, Order } from '../../features/orders/ordersApi';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function DeliveryTrackingScreen({ route }: any) {
  const orderId = String(route.params.orderId);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setOrder(await ordersApi.get(orderId)); }
    catch (e: any) { setError(e?.message ?? 'Impossible de charger le suivi.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [orderId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !order) return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>;

  const tracking: any = order?.tracking;
  const events = Array.isArray(tracking?.events) ? tracking.events : [];
  const status = order?.delivery_status ?? order?.status ?? '—';

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />}
      contentContainerStyle={styles.container}
    >
      <Text style={styles.kicker}>LIVRAISON</Text>
      <Text style={styles.title}>{order?.reference ?? `Commande #${orderId}`}</Text>

      <View style={styles.status}>
        <Text style={styles.statusLabel}>Statut actuel</Text>
        <Text style={styles.statusValue}>{String(status)}</Text>
      </View>

      {error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load}><Text style={styles.link}>Réessayer</Text></Pressable>
        </View>
      ) : null}

      <Card style={styles.card} padded>
        <Text style={styles.sectionTitle}>Suivi serveur</Text>
        <Text style={styles.muted}>{tracking?.current_location ?? tracking?.message ?? tracking?.status ?? 'Aucune position ou étape détaillée fournie par le backend.'}</Text>
      </Card>

      <Card style={styles.card} padded>
        <Text style={styles.sectionTitle}>Événements</Text>
        {events.length ? events.map((event: any, index: number) => (
          <View key={String(event.id ?? index)} style={styles.event}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>{event.type ?? event.status ?? 'Événement'}</Text>
              <Text style={styles.muted}>{event.message ?? event.description ?? ''}</Text>
              <Text style={styles.time}>{event.timestamp ?? event.created_at ?? ''}</Text>
            </View>
          </View>
        )) : <Text style={styles.muted}>Les événements détaillés apparaîtront lorsqu'ils seront fournis par le backend.</Text>}
      </Card>

      <Text style={styles.note}>Le mobile affiche uniquement l'état fourni par LIVI. Il ne valide aucune transition de livraison localement.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark },
  container: { padding: spacing[4], gap: spacing[3] },
  kicker: { fontSize: fontSize.xs, fontFamily: fonts.bodyBold, letterSpacing: 1.5, color: colors.gold },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  status: { backgroundColor: colors.dark3, borderRadius: radius.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.goldBorder },
  statusLabel: { color: colors.textMuted, fontFamily: fonts.body },
  statusValue: { color: colors.gold, fontSize: fontSize.xl, fontFamily: fonts.brandSemibold, marginTop: 5 },
  card: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  muted: { color: colors.gray2, fontFamily: fonts.body },
  event: { flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[2] },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold, marginTop: 5 },
  eventTitle: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  time: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 3, fontFamily: fonts.body },
  error: { backgroundColor: colors.redDim, borderWidth: 1, borderColor: colors.redBorder, borderRadius: radius.md, padding: spacing[4], gap: spacing[2] },
  errorText: { color: colors.red, fontFamily: fonts.body },
  link: { fontFamily: fonts.bodyBold, color: colors.gold },
  note: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18, fontFamily: fonts.body },
});
