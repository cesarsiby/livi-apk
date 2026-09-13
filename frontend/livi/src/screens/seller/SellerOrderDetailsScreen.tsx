import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { sellerApi, SellerOrder } from '../../features/seller/sellerApi';
import { Button, Money, RatingPrompt, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, constat C10 étendu) : ni payment_status
// ni delivery_status n'existent nulle part côté backend — aucune colonne
// SQL, aucun champ jamais renvoyé par aucune route (recherche exhaustive
// sur migrations/*.sql et src/routes/*.js). Ces deux lignes affichaient
// donc "—" à chaque commande, sans exception. order.status est le seul
// statut réel — passé par StatusBadge plutôt qu'affiché brut.
export function SellerOrderDetailsScreen({ route, navigation }: any) {
  const id = String(route.params.orderId);
  const [order, setOrder] = useState<SellerOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => sellerApi.order(id).then(setOrder).catch((e) => Alert.alert('Commande', e?.message ?? 'Erreur.'));
  useEffect(() => { load(); }, [id]);

  if (!order) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  async function action(kind: 'accept' | 'prepare') {
    try { setBusy(true); if (kind === 'accept') await sellerApi.acceptOrder(id); else await sellerApi.prepareOrder(id); await load(); }
    catch (e: any) { Alert.alert('Action', e?.message ?? 'Action refusée.'); }
    finally { setBusy(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{order.reference ?? `Commande #${String(order.id).slice(0, 8)}`}</Text>
        <StatusBadge domain="order" status={order.status} />
      </View>
      <Money amount={order.total_amount ?? order.total} currency={order.currency ?? 'FCFA'} size="lg" color={colors.gold} style={{ marginTop: spacing[2] }} />
      {!!order.items?.length && (
        <View style={styles.items}>
          <Text style={styles.itemsTitle}>Articles à préparer</Text>
          {order.items.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{it.product_name} × {it.quantity}</Text>
              <Text style={styles.itemPrice}>{Number(it.total_price).toLocaleString('fr-FR')} FCFA</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.actions}>
        <Button title={busy ? 'Traitement…' : 'Accepter la commande'} disabled={busy} loading={busy} onPress={() => action('accept')} fullWidth />
        <Button title={busy ? 'Traitement…' : 'Marquer comme préparée'} disabled={busy} loading={busy} onPress={() => action('prepare')} variant="secondary" fullWidth />
        <Button title="Voir le code de remise" variant="outline" onPress={() => navigation.navigate('SellerPickupProof', { orderId: id })} fullWidth />
      </View>
      {['delivered', 'completed'].includes(String(order.status ?? '').toLowerCase()) && order.transporter_id && (
        <View style={{ marginTop: spacing[4] }}>
          <RatingPrompt orderId={id} ratedId={order.transporter_id} ratedLabel="le transporteur" />
        </View>
      )}
      <Text style={styles.note}>Chaque changement d'état est validé par le backend LIVI.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  container: { flex: 1, padding: spacing[5], gap: spacing[2], backgroundColor: colors.dark },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary, flexShrink: 1 },
  actions: { gap: spacing[3], marginTop: spacing[5] },
  note: { color: colors.textMuted, marginTop: spacing[3], fontFamily: fonts.body, fontSize: fontSize.xs },
  items: { marginTop: spacing[3], gap: spacing[1] },
  itemsTitle: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: fontSize.sm, marginBottom: spacing[1] },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontFamily: fonts.body, color: colors.gray2, flex: 1 },
  itemPrice: { fontFamily: fonts.body, color: colors.gray2 },
});
