import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ordersApi, Order } from '../../features/orders/ordersApi';
import { Button, CountdownTimer, RatingPrompt, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function OrderDetailsScreen({ route, navigation }: any) {
  const orderId = String(route.params.orderId);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pin, setPin] = useState('');
  const [reviewProductId, setReviewProductId] = useState('');
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');

  const load = useCallback(async () => {
    try {
      setOrder(await ordersApi.get(orderId));
    } catch (e: any) {
      Alert.alert('Commande', e?.message ?? 'Impossible de charger la commande.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const items = (order as any)?.items;
    if (Array.isArray(items) && items.length === 1 && !reviewProductId) {
      setReviewProductId(String(items[0].product_id ?? items[0].id ?? ''));
    }
  }, [order, reviewProductId]);

  async function submitReview() {
    if (!reviewProductId) return;
    try {
      setRefreshing(true);
      await ordersApi.review(orderId, { product_id: reviewProductId, rating: Number(reviewRating), comment: reviewComment.trim() || undefined });
      Alert.alert('Avis', 'Votre avis a été enregistré.');
      setReviewComment('');
    } catch (e: any) {
      Alert.alert('Avis', e?.message ?? "Impossible d'enregistrer l'avis.");
    } finally {
      setRefreshing(false);
    }
  }

  async function confirmReceipt() {
    if (!pin.trim()) {
      Alert.alert('Validation', 'Entrez le PIN remis pour la réception.');
      return;
    }
    try {
      setRefreshing(true);
      await ordersApi.confirmReceipt(orderId, { pin: pin.trim() });
      await load();
      Alert.alert('Livraison confirmée', 'La réception a été enregistrée par LIVI.');
    } catch (e: any) {
      Alert.alert('Validation refusée', e?.message ?? "Le PIN n'a pas été accepté.");
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.helpText}>Commande introuvable.</Text>
      </View>
    );
  }

  const delivered = ['delivered', 'completed', 'received'].includes(
    String(order.delivery_status ?? order.status ?? '').toLowerCase(),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{order.reference ?? `Commande #${order.id}`}</Text>

      <View style={styles.badgeRow}>
        {/* LIVI 2.0 (RAPPORT_UXUI_SESSION21, constat C10 étendu) :
            payment_status et delivery_status n'existent nulle part côté
            backend (aucune colonne, aucune route ne les renvoie jamais) —
            ces deux badges affichaient "—" pour toutes les commandes,
            systématiquement. order.status est le seul statut réel. */}
        <StatusBadge domain="order" status={order.status} />
      </View>

      <Text style={styles.total}>{Number(order.total_amount ?? order.total ?? 0).toLocaleString('fr-FR')} {order.currency ?? 'FCFA'}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Suivi</Text>
        <Text style={styles.bodyText}>{trackingText(order)}</Text>
      </View>

      <Pressable onPress={() => navigation.navigate('DeliveryTracking', { orderId })} style={styles.linkRow}>
        <Text style={styles.link}>Ouvrir le suivi détaillé</Text>
      </Pressable>

      {!delivered && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Confirmer la réception</Text>
          <Text style={styles.helpText}>Le PIN doit être celui fourni par le système LIVI pour cette commande.</Text>
          <TextInput
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            maxLength={8}
            placeholder="PIN de réception"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Button title={refreshing ? 'Validation…' : 'Confirmer la réception'} disabled={refreshing} loading={refreshing} onPress={confirmReceipt} fullWidth />
        </View>
      )}

      {(() => {
        // V54 (RAPPORT — "LITIGE APRÈS LIVRAISON"): the button used to be
        // shown unconditionally — tapping it after the 10-minute window
        // (enforced server-side, see routes/disputes.js) would just fail at
        // submission. Now mirrors the exact wording from the brief
        // ("Vous avez 09:59 pour signaler un problème") and disables itself
        // once the window is over.
        if (order.status !== 'delivered' || !order.delivered_at) {
          return (
            <Pressable onPress={() => navigation.navigate('CreateDispute', { orderId })} style={styles.dispute}>
              <Text style={styles.disputeText}>Ouvrir un litige</Text>
            </Pressable>
          );
        }
        const expiresAt = new Date(new Date(order.delivered_at).getTime() + 10 * 60 * 1000).toISOString();
        const expired = new Date(expiresAt).getTime() <= Date.now();
        if (expired) {
          return (
            <View style={[styles.dispute, styles.disputeDisabled]}>
              <Text style={styles.disputeTextDisabled}>Délai de signalement expiré (10 minutes après livraison)</Text>
            </View>
          );
        }
        return (
          <Pressable onPress={() => navigation.navigate('CreateDispute', { orderId })} style={styles.dispute}>
            <Text style={styles.disputeText}>Signaler un problème</Text>
            <CountdownTimer expiresAt={expiresAt} style={{ marginTop: 4 }} />
          </Pressable>
        );
      })()}

      {['delivered', 'completed'].includes(String(order.status ?? '').toLowerCase()) && (
        <View style={{ gap: spacing[3] }}>
          <Text style={styles.sectionTitle}>Votre avis compte</Text>
          {!!order.vendor_id && <RatingPrompt orderId={orderId} ratedId={order.vendor_id} ratedLabel="le vendeur" />}
          {!!order.transporter_id && <RatingPrompt orderId={orderId} ratedId={order.transporter_id} ratedLabel="le transporteur" />}
        </View>
      )}

      {['delivered', 'completed'].includes(String(order.status).toLowerCase()) && Array.isArray((order as any).items) && (order as any).items.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Laisser un avis</Text>
          {/* LIVI 2.0 (RAPPORT_UXUI_SESSION21, §51 — ne pas maquiller une
              fonctionnalité incomplète) : demander à l'acheteur de taper
              lui-même l'UUID du produit à noter n'est pas une saisie
              réaliste. Les articles réels de la commande sont déjà connus
              (order.items) — remplacé par une sélection. */}
          {(order as any).items.length > 1 ? (
            <View style={styles.reviewChipRow}>
              {(order as any).items.map((it: any, i: number) => {
                const pid = String(it.product_id ?? it.id ?? i);
                return (
                  <Pressable
                    key={pid}
                    onPress={() => setReviewProductId(pid)}
                    style={[styles.reviewChip, reviewProductId === pid && styles.reviewChipActive]}
                  >
                    <Text style={[styles.reviewChipText, reviewProductId === pid && styles.reviewChipTextActive]} numberOfLines={1}>
                      {it.product_name ?? it.name ?? `Article ${i + 1}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.meta}>{(order as any).items[0]?.product_name ?? (order as any).items[0]?.name ?? 'Cet article'}</Text>
          )}
          <TextInput value={reviewRating} onChangeText={setReviewRating} keyboardType="number-pad" maxLength={1} placeholder="Note 1-5" placeholderTextColor={colors.textMuted} style={styles.inputLeft} />
          <TextInput value={reviewComment} onChangeText={setReviewComment} placeholder="Commentaire (optionnel)" placeholderTextColor={colors.textMuted} style={styles.inputLeft} />
          <Button title="Publier l'avis" disabled={refreshing || !reviewProductId} onPress={submitReview} fullWidth />
        </View>
      )}

      <Pressable onPress={load} style={styles.linkRow}>
        <Text style={styles.link}>Actualiser l'état</Text>
      </Pressable>
    </ScrollView>
  );
}

function trackingText(order: Order) {
  const t = order.tracking;
  if (!t) return 'Aucune information de suivi disponible pour le moment.';
  if (typeof t === 'string') return t;
  return t.status ?? t.current_status ?? 'Suivi disponible';
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[5], backgroundColor: colors.dark },
  container: { flex: 1, padding: spacing[4], gap: spacing[3] },
  title: { fontFamily: fonts.brand, fontSize: fontSize['2xl'], color: colors.textPrimary },
  badgeRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  total: { fontFamily: fonts.brandSemibold, fontSize: fontSize.xl, color: colors.gold, marginTop: 4 },
  section: {
    marginTop: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[2],
  },
  sectionTitle: { fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, color: colors.textPrimary },
  bodyText: { fontFamily: fonts.body, color: colors.gray2 },
  helpText: { fontFamily: fonts.body, color: colors.textMuted },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: fontSize.xl,
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fonts.body,
    backgroundColor: colors.dark4,
  },
  inputLeft: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    backgroundColor: colors.dark4,
  },
  reviewChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  reviewChip: { backgroundColor: colors.dark4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: spacing[2], paddingHorizontal: spacing[3] },
  reviewChipActive: { backgroundColor: colors.goldDim, borderColor: colors.goldBorder },
  reviewChipText: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: fontSize.sm },
  reviewChipTextActive: { color: colors.gold, fontFamily: fonts.bodySemibold },
  dispute: {
    padding: spacing[4],
    alignItems: 'center',
    backgroundColor: colors.orangeDim,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    borderRadius: radius.md,
    marginTop: spacing[2],
  },
  disputeText: { color: colors.orange, fontFamily: fonts.bodyBold },
  disputeDisabled: { backgroundColor: colors.dark4, borderColor: colors.border },
  disputeTextDisabled: { color: colors.textMuted, fontFamily: fonts.body, textAlign: 'center' },
  linkRow: { padding: spacing[4], alignItems: 'center' },
  link: { color: colors.gold, fontFamily: fonts.bodySemibold },
});
