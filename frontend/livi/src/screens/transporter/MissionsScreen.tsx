import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { transporterApi, Mission } from '../../features/transporter/transporterApi';
import { normalizeList } from '../../services/api/normalize';
import { Card, Button, CountdownTimer, EmptyState, formatMoney } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, feuille de route priorité 1, constat
// C0) : GET /transporter/missions renvoie un tableau brut (routes/
// compatibility.js, `ok(res, rows)`) — `r?.missions ?? r?.data ?? []`
// retombait toujours sur []. Corrigé avec normalizeList(). La table
// shipments n'a pas de colonne `reference`, seulement `tracking_code` — le
// repli `Mission #${id}` restait donc systématique ; utilisé tracking_code
// en priorité maintenant. Toute la logique métier (offre à 5 min,
// accepter/refuser, minuteur) est inchangée, elle était déjà correcte.
export function MissionsScreen({ navigation }: any) {
  const [items, setItems] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    transporterApi.missions({ limit: 50 })
      .then((r) => setItems(normalizeList<Mission>(r, ['missions', 'data'])))
      .catch((e) => Alert.alert('Missions', e?.message ?? 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function respond(id: string, action: 'accept' | 'reject') {
    try {
      setBusyId(id);
      await (action === 'accept' ? transporterApi.acceptMission(id) : transporterApi.rejectMission(id));
      load();
    } catch (e: any) {
      Alert.alert('Mission', e?.message ?? "Cette offre n'est plus disponible — elle a peut-être déjà expiré ou été prise.");
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View style={styles.headerAction}>
          <Button
            title="Vérifier un code QR / PIN"
            variant="outline"
            onPress={() => navigation.navigate('QRValidation')}
            fullWidth
          />
        </View>
      }
      ListEmptyComponent={<EmptyState icon="🧭" title="Aucune mission disponible" description="Les nouvelles propositions de livraison apparaîtront ici dès qu'elles seront disponibles près de vous." />}
      renderItem={({ item }) => {
        // V54: a mission with `offered_to` set and no `transporter_id` yet
        // is a live 5-minute offer specifically for this transporter — see
        // services/missionDispatch.js. Everything else is a mission already
        // assigned/in progress, tapped through to the details screen as
        // before.
        const isOffer = !item.transporter_id && !!item.offered_to;
        return (
          <Pressable onPress={() => navigation.navigate('MissionDetails', { missionId: item.id })}>
            <Card style={[styles.card, isOffer && styles.offerCard]}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{(item as any).tracking_code ?? item.reference ?? `Mission #${String(item.id).slice(0, 8)}`}</Text>
                {isOffer && item.offer_expires_at && (
                  <CountdownTimer expiresAt={item.offer_expires_at} onExpire={load} />
                )}
              </View>
              <Text style={styles.meta}>Statut : {isOffer ? 'Proposée — en attente de votre réponse' : (item.status ?? '—')}</Text>
              <Text style={styles.meta}>Collecte : {item.pickup_shop_name ?? item.pickup_city ?? '—'}</Text>
              {item.shipping_fee != null && <Text style={styles.meta}>Frais de livraison : {formatMoney(item.shipping_fee)}</Text>}
              {isOffer && (
                <View style={styles.actions}>
                  <Button title="Accepter" variant="green" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => respond(item.id, 'accept')} style={{ flex: 1 }} />
                  <Button title="Refuser" variant="red" size="sm" disabled={busyId === item.id} loading={busyId === item.id} onPress={() => respond(item.id, 'reject')} style={{ flex: 1 }} />
                </View>
              )}
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3] },
  headerAction: { marginBottom: spacing[2] },
  card: { padding: spacing[4], gap: 6 },
  offerCard: { borderWidth: 2, borderColor: colors.gold, borderRadius: radius.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  empty: { textAlign: 'center', padding: spacing[10], color: colors.textMuted, fontFamily: fonts.body },
});
