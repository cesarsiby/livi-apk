import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { sellerKycApi, KycDocument } from '../../features/seller/sellerKycApi';
import { uploadFile } from '../../services/api/upload';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

const STEP_IDS = ['identity', 'business', 'address'] as const;

function summarizeStatus(documents: KycDocument[]): string {
  if (documents.some((d) => d.status === 'rejected')) return 'À corriger';
  const approvedSteps = new Set(documents.filter((d) => d.status === 'approved').map((d) => d.document_type));
  if (STEP_IDS.every((id) => approvedSteps.has(id))) return 'Vérifié';
  if (documents.length > 0) return 'En cours de vérification';
  return 'Non vérifié';
}

export function SellerKYCScreen() {
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    sellerKycApi.status().then(setDocuments).catch((e) => Alert.alert('KYC', e.message)).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.gold} /></View>;

  const overallStatus = summarizeStatus(documents);
  const steps: [string, string][] = [['identity', "Pièce d'identité"], ['business', 'Document entreprise'], ['address', "Justificatif d'adresse"]];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <Text style={s.title}>Vérification KYC</Text>
      <Text style={s.info}>Soumettez uniquement les documents demandés par le backend LIVI. Le statut est décidé côté serveur.</Text>

      <Card style={s.status} padded>
        <Text style={s.label}>Statut</Text>
        <Text style={s.value}>{overallStatus}</Text>
      </Card>

      {steps.map(([id, label]) => {
        // documents is ordered created_at DESC by the backend, so the first
        // match for a given step is the most recent submission.
        const doc = documents.find((d) => d.document_type === id);
        const status = doc?.status ?? 'pending';
        return (
          <Card key={id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{label}</Text>
              <Text style={s.muted}>{status}{doc?.rejection_reason ? ` — ${doc.rejection_reason}` : ''}</Text>
            </View>
            <Pressable
              style={s.btn}
              disabled={busy === id}
              onPress={async () => {
                const pick = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
                if (pick.canceled) return;
                const file = pick.assets[0];
                try { setBusy(id); await uploadFile('/users/me/kyc', file.uri, 'document', { step: id }); Alert.alert('KYC', 'Document soumis.'); load(); }
                catch (e: any) { Alert.alert('KYC', e.message); }
                finally { setBusy(null); }
              }}
            >
              <Text style={s.btnText}>{busy === id ? '…' : 'Soumettre'}</Text>
            </Pressable>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  container: { padding: spacing[4], gap: spacing[3] },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  info: { color: colors.gray, lineHeight: 21, fontFamily: fonts.body, fontSize: fontSize.sm },
  status: { gap: spacing[1] },
  label: { color: colors.textMuted, fontFamily: fonts.body },
  value: { fontSize: fontSize.xl, fontFamily: fonts.brandSemibold, marginTop: 5, color: colors.gold },
  card: { padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  muted: { color: colors.gray2, marginTop: 3, fontFamily: fonts.body, fontSize: fontSize.sm },
  btn: { backgroundColor: colors.gold, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full },
  btnText: { color: colors.dark, fontFamily: fonts.bodyBold },
});
