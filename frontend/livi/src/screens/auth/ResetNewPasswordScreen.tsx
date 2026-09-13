import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthProvider';
import { Button, Screen, TextField } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

// V54: new screen. Closes the "Forgot Password" flow end to end — previously
// ForgotPasswordScreen sent an OTP and navigated to VerifyOtp with
// `mode: 'password-reset'`, but nothing ever read that param and there was
// no screen to actually set a new password; the flow silently dead-ended.
// See POST /auth/password/reset (src/routes/auth.js) and
// resetPasswordWithOtp (src/services/auth.js).
export function ResetNewPasswordScreen({ route, navigation }: any) {
  const { phone, code } = route?.params ?? {};
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!phone || !code) return null;

  async function submit() {
    if (password.length < 10) {
      setError('10 caractères minimum.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setError(undefined);

    try {
      setLoading(true);
      await resetPassword(phone, code, password);
      Alert.alert('Mot de passe modifié', 'Vous pouvez maintenant vous connecter.', [
        { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
      ]);
    } catch (e: any) {
      // A wrong/expired code surfaces here too (the OTP is verified together
      // with setting the password — see VerifyOtpScreen) — send the person
      // back to request a fresh one rather than leaving them stuck retyping
      // a password against a code that can never succeed.
      Alert.alert('LIVI', e?.message ?? 'Impossible de modifier le mot de passe.', [
        { text: 'Recommencer', onPress: () => navigation.navigate('ForgotPassword') },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen centered>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Nouveau mot de passe</Text>
          <Text style={styles.cardSubtitle}>Pour le numéro {phone}</Text>
        </View>

        <View style={styles.cardBody}>
          <TextField
            label="Nouveau mot de passe"
            required
            icon="🔒"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="10 caractères minimum"
            editable={!loading}
            error={error}
          />
          <TextField
            label="Confirmer le mot de passe"
            required
            icon="🔒"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            placeholder="10 caractères minimum"
            editable={!loading}
          />

          <Button title={loading ? 'Enregistrement…' : 'Enregistrer'} onPress={submit} disabled={loading} loading={loading} size="lg" fullWidth />
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
