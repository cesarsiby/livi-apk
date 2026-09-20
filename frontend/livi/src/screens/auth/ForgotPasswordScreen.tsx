import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
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
  shadow,
  spacing,
} from '../../design/theme';

export function ForgotPasswordScreen({
  navigation,
}: any) {
  const { sendOtp } = useAuth();

  const [phone, setPhone] =
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
      duration: 460,
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

    setError(undefined);

    try {
      setLoading(true);

      await sendOtp(
        value,
        'password_reset',
      );

      navigation.navigate(
        'VerifyOtp',
        {
          phone: value,
          mode: 'password-reset',
        },
      );
    } catch (e: any) {
      const message =
        e?.message ??
        'Impossible d’envoyer le code.';

      setError(message);

      Alert.alert(
        'Réinitialisation',
        message,
      );
    } finally {
      setLoading(false);
    }
  }

  const translateY =
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 0],
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
        <View
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
          <View style={styles.header}>
            <Pressable
              onPress={() =>
                navigation.goBack()
              }
              disabled={loading}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Retour"
            >
              <Text style={styles.backIcon}>
                ‹
              </Text>
            </Pressable>

            <View style={styles.stepPill}>
              <Text
                style={styles.stepPillText}
              >
                SÉCURITÉ
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View
              style={
                styles.iconContainer
              }
            >
              <Text
                style={styles.iconMark}
              >
                •
              </Text>
            </View>

            <Text style={styles.eyebrow}>
              ACCÈS AU COMPTE
            </Text>

            <Text style={styles.title}>
              Mot de passe oublié ?
            </Text>

            <Text style={styles.subtitle}>
              Entrez le numéro associé à votre
              compte. Un code de réinitialisation
              vous sera envoyé.
            </Text>

            <View style={styles.form}>
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
                error={error}
                returnKeyType="done"
                onSubmitEditing={() =>
                  void submit()
                }
              />

              <Button
                title="Recevoir le code"
                onPress={() =>
                  void submit()
                }
                disabled={loading}
                loading={loading}
                size="lg"
                fullWidth
              />
            </View>

            <View
              style={styles.infoBox}
            >
              <View
                style={styles.infoDot}
              />

              <Text
                style={styles.infoText}
              >
                Le code sert uniquement à
                réinitialiser votre mot de passe.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() =>
              !loading &&
              navigation.goBack()
            }
            disabled={loading}
            style={styles.footerAction}
          >
            <Text
              style={styles.footerActionText}
            >
              ← Retour à la connexion
            </Text>
          </Pressable>
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

  header: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backIcon: {
    marginTop: -3,
    fontFamily: fonts.body,
    fontSize: 30,
    lineHeight: 30,
    color: colors.textPrimary,
  },

  stepPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  stepPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.gold,
  },

  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },

  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },

  iconMark: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.gold,
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
    fontSize: fontSize['2xl'],
    lineHeight: 30,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  form: {
    marginTop: spacing[5],
    gap: spacing[4],
  },

  infoBox: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },

  infoDot: {
    width: 7,
    height: 7,
    marginTop: 5,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  infoText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textMuted,
  },

  footerAction: {
    alignSelf: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginTop: spacing[3],
  },

  footerActionText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
