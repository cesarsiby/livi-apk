import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { transporterApi, Mission } from '../../features/transporter/transporterApi';
import { getCurrentLocation } from '../../services/device/location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Card, CountdownTimer, Money, RatingPrompt, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function MissionDetailsScreen({ route }: any) {
  const id = String(route.params.missionId);
  const [mission, setMission] = useState<Mission | null>(null);
  // V49 (RAPPORT_AUDIT_PARTIE5.md): the pickup and delivery PIN fields used
  // to share a single `pin` state variable. Both cards render at the same
  // time regardless of mission status, so typing in one field made the same
  // text appear in the other — confusing, and it left the "Valider la prise
  // en charge" button enabled (though not functional; the backend still
  // rejects it once the shipment has moved past 'assigned') after a mission
  // had already been picked up. Two independent fields removes both.
  const [pickupPin, setPickupPin] = useState('');
  const [deliveryPin, setDeliveryPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrTarget, setQrTarget] = useState<'pickup' | 'deliver' | null>(null);

  const load = useCallback(() => {
    return transporterApi.mission(id)
      .then(setMission)
      .catch((e) => Alert.alert('Mission', e?.message ?? 'Erreur de chargement.'));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!mission) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  async function action(kind: 'accept' | 'reject' | 'pickup' | 'arrive' | 'deliver') {
    try {
      setBusy(true);
      if (kind === 'accept') await transporterApi.acceptMission(id);
      if (kind === 'reject') await transporterApi.rejectMission(id);
      if (kind === 'pickup') await transporterApi.pickup(id, { pin: pickupPin.trim() });
      if (kind === 'arrive') {
        const location = await getCurrentLocation();
        await transporterApi.arrive(id, location);
      }
      if (kind === 'deliver') await transporterApi.deliver(id, { pin: deliveryPin.trim() });
      await load();
      if (kind === 'pickup') setPickupPin('');
      if (kind === 'deliver') setDeliveryPin('');
    } catch (e: any) {
      Alert.alert('Mission', e?.message ?? 'Action refusée.');
    } finally {
      setBusy(false);
    }
  }

  function openQR(target: 'pickup' | 'deliver') {
    setQrTarget(target);
  }

  const onQRScanned = async (data: string) => {
    const target = qrTarget;
    setQrTarget(null);
    try {
      setBusy(true);
      if (target === 'pickup') await transporterApi.pickup(id, { qr_token: data });
      if (target === 'deliver') await transporterApi.deliver(id, { qr_token: data });
      await load();
    } catch (e: any) {
      Alert.alert('QR LIVI', e?.message ?? 'QR refusé.');
    } finally {
      setBusy(false);
    }
  };

  if (qrTarget) {
    return <View style={{ flex: 1 }}><QRScannerScreenForMission onScanned={onQRScanned} onCancel={() => setQrTarget(null)} /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.title}>{mission.reference ?? `Mission #${String(mission.id).slice(0, 8)}`}</Text>
          {/* LIVI 2.0 (RAPPORT_UXUI_SESSION21, constat C10 étendu) :
              pickup_status et delivery_status n'existent nulle part dans la
              réponse de GET /transporter/missions/:id (routes/
              compatibility.js — seuls s.* et o.status AS order_status sont
              sélectionnés) — ces deux lignes affichaient "—" pour toute
              mission, systématiquement. mission.status (le vrai statut de
              l'expédition) est seul réel, passé par StatusBadge. */}
          <StatusBadge domain="delivery" status={mission.status} />
        </View>

        {/* V54 (RAPPORT — "ATTRIBUTION DES MISSIONS TRANSPORTEUR"): pickup
            address, delivery address, and delivery fee weren't shown
            anywhere on this screen at all before this. */}
        <Card style={styles.section} padded>
          <Text style={styles.sectionTitle}>📦 Collecte</Text>
          <Text style={styles.body}>{mission.pickup_shop_name ?? 'Boutique'}</Text>
          <Text style={styles.meta}>{[mission.pickup_address, mission.pickup_city].filter(Boolean).join(', ') || 'Adresse non renseignée'}</Text>
          {!!mission.pickup_phone && <Text style={styles.meta}>{mission.pickup_phone}</Text>}
        </Card>
        <Card style={styles.section} padded>
          <Text style={styles.sectionTitle}>🏠 Livraison</Text>
          <Text style={styles.body}>{mission.delivery_recipient_name ?? 'Client'}</Text>
          <Text style={styles.meta}>{[mission.delivery_address_line, mission.delivery_city].filter(Boolean).join(', ') || 'Adresse non renseignée'}</Text>
          {!!mission.delivery_neighborhood && <Text style={styles.meta}>Quartier : {mission.delivery_neighborhood}</Text>}
          {!!mission.delivery_landmark_description && (
            <Text style={styles.meta}>📍 Repère : {mission.delivery_landmark_type ? `${mission.delivery_landmark_type} — ` : ''}{mission.delivery_landmark_description}</Text>
          )}
          {!!mission.delivery_phone && <Text style={styles.meta}>{mission.delivery_phone}</Text>}
        </Card>
        {mission.shipping_fee != null && (
          <Card style={styles.section} padded>
            <Text style={styles.sectionTitle}>💰 Frais de livraison</Text>
            <Money amount={mission.shipping_fee} currency="FCFA" size="lg" color={colors.gold} />
          </Card>
        )}

        {/* V54: a live 5-minute offer — transporter_id not set yet, offered
            specifically to this account. Countdown + Refuser weren't shown
            anywhere on this screen before ("Accepter la mission" existed,
            "Refuser" didn't). See services/missionDispatch.js. */}
        {!mission.transporter_id && mission.offered_to && mission.offer_expires_at && (
          <Card style={styles.offerBanner} padded>
            <Text style={styles.sectionTitle}>Offre de mission</Text>
            <CountdownTimer expiresAt={mission.offer_expires_at} onExpire={load} />
            <View style={styles.offerActions}>
              <Button title="Accepter" variant="green" disabled={busy} loading={busy} onPress={() => action('accept')} style={{ flex: 1 }} />
              <Button title="Refuser" variant="red" disabled={busy} onPress={() => action('reject')} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        <Card style={styles.section} padded>
          <Text style={styles.sectionTitle}>Prise en charge du colis</Text>
          <Text style={styles.body}>Le code doit être fourni pour cette mission.</Text>
          <TextInput
            value={pickupPin}
            onChangeText={setPickupPin}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="PIN vendeur"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Button title={busy ? 'Traitement…' : 'Valider la prise en charge'} disabled={busy || !pickupPin.trim()} onPress={() => action('pickup')} variant="secondary" fullWidth />
          <Button title="Scanner le QR vendeur" onPress={() => openQR('pickup')} variant="outline" fullWidth />
        </Card>

        <Card style={styles.section} padded>
          <Text style={styles.sectionTitle}>Acheminement</Text>
          <Button title={busy ? 'Traitement…' : "Déclarer l'arrivée"} disabled={busy} loading={busy} onPress={() => action('arrive')} fullWidth />
        </Card>

        <Card style={styles.section} padded>
          <Text style={styles.sectionTitle}>Remise à l'acheteur</Text>
          <Text style={styles.body}>Utilisez le PIN/QR de cette commande.</Text>
          <TextInput
            value={deliveryPin}
            onChangeText={setDeliveryPin}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="PIN acheteur"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Button title={busy ? 'Traitement…' : 'Confirmer la remise'} disabled={busy || !deliveryPin.trim()} onPress={() => action('deliver')} variant="green" fullWidth />
          <Button title="Scanner le QR acheteur" onPress={() => openQR('deliver')} variant="outline" fullWidth />
        </Card>

        <Text style={styles.note}>Le backend LIVI reste la source de vérité pour chaque transition.</Text>

        {/* V54 (RAPPORT — "SYSTÈME DE NOTATION"): buyer and vendor ratings
            weren't reachable from anywhere on the transporter side. */}
        {['delivered', 'completed'].includes(String(mission.order_status ?? '').toLowerCase()) && (
          <View style={{ gap: spacing[3], marginTop: spacing[3] }}>
            <Text style={styles.sectionTitle}>Votre avis compte</Text>
            {!!mission.buyer_id && <RatingPrompt orderId={mission.order_id ?? ''} ratedId={mission.buyer_id} ratedLabel="l'acheteur" />}
            {!!mission.vendor_id && <RatingPrompt orderId={mission.order_id ?? ''} ratedId={mission.vendor_id} ratedLabel="le vendeur" />}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  container: { flex: 1, backgroundColor: colors.dark },
  flex: { flex: 1 },
  scroll: { padding: spacing[5], gap: spacing[2], flexGrow: 1 },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  meta: { fontFamily: fonts.body, color: colors.gray2 },
  section: { gap: spacing[3], marginTop: spacing[3] },
  offerBanner: { gap: spacing[3], marginTop: spacing[3], borderWidth: 2, borderColor: colors.gold },
  offerActions: { flexDirection: 'row', gap: spacing[2] },
  sectionTitle: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  feeValue: { fontSize: fontSize.xl, fontFamily: fonts.brandSemibold, color: colors.gold },
  body: { fontFamily: fonts.body, color: colors.gray2 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], textAlign: 'center', fontSize: fontSize.xl, color: colors.textPrimary, fontFamily: fonts.body, backgroundColor: colors.dark4 },
  note: { color: colors.textMuted, marginTop: spacing[3], fontFamily: fonts.body, fontSize: fontSize.xs },
});

function QRScannerScreenForMission({ onScanned, onCancel }: { onScanned: (data: string) => void; onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  if (!permission) return <View style={qrStyles.center}><Text style={qrStyles.help}>Préparation…</Text></View>;
  if (!permission.granted) return (
    <View style={qrStyles.center}>
      <Text style={qrStyles.title}>Scanner le QR LIVI</Text>
      <Button title="Autoriser la caméra" onPress={requestPermission} fullWidth />
      <Button title="Annuler" onPress={onCancel} variant="ghost" fullWidth />
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" onBarcodeScanned={({ data }) => onScanned(data)} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
      <View style={qrStyles.overlay} pointerEvents="none">
        <View style={qrStyles.frame} />
        <Text style={qrStyles.caption}>Scannez le QR LIVI</Text>
      </View>
    </View>
  );
}

const qrStyles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6], backgroundColor: colors.dark },
  help: { color: colors.gray2, fontFamily: fonts.body },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 250, height: 250, borderWidth: 3, borderColor: colors.gold, borderRadius: radius.xl },
  caption: { color: colors.white, marginTop: spacing[6], fontFamily: fonts.bodyBold },
});
