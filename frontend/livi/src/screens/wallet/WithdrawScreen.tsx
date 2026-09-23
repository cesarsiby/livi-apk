import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { walletApi } from '../../features/wallet/walletApi';
import { useWalletStore } from '../../features/wallet/walletStore';
import { Button, Card, Screen } from '../../design/components';
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

function formatAmount(value: string) {
  const digits = value.replace(/[^\d]/g, '');

  if (!digits) return '';

  return new Intl.NumberFormat('fr-FR').format(Number(digits));
}

export function WithdrawScreen({ navigation }: any) {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { refresh } = useWalletStore();
  const entrance = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const numericAmount = useMemo(
    () => parseAmount(amount),
    [amount],
  );

  const amountValid =
    Number.isFinite(numericAmount) && numericAmount > 0;

  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const submit = useCallback(async () => {
    setError('');

    if (!amountValid) {
      setError('Saisissez un montant de retrait valide.');
      return;
    }

    setBusy(true);

    try {
      const result = await walletApi.requestWithdrawal({
        amount: numericAmount,
        destination: destination.trim() || undefined,
      });

      await refresh();

      setAmount('');
      setDestination('');

      navigation.navigate('WithdrawalDetails', {
        withdrawalId: result?.id,
      });
    } catch (e: any) {
      setError(
        e?.message ??
          'Le serveur n’a pas accepté la demande de retrait.',
      );
    } finally {
      setBusy(false);
    }
  }, [
    amountValid,
    destination,
    navigation,
    numericAmount,
    refresh,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: entrance,
              transform: [{ translateY }],
            }}
          >
            <View style={styles.header}>
              <Text style={styles.eyebrow}>WALLET LIVI</Text>
              <Text style={styles.title}>Retirer des fonds</Text>
              <Text style={styles.subtitle}>
                Demande de retrait sécurisée
              </Text>
            </View>

            <Card style={styles.infoCard} padded>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Text style={styles.infoIconText}>✓</Text>
                </View>

                <View style={styles.infoCopy}>
                  <Text style={styles.infoTitle}>
                    Traitement côté serveur
                  </Text>
                  <Text style={styles.infoText}>
                    La demande est envoyée directement au backend. Aucun
                    solde local n’est modifié par cette interface.
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Montant du retrait</Text>
                  {amountValid ? (
                    <Text style={styles.validLabel}>Valide</Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.amountField,
                    error && !amountValid
                      ? styles.fieldError
                      : null,
                    amountValid ? styles.fieldValid : null,
                  ]}
                >
                  <TextInput
                    value={amount}
                    onChangeText={(value) => {
                      setError('');
                      const formatted = formatAmount(value);
                      setAmount(formatted);
                    }}
                    editable={!busy}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={styles.amountInput}
                    maxLength={14}
                    accessibilityLabel="Montant du retrait"
                  />

                  <Text style={styles.currency}>FCFA</Text>
                </View>

                <Text style={styles.helper}>
                  Indiquez le montant à transmettre au serveur.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Référence de destination
                </Text>

                <TextInput
                  value={destination}
                  onChangeText={(value) => {
                    setError('');
                    setDestination(value);
                  }}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Identifiant si requis"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  accessibilityLabel="Référence de destination"
                />

                <Text style={styles.helper}>
                  Laissez vide si le contrat de retrait n’exige pas de
                  référence complémentaire.
                </Text>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <View style={styles.errorMark}>
                    <Text style={styles.errorMarkText}>!</Text>
                  </View>

                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.actions}>
              <Button
                title={
                  busy
                    ? 'Envoi en cours…'
                    : 'Envoyer la demande'
                }
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
            </View>

            <Pressable
              onPress={() => navigation.goBack()}
              disabled={busy}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>
                Retour
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
  },

  header: {
    gap: spacing[1],
    marginBottom: spacing[5],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  infoCard: {
    marginBottom: spacing[6],
    backgroundColor: colors.dark2,
    borderColor: colors.goldBorder,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },

  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  infoCopy: {
    flex: 1,
    gap: spacing[1],
  },

  infoTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  infoText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  form: {
    gap: spacing[6],
  },

  fieldGroup: {
    gap: spacing[2],
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  validLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.gold2,
  },

  amountField: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
  },

  fieldValid: {
    borderColor: colors.goldBorder,
  },

  fieldError: {
    borderColor: colors.redBorder,
  },

  amountInput: {
    flex: 1,
    paddingVertical: spacing[3],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
  },

  currency: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  input: {
    minHeight: 56,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.base,
  },

  helper: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  errorBox: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },

  errorMark: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorMarkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.red,
  },

  errorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  actions: {
    marginTop: spacing[6],
    gap: spacing[3],
  },

  backLink: {
    alignSelf: 'center',
    marginTop: spacing[4],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },

  backLinkText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
