import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { transporterApi } from '../../features/transporter/transporterApi';
import { Button, Card, TextField } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

// V54 (RAPPORT section 16 — "VÉHICULE TRANSPORTEUR"): new screen, previously
// missing. `transporters` (backend/livi/migrations/001_initial.sql) only
// ever gained two vehicle-related columns: vehicle_type and vehicle_plate —
// no brand/model column exists anywhere in the 37 migrations, so this screen
// intentionally doesn't show brand/model fields rather than inventing data
// the backend can't store. Document proof (carte grise) is handled by the
// KYC screen instead, since that's what actually goes through admin review.
export function VehicleScreen({ navigation }: any) {
  const [type, setType] = useState('');
  const [plate, setPlate] = useState('');
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    transporterApi.profile()
      .then((p) => { setType(p.vehicle_type ?? ''); setPlate(p.vehicle_plate ?? ''); setKycStatus(p.kyc_status ?? null); })
      .catch((e: any) => Alert.alert('Véhicule', e?.message ?? 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save() {
    setSaving(true);
    try {
      await transporterApi.updateVehicle({ vehicle_type: type.trim(), vehicle_plate: plate.trim() });
      Alert.alert('Véhicule', 'Informations enregistrées.');
    } catch (e: any) {
      Alert.alert('Véhicule', e?.message ?? "Échec de l'enregistrement.");
    } finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mon véhicule</Text>
      <Text style={styles.info}>Le type et la plaque sont les seules informations véhicule gérées par LIVI aujourd'hui.</Text>

      <Card style={styles.status} padded>
        <Text style={styles.label}>Statut KYC véhicule</Text>
        <Text style={styles.value}>{kycStatus ?? '—'}</Text>
      </Card>

      <TextField label="Type de véhicule" value={type} onChangeText={setType} placeholder="Moto, tricycle, camionnette…" />
      <TextField label="Plaque d'immatriculation" value={plate} onChangeText={setPlate} placeholder="AB-1234" autoCapitalize="characters" />

      <Button title={saving ? 'Enregistrement…' : 'Enregistrer'} onPress={save} disabled={saving} loading={saving} size="lg" fullWidth />
      <Button title="Documents véhicule (KYC)" onPress={() => navigation.navigate('KYC')} variant="outline" size="md" fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  container: { padding: spacing[4], gap: spacing[3] },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  info: { color: colors.gray, lineHeight: 21, fontFamily: fonts.body, fontSize: fontSize.sm },
  status: { gap: spacing[1] },
  label: { color: colors.textMuted, fontFamily: fonts.body },
  value: { fontSize: fontSize.xl, fontFamily: fonts.brandSemibold, marginTop: 5, color: colors.gold },
});
