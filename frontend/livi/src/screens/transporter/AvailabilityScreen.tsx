import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { transporterApi } from '../../features/transporter/transporterApi';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

const OPTIONS = [
  { value: 'available', label: 'Disponible' },
  { value: 'unavailable', label: 'Indisponible' },
  { value: 'paused', label: 'En pause' },
];

export function AvailabilityScreen() {
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    transporterApi.dashboard().then((data) => setCurrent(String(data?.availability?.status ?? data?.status ?? ''))).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  async function change(value: string) {
    try { setBusy(true); const result = await transporterApi.setAvailability(value); setCurrent(String(result?.availability?.status ?? result?.status ?? value)); }
    catch (e: any) { Alert.alert('Disponibilité', e?.message ?? 'La modification a été refusée.'); }
    finally { setBusy(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Disponibilité</Text>
      <Text style={styles.note}>Le statut est enregistré par le backend LIVI.</Text>
      {OPTIONS.map((option) => (
        <Pressable key={option.value} disabled={busy} onPress={() => change(option.value)} style={[styles.option, current === option.value && styles.active]}>
          <Text style={[styles.label, current === option.value && styles.activeText]}>{option.label}</Text>
          {current === option.value ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  container: { flex: 1, padding: spacing[5], gap: spacing[3], backgroundColor: colors.dark },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  note: { color: colors.gray, marginBottom: spacing[3], fontFamily: fonts.body },
  option: { backgroundColor: colors.dark3, borderRadius: radius.xl, padding: spacing[5], flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border },
  active: { backgroundColor: colors.gold, borderColor: colors.gold },
  label: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  activeText: { color: colors.dark },
  check: { color: colors.dark, fontFamily: fonts.bodyBold },
});
