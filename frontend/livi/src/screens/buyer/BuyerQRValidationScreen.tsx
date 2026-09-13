import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ordersApi, DeliveryProof } from '../../features/orders/ordersApi';
import { Button, ProofDisplay } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function BuyerQRValidationScreen({ route, navigation }: any) {
  const orderId = route.params?.orderId ? String(route.params.orderId) : '';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  // See RAPPORT_AUDIT_QR_PIN.md, points G/L.3/N.4 — this screen used to only
  // let the Buyer *submit* a code, never see the one meant for them. A 409
  // here just means it isn't generated yet (no transporter assigned) — not
  // worth an error message, the manual scan/PIN form below still works.
  const [myProof, setMyProof] = useState<DeliveryProof | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const loadMyProof = useCallback(() => {
    if (!orderId) return;
    setProofLoading(true);
    ordersApi.deliveryProof(orderId).then(setMyProof).catch(() => setMyProof(null)).finally(() => setProofLoading(false));
  }, [orderId]);
  useEffect(() => { loadMyProof(); }, [loadMyProof]);

  async function submit(payload: { pin?: string; qr_token?: string }) {
    if (!orderId) { Alert.alert('Commande requise', 'Cette validation doit être liée à une commande LIVI.'); return; }
    try {
      setBusy(true);
      await ordersApi.confirmReceipt(orderId, payload);
      Alert.alert('Confirmation envoyée', 'Le backend LIVI a confirmé la réception.', [{ text: 'Voir la commande', onPress: () => navigation.navigate('OrderDetails', { orderId }) }]);
      setPin(''); setScanning(false);
    } catch (e: any) { Alert.alert('Validation refusée', e?.message ?? 'La confirmation a été refusée par le serveur.'); }
    finally { setBusy(false); }
  }

  if (scanning && permission?.granted) return (
    <View style={styles.camera}>
      <CameraView style={StyleSheet.absoluteFillObject} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { setScanning(false); submit({ qr_token: data }); }} />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.caption}>Scannez le QR LIVI de cette commande</Text>
        <Button title="Annuler" onPress={() => setScanning(false)} variant="secondary" />
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Confirmer la réception</Text>
      <Text style={styles.note}>Commande : {orderId || 'non sélectionnée'}</Text>
      {proofLoading ? (
        <ActivityIndicator color={colors.gold} />
      ) : myProof ? (
        <ProofDisplay
          title="Votre code de livraison"
          helperText="Montrez ce QR ou communiquez ce code au transporteur à la remise — ou validez-le vous-même ci-dessous."
          pin={myProof.pin}
          qrPayload={myProof.qr_payload}
          expiresAt={myProof.expires_at}
        />
      ) : null}
      <Text style={styles.note}>Le QR ou le PIN est envoyé au backend. Le mobile ne valide jamais la preuve localement.</Text>
      {!permission?.granted ? (
        <Button title="Autoriser la caméra" onPress={requestPermission} fullWidth />
      ) : (
        <Button title="Scanner le QR" onPress={() => setScanning(true)} disabled={busy || !orderId} fullWidth />
      )}
      <TextInput value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} placeholder="PIN de confirmation" placeholderTextColor={colors.textMuted} style={styles.input} />
      <Button title={busy ? 'Validation…' : 'Valider le PIN'} disabled={busy || !pin.trim() || !orderId} loading={busy} onPress={() => submit({ pin: pin.trim() })} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[4] },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  note: { color: colors.gray, lineHeight: 19, fontFamily: fonts.body, fontSize: fontSize.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[4],
    fontSize: fontSize.xl,
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fonts.body,
    backgroundColor: colors.dark3,
  },
  camera: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[5] },
  frame: { width: 250, height: 250, borderWidth: 3, borderColor: colors.gold, borderRadius: radius.xl },
  caption: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: fontSize.md, textAlign: 'center' },
});
