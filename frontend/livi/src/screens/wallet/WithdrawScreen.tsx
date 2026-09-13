import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { walletApi } from '../../features/wallet/walletApi';
import { useWalletStore } from '../../features/wallet/walletStore';
import { Button } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function WithdrawScreen({ navigation }: any) {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const { refresh } = useWalletStore();

  async function submit() {
    const numericAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert('Retrait', 'Saisissez un montant valide.');
      return;
    }
    try {
      setBusy(true);
      const result = await walletApi.requestWithdrawal({ amount: numericAmount, destination: destination.trim() || undefined });
      await refresh();
      setAmount(''); setDestination('');
      Alert.alert(
        'Demande envoyée',
        result.reference ? `Référence : ${result.reference}` : 'La demande a été acceptée par le serveur.',
        [{ text: 'Voir les retraits', onPress: () => navigation.navigate('WithdrawalDetails') }],
      );
    } catch (e: any) {
      Alert.alert('Retrait refusé', e?.message ?? 'Le serveur a refusé la demande.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Demander un retrait</Text>
      <Text style={styles.note}>La demande est envoyée au backend. Aucun solde n'est modifié localement.</Text>

      <Text style={styles.label}>Montant</Text>
      <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Montant" placeholderTextColor={colors.textMuted} style={styles.input} editable={!busy} />

      <Text style={styles.label}>Destination (si requise par le contrat backend)</Text>
      <TextInput value={destination} onChangeText={setDestination} placeholder="Identifiant de destination" placeholderTextColor={colors.textMuted} style={styles.input} editable={!busy} autoCapitalize="none" />

      <Button title={busy ? 'Envoi…' : 'Envoyer la demande'} onPress={submit} disabled={busy} loading={busy} fullWidth size="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing[5], gap: spacing[3], backgroundColor: colors.dark },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  label: { fontFamily: fonts.bodySemibold, color: colors.textSecondary, marginTop: spacing[2] },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[4], backgroundColor: colors.dark3, color: colors.textPrimary, fontFamily: fonts.body },
  note: { color: colors.gray, lineHeight: 18, fontFamily: fonts.body, fontSize: fontSize.sm },
});
