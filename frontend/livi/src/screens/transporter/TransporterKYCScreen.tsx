import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { transporterKycApi, KycDocument } from '../../features/transporter/transporterKycApi';
import { uploadFile } from '../../services/api/upload';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// V54 (RAPPORT — "KYC TRANSPORTEUR — OBLIGATOIRE"): this screen didn't exist
// at all, and TransporterNavigator had no route for it. The backend side was
// already role-agnostic and ready — GET/POST /kyc/mine and
// POST /users/me/kyc (src/routes/kyc.js, src/routes/compatibility.js) work
// for any authenticated user, and kyc_documents_type_check (migration 034)
// already allows every value used below. Modelled directly on
// SellerKYCScreen.tsx, which uses the exact same backend.
//
// Document types actually accepted by the DB CHECK constraint:
// 'cni','passport','permis','assurance','business_registration',
// 'tax_document','identity','business','address','other'. There is no
// dedicated "vehicle registration" type, so that document is submitted as
// 'other' with a label that makes the mapping explicit on both the
// transporter's screen and admin's review screen — see the final report for
// the cheap follow-up (a 5th CHECK value) if the team wants a dedicated one.
const STEP_IDS = ['identity', 'permis', 'assurance', 'address', 'other'] as const;
const STEP_LABELS: Record<(typeof STEP_IDS)[number], string> = {
  identity: "Pièce d'identité",
  permis: 'Permis de conduire',
  assurance: 'Assurance véhicule',
  address: 'Justificatif de domicile',
  other: 'Carte grise / document véhicule',
};

function summarizeStatus(documents: KycDocument[]): string {
  if (documents.some((d) => d.status === 'rejected')) return 'À corriger';
  const approvedSteps = new Set(documents.filter((d) => d.status === 'approved').map((d) => d.document_type));
  if (STEP_IDS.every((id) => approvedSteps.has(id))) return 'Vérifié';
  if (documents.length > 0) return 'En cours de vérification';
  return 'Non soumis';
}

export function TransporterKYCScreen() {
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [kycLevel, setKycLevel] = useState<number | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([transporterKycApi.status(), transporterKycApi.me()])
      .then(([docs, me]) => {
        setDocuments(docs);
        const mine = me.role_details?.find((r) => r.role === 'transporter');
        setKycLevel(mine?.kyc_level ?? null);
        setVerifiedAt(mine?.verified_at ?? null);
      })
      .catch((e) => Alert.alert('KYC', e.message))
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.gold} /></View>;

  const overallStatus = summarizeStatus(documents);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <Text style={s.title}>Vérification KYC</Text>
      <Text style={s.info}>Soumettez uniquement les documents demandés par le backend LIVI. Le statut est décidé côté serveur.</Text>

      <Card style={s.status} padded>
        <Text style={s.label}>Statut</Text>
        <Text style={s.value}>{overallStatus}</Text>
        <View style={s.metaRow}>
          <Text style={s.metaText}>Niveau KYC : {kycLevel ?? '—'}{kycLevel != null ? '/3' : ''}</Text>
          <Text style={s.metaText}>Vérifié le : {verifiedAt ? new Date(verifiedAt).toLocaleDateString('fr-FR') : '—'}</Text>
        </View>
      </Card>

      {STEP_IDS.map((id) => {
        // documents is ordered created_at DESC by the backend, so the first
        // match for a given step is the most recent submission.
        const doc = documents.find((d) => d.document_type === id);
        const status = doc?.status ?? 'pending';
        return (
          <Card key={id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{STEP_LABELS[id]}</Text>
              <Text style={s.muted}>{doc ? status : 'non soumis'}{doc?.rejection_reason ? ` — ${doc.rejection_reason}` : ''}</Text>
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
              <Text style={s.btnText}>{busy === id ? '…' : doc?.status === 'rejected' ? 'Resoumettre' : 'Soumettre'}</Text>
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
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[2] },
  metaText: { color: colors.gray2, fontFamily: fonts.body, fontSize: fontSize.xs },
  card: { padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  muted: { color: colors.gray2, marginTop: 3, fontFamily: fonts.body, fontSize: fontSize.sm },
  btn: { backgroundColor: colors.gold, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full },
  btnText: { color: colors.dark, fontFamily: fonts.bodyBold },
});
