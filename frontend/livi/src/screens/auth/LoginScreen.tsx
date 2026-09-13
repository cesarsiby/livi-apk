import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthProvider';
import { Button, Screen, TextField } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // V-AUDIT (OTP/SMS removal from account opening — decision définitive):
  // login is now phone + password, no OTP. Previously this sent an OTP and
  // navigated to VerifyOtpScreen to actually authenticate; AuthProvider.login()
  // now authenticates and stores the session directly, and RootNavigator
  // swaps away from the auth stack on its own once that session is set —
  // nothing to navigate to here, same as registration.
  async function submit() {
    const value = phone.trim();
    if (!/^\+?[0-9\s]{8,18}$/.test(value)) {
      setError('Veuillez entrer un numéro de téléphone valide.');
      return;
    }
    if (!password) {
      setError('Veuillez entrer votre mot de passe.');
      return;
    }
    setError(undefined);

    try {
      setLoading(true);
      await login(value, password);
    } catch (e: any) {
      Alert.alert('Connexion', e?.message ?? 'Identifiants invalides.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen centered>
      <View style={styles.header}>
        <Image
          source={require('../../../assets/branding/livi-logo-on-dark.png')}
          style={styles.logo}
          resizeMode="contain"
          accessible
          accessibilityLabel="Logo LIVI — Relier l'Afrique, un colis à la fois"
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Connexion</Text>
          <Text style={styles.cardSubtitle}>Téléphone et mot de passe</Text>
        </View>

        <View style={styles.cardBody}>
          <TextField
            label="Numéro de téléphone"
            required
            icon="📱"
            value={phone}
            onChangeText={setPhone}
            placeholder="+223 XX XX XX XX"
            keyboardType="phone-pad"
            autoComplete="tel"
            editable={!loading}
          />
          <TextField
            label="Mot de passe"
            required
            icon="🔒"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Votre mot de passe"
            editable={!loading}
            error={error}
          />

          <Button
            title={loading ? 'Connexion…' : 'Se connecter →'}
            onPress={submit}
            disabled={loading}
            loading={loading}
            size="lg"
            fullWidth
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.registerLink} onPress={() => !loading && navigation.navigate('ForgotPassword')}>Mot de passe oublié ?</Text>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Pas encore de compte ? </Text>
            <Text
              style={styles.registerLink}
              onPress={() => !loading && navigation.navigate('Register')}
            >
              Créer un compte gratuit
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  logo: {
    width: '100%',
    maxWidth: 320,
    height: 130,
  },
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
    borderBottomWidth: 0,
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
  },
  cardBody: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[5],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  registerText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.gray,
  },
  registerLink: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
