import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthProvider';
import { Button, Screen, TextField } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

// V-AUDIT (OTP/SMS removal from account opening — decision définitive):
// registration and login no longer use OTP at all (see RegisterScreen,
// LoginScreen, AuthProvider), so this screen's old login/register branches
// are unreachable dead code — removed rather than left in place, since an
// OTP-verify path that can silently open a session for a passwordless
// account is exactly the kind of backdoor the audit called out (see
// services/auth.js on the backend for the matching removal). This screen's
// one remaining, legitimate caller is ForgotPasswordScreen: enter the code
// sent for a password reset, then continue to ResetNewPasswordScreen.
export function VerifyOtpScreen({ route, navigation }: any) {
  const { phone } = route?.params ?? {};
  const { sendOtp } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    // Defensive: this screen has no meaning without a phone number to verify.
    if (!phone) navigation.goBack();
  }, [phone, navigation]);

  if (!phone) return null;

  function verify() {
    if (!/^\d{4,8}$/.test(code.trim())) {
      setError('Entrez le code OTP reçu par SMS.');
      return;
    }
    setError(undefined);
    // The OTP is verified and consumed together with setting the new
    // password on the next screen (one atomic backend call) rather than
    // here, since a code can only ever be consumed once — see
    // ResetNewPasswordScreen and POST /auth/password/reset.
    navigation.navigate('ResetNewPassword', { phone, code: code.trim() });
  }

  async function resend() {
    try {
      setLoading(true);
      await sendOtp(phone, 'password_reset');
      Alert.alert('Code envoyé', 'Un nouveau code OTP a été envoyé.');
    } catch (e: any) {
      Alert.alert('OTP', e?.message ?? 'Impossible de renvoyer le code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen centered>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Vérification</Text>
          <Text style={styles.cardSubtitle}>Code envoyé au {phone}</Text>
        </View>

        <View style={styles.cardBody}>
          <TextField
            label="Code OTP"
            required
            icon="🔒"
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={8}
            editable={!loading}
            error={error}
          />

          <Button title="Continuer" onPress={verify} disabled={loading} loading={loading} size="lg" fullWidth />
          <Button title="Renvoyer le code" onPress={resend} disabled={loading} variant="outline" size="md" fullWidth />
          <Button title="Modifier le numéro" onPress={() => navigation.goBack()} disabled={loading} variant="ghost" size="md" fullWidth />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: spacing[6],
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.gray,
    textAlign: 'center',
  },
  cardBody: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },
});
