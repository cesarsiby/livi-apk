import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../features/auth/AuthProvider';

import {
  Button,
  Screen,
  TextField,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
  shadow,
} from '../../design/theme';

export function LoginScreen({
  navigation,
}: any) {
  const { login } = useAuth();

  const [phone, setPhone] =
    useState('');
  const [password, setPassword] =
    useState('');
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState<string | undefined>();

  const entrance = useRef(
    new Animated.Value(0),
  ).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 480,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  async function submit() {
    const value = phone.trim();

    if (
      !/^\+?[0-9\s]{8,18}$/.test(
        value,
      )
    ) {
      setError(
        'Veuillez entrer un numéro de téléphone valide.',
      );
      return;
    }

    if (!password) {
      setError(
        'Veuillez entrer votre mot de passe.',
      );
      return;
    }

    setError(undefined);

    try {
      setLoading(true);
      await login(value, password);
    } catch (e: any) {
      const message =
        e?.message ??
        'Identifiants invalides.';

      setError(message);

      Alert.alert(
        'Connexion',
        message,
      );
    } finally {
      setLoading(false);
    }
  }

  const translateY =
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [18, 0],
    });

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.flex}>
          <Animated.View
            style={[
              styles.container,
              {
                opacity: entrance,
                transform: [
                  {
                    translateY,
                  },
                ],
              },
            ]}
          >
            <View style={styles.logoBlock}>
              <Image
                source={require('../../../assets/branding/livi-logo-on-dark.png')}
                style={styles.logo}
                resizeMode="contain"
                accessible
                accessibilityLabel="Logo LIVI — Relier l'Afrique, un colis à la fois"
              />

              <View
                style={styles.brandLine}
              >
                <View
                  style={styles.brandDot}
                />
                <Text
                  style={styles.brandText}
                >
                  RELIER L'AFRIQUE,
                  UN COLIS À LA FOIS.
                </Text>
                <View
                  style={styles.brandDot}
                />
              </View>
            </View>

            <View style={styles.card}>
              <View
                style={
                  styles.cardHeader
                }
              >
                <Text
                  style={styles.eyebrow}
                >
                  ESPACE CLIENT
                </Text>

                <Text
                  style={styles.title}
                >
                  Bon retour.
                </Text>

                <Text
                  style={styles.subtitle}
                >
                  Connectez-vous pour
                  retrouver vos commandes,
                  votre wallet et vos
                  échanges.
                </Text>
              </View>

              <View
                style={styles.cardBody}
              >
                <TextField
                  label="Numéro de téléphone"
                  required
                  icon="📱"
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(value);
                    if (error) {
                      setError(undefined);
                    }
                  }}
                  placeholder="+223 XX XX XX XX"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  editable={!loading}
                  returnKeyType="next"
                />

                <TextField
                  label="Mot de passe"
                  required
                  icon="🔒"
                  secureTextEntry
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (error) {
                      setError(undefined);
                    }
                  }}
                  placeholder="Votre mot de passe"
                  textContentType="password"
                  autoComplete="password"
                  editable={!loading}
                  error={error}
                  returnKeyType="done"
                  onSubmitEditing={() =>
                    void submit()
                  }
                />

                <Pressable
                  onPress={() =>
                    !loading &&
                    navigation.navigate(
                      'ForgotPassword',
                    )
                  }
                  disabled={loading}
                  style={styles.forgotButton}
                >
                  <Text
                    style={
                      styles.forgotText
                    }
                  >
                    Mot de passe oublié ?
                  </Text>
                </Pressable>

                <Button
                  title="Se connecter"
                  onPress={() =>
                    void submit()
                  }
                  disabled={loading}
                  loading={loading}
                  size="lg"
                  fullWidth
                />

                <View
                  style={styles.divider}
                >
                  <View
                    style={
                      styles.dividerLine
                    }
                  />
                  <Text
                    style={
                      styles.dividerText
                    }
                  >
                    Nouveau sur LIVI ?
                  </Text>
                  <View
                    style={
                      styles.dividerLine
                    }
                  />
                </View>

                <Button
                  title="Créer un compte"
                  onPress={() =>
                    navigation.navigate(
                      'Register',
                    )
                  }
                  disabled={loading}
                  variant="outline"
                  size="lg"
                  fullWidth
                />
              </View>
            </View>

            <Text
              style={styles.securityNote}
            >
              Vos identifiants sont traités par
              le système d’authentification LIVI.
            </Text>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[6],
  },

  logoBlock: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },

  logo: {
    width: '100%',
    maxWidth: 290,
    height: 92,
  },

  brandLine: {
    marginTop: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  brandDot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  brandText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.15,
    color: colors.textMuted,
    textAlign: 'center',
  },

  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.md,
  },

  cardHeader: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
    marginBottom: spacing[2],
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  cardBody: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },

  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[1],
  },

  forgotText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginVertical: spacing[1],
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  dividerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.3,
    color: colors.textMuted,
  },

  securityNote: {
    maxWidth: 420,
    alignSelf: 'center',
    marginTop: spacing[4],
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
