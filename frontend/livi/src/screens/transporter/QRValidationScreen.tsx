import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { transporterApi } from '../../features/transporter/transporterApi';
import { Button, Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, §26 — "les interfaces de validation
// doivent être extrêmement simples… traiter visuellement tous les états").
//
// Avant : succès affichait le JSON brut renvoyé par le serveur
// (JSON.stringify(result, null, 2)) — exactement le genre de sortie
// technique que la mission interdit de montrer à l'utilisateur. Erreurs
// passaient toutes par une seule Alert générique.
//
// Ce que /transporter/qr/scan fait réellement (routes/delivery.js,
// resolveProof()) : il IDENTIFIE le code (proof_id, shipment_id,
// proof_type, order_status) sans rien valider ni consommer — la
// confirmation réelle (transporterApi.pickup/deliver) se fait ensuite sur
// l'écran de la mission concernée, où la position GPS est déjà capturée.
// Cet écran sert donc de "scanner générique" : on identifie, on explique
// clairement ce qui a été trouvé, puis on renvoie vers la mission pour
// finaliser — plutôt que de dupliquer la logique de remise/livraison ici.
//
// Le backend distingue 3 erreurs réelles (server.js sérialise
// {error:{code,message}}) : QR_INVALID, PROOF_NOT_FOUND, et
// PROOF_UNAVAILABLE (qui couvre À LA FOIS expiré et déjà utilisé — le
// backend ne différencie pas les deux cas, donc l'interface ne l'invente
// pas non plus).
const ERROR_LABELS: Record<string, string> = {
  QR_INVALID: 'Ce code ne correspond pas à un QR LIVI valide.',
  PROOF_NOT_FOUND: 'Aucune preuve LIVI ne correspond à ce code.',
  PROOF_UNAVAILABLE: 'Ce code est expiré ou a déjà été utilisé.',
  FORBIDDEN: "Cette preuve ne correspond pas à l'une de vos missions.",
};

type ScanResult = { proof_id: string; shipment_id: string; proof_type: string; order_id: string; order_status?: string; shipment_status?: string };

export function QRValidationScreen({ navigation }: any) {
  const [p, request] = useCameraPermissions();
  const [scan, setScan] = useState(false);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const validate = async (v: string) => {
    if (!v.trim() || status === 'processing') return;
    setStatus('processing');
    setScan(false);
    try {
      const r = await transporterApi.scanQR(v.trim());
      setResult(r as ScanResult);
      setStatus('success');
    } catch (e: any) {
      const backendCode = e?.details?.error?.code;
      setErrorMessage(ERROR_LABELS[backendCode] ?? e?.message ?? 'QR refusé.');
      setStatus('error');
    }
  };

  const reset = () => { setStatus('idle'); setResult(null); setErrorMessage(''); setCode(''); };

  if (scan && p?.granted) return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={StyleSheet.absoluteFillObject} facing="back" onBarcodeScanned={({ data }) => validate(data)} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
      <View style={s.overlay}>
        <View style={s.frame} />
        <Text style={s.caption}>Scannez le QR LIVI</Text>
        <Pressable onPress={() => setScan(false)} style={s.cancelScan}><Text style={s.cancelScanText}>Annuler</Text></Pressable>
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      <Text style={s.title}>QR / PIN LIVI</Text>
      <Text style={s.note}>Le QR est transmis au backend pour vérification — l'application mobile ne décide jamais seule de sa validité.</Text>

      {status === 'success' && result ? (
        <Card style={s.result}>
          <Text style={s.resultIcon}>✅</Text>
          <Text style={s.resultTitle}>
            {result.proof_type === 'seller_pickup' ? 'Remise vendeur identifiée' : result.proof_type === 'buyer_delivery' ? 'Livraison identifiée' : 'Preuve identifiée'}
          </Text>
          <Text style={s.resultMeta}>Commande #{String(result.order_id).slice(0, 8)}</Text>
          <Button
            title="Ouvrir la mission pour finaliser"
            onPress={() => navigation.navigate('MissionDetails', { missionId: result.shipment_id })}
            fullWidth
          />
          <Pressable onPress={reset}><Text style={s.again}>Scanner un autre code</Text></Pressable>
        </Card>
      ) : status === 'error' ? (
        <Card style={s.result}>
          <Text style={s.resultIcon}>⚠️</Text>
          <Text style={s.errorTitle}>{errorMessage}</Text>
          <Pressable onPress={reset}><Text style={s.again}>Réessayer</Text></Pressable>
        </Card>
      ) : status === 'processing' ? (
        <Card style={s.result}>
          <ActivityIndicator color={colors.gold} />
          <Text style={s.resultMeta}>Vérification auprès du serveur…</Text>
        </Card>
      ) : (
        <>
          {!p?.granted ? <Button title="Autoriser la caméra" onPress={request} fullWidth /> : <Button title="Scanner un QR" onPress={() => setScan(true)} fullWidth />}
          <TextInput value={code} onChangeText={setCode} placeholder="Token QR ou code PIN" placeholderTextColor={colors.textMuted} style={s.input} />
          <Button title="Valider le code" onPress={() => validate(code)} variant="outline" fullWidth disabled={!code.trim()} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: spacing[5], gap: spacing[4], backgroundColor: colors.dark },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  note: { color: colors.gray, backgroundColor: colors.dark3, padding: spacing[4], borderRadius: radius.md, fontFamily: fonts.body, fontSize: fontSize.sm, borderWidth: 1, borderColor: colors.border },
  input: { backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], color: colors.textPrimary, fontFamily: fonts.body },
  result: { padding: spacing[6], alignItems: 'center', gap: spacing[2] },
  resultIcon: { fontSize: 36 },
  resultTitle: { fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, color: colors.textPrimary, textAlign: 'center' },
  resultMeta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm, textAlign: 'center' },
  errorTitle: { fontFamily: fonts.bodySemibold, fontSize: fontSize.base, color: colors.red, textAlign: 'center' },
  again: { color: colors.gold, fontFamily: fonts.bodySemibold, marginTop: spacing[2] },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 250, height: 250, borderWidth: 3, borderColor: colors.gold, borderRadius: radius.xl },
  caption: { color: colors.white, marginTop: spacing[6], fontFamily: fonts.bodyBold },
  cancelScan: { marginTop: spacing[6], paddingVertical: spacing[2], paddingHorizontal: spacing[5], borderRadius: radius.full, borderWidth: 1, borderColor: colors.white },
  cancelScanText: { color: colors.white, fontFamily: fonts.bodySemibold },
});
