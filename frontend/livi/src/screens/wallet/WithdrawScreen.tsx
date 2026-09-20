import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { walletApi } from '../../features/wallet/walletApi';
import { useWalletStore } from '../../features/wallet/walletStore';
import { Button, Card } from '../../design/components';
import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

function parseAmount(value: string) {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  return Number(normalized);
}

export function WithdrawScreen({ navigation }: any) {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);

  const { refresh } = useWalletStore();

  async function submit() {
    const numericAmount = parseAmount(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert(
        'Montant invalide',
        'Saisissez un montant de retrait valide.',
      );
      return;
    }

    try {
      setBusy(true);

      const result = await walletApi.requestWithdrawal({
        amount: numericAmount,
        destination: destination.trim() || undefined,
      });

      await refresh();

      setAmount('');
      setDestination('');

      Alert.alert(
        'Demande envoyée',
        result.reference
          ? `Référence : ${result.reference}`
          : 'La demande a été reçue par le serveur.',
        [
          {
            text: 'Voir mes retraits',
            onPress: () =>
              navigation.navigate('WithdrawalDetails'),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Retrait refusé',
        error?.message ??
          'Le serveur n’a pas accepté la demande de retrait.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>WALLET LIVI</Text>
          <Text style={styles.title}>Retirer des fonds</Text>
          <Text style={styles.subtitle}>
            Demande de retrait sécurisée
          </Text>
        </View>

        <Card style={styles.infoCard}>
          <View style={styles.secureRow}>
            <View style={styles.secureDot} />
            <View style={styles.secureCopy}>
              <Text style={styles.infoTitle}>
                Traitement côté serveur
              </Text>
              <Text style={styles.infoText}>
                LIVI envoie directement la demande au backend. Aucun solde
                local n’est modifié par l’interface.
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.formSection}>
          <Text style={styles.label}>Montant</Text>

          <View style={styles.amountField}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              editable={!busy}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={styles.amountInput}
            />
            <Text style={styles.currency}>FCFA</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>
            Référence de destination
          </Text>

          <TextInput
            value={destination}
            onChangeText={setDestination}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Identifiant si requis"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.helper}>
            Laissez vide si le contrat de retrait du compte n’exige pas de
            référence complémentaire.
          </Text>
        </View>

        <Button
          title={busy ? 'Envoi en cours…' : 'Envoyer la demande'}
          onPress={submit}
          disabled={busy}
          loading={busy}
          fullWidth
          size="lg"
        />

        <Button
          title="Voir mes retraits"
          onPress={() =>
            navigation.navigate('WithdrawalDetails')
          }
          disabled={busy}
          variant="outline"
          fullWidth
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
    gap: spacing[5],
  },

  header: {
    gap: spacing[1],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.6,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  infoCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  secureRow: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },

  secureDot: {
    width: 9,
    height: 9,
    marginTop: 6,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },

  secureCopy: {
    flex: 1,
    gap: spacing[1],
  },

  infoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  infoText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  formSection: {
    gap: spacing[2],
  },

  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  amountField: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
  },

  amountInput: {
    flex: 1,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
    paddingVertical: spacing[3],
  },

  currency: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  helper: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },
});
