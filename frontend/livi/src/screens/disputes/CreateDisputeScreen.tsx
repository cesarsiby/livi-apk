import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { disputesApi } from '../../features/disputes/disputesApi';
import { Button } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

type Props = { navigation: any; route: any };

export function CreateDisputeScreen({ navigation, route }: Props) {
  const orderId = String(route.params?.orderId ?? '');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!orderId || !reason.trim() || !description.trim()) { setError('Commande, motif et description sont obligatoires.'); return; }
    try {
      setSubmitting(true); setError(null);
      const dispute = await disputesApi.create({ order_id: orderId, reason: `${reason.trim()}\n\n${description.trim()}` });
      navigation.replace('DisputeDetails', { disputeId: dispute.id });
    } catch (e: any) { setError(e?.message ?? "Impossible d'ouvrir le litige."); }
    finally { setSubmitting(false); }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ouvrir un litige</Text>
      <Text style={styles.label}>Commande</Text>
      <Text style={styles.value}>{orderId || 'Non définie'}</Text>
      <Text style={styles.label}>Motif</Text>
      <TextInput value={reason} onChangeText={setReason} style={styles.input} placeholder="Motif du litige" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Description</Text>
      <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.textarea]} multiline placeholder="Décrivez précisément le problème" placeholderTextColor={colors.textMuted} />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={submitting ? 'Envoi…' : 'Envoyer le litige'} onPress={submit} disabled={submitting} loading={submitting} fullWidth size="lg" style={{ marginTop: spacing[5] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing[5], backgroundColor: colors.dark },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary, marginBottom: spacing[6] },
  label: { fontFamily: fonts.bodySemibold, color: colors.textSecondary, marginTop: spacing[4], marginBottom: spacing[2] },
  value: { color: colors.gray, fontFamily: fonts.body },
  input: { backgroundColor: colors.dark3, borderRadius: radius.md, padding: spacing[3], borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontFamily: fonts.body },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  error: { color: colors.red, marginTop: spacing[3], fontFamily: fonts.body },
});
