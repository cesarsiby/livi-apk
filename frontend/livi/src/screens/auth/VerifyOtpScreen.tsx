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

export function VerifyOtpScreen({
  route,
  navigation,
}: any) {
  const { phone } =
    route?.params ?? {};

  const { sendOtp } = useAuth();

  const [code, setCode] =
    useState('');
  const [loading, setLoading] =
    useState(false);
  const [resending, setResending] =
    useState(false);
  const [error, setError] =
    useState<string | undefined>();

  const entrance = useRef(
    new Animated.Value(0),
  ).current;

  useEffect(() => {
    if (!phone) {
      navigation.goBack();
      return;
    }

    Animated.timing(entrance, {
      toValue: 1,
      duration: 460,
      useNativeDriver: true,
    }).start();
  }, [
    phone,
    navigation,
    entrance,
  ]);

  if (!phone) {
    return null;
  }

  const verify = () => {
    const value = code.trim();

    if (!/^\d{4,8}$/.test(value)) {
      setError(
        'Entrez le code reçu par SMS.',
      );
      return;
    }

    setError(undefined);

    navigation.navigate(
      'ResetNewPassword',
      {
        phone,
        code: value,
      },
    );
  };

  async function resend() {
    if (resending) return;

    try {
      setResending(true);
      setError(undefined);

      await sendOtp(
        phone,
        'password_reset',
      );

      Alert.alert(
        'Code envoyé',
        'Un nouveau code OTP a été envoyé.',
      );
    } catch (e: any) {
      const message =
        e?.message ??
        'Impossible de renvoyer le code.';

      setError(message);

      Alert.alert(
        'Vérification',
        message,
      );
    } finally {
      setResending(false);
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
              disabled={
                loading || resending
              }
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
                style={styles.stepText}
              >
                ÉTAPE 1 / 2
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View
              style={
                styles.codeBadge
              }
            >
              <Text
                style={
                  styles.codeBadgeText
                }
              >
                OTP
              </Text>
            </View>

            <Text style={styles.eyebrow}>
              VÉRIFICATION
            </Text>

            <Text style={styles.title}>
              Vérifiez votre numéro
            </Text>

            <Text style={styles.subtitle}>
              Saisissez le code envoyé au
              {' '}{phone}.
            </Text>

            <View style={styles.form}>
              <TextField
                label="Code reçu par SMS"
                required
                icon="🔒"
                value={code}
                onChangeText={(value) => {
                  const digits =
                    value
                      .replace(
                        /\D/g,
                        '',
                      )
                      .slice(0, 8);

                  setCode(digits);

                  if (error) {
                    setError(
                      undefined,
                    );
                  }
                }}
                placeholder="000000"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={8}
                editable={
                  !loading &&
                  !resending
                }
                error={error}
                returnKeyType="done"
                onSubmitEditing={verify}
              />

              <Button
                title="Continuer"
                onPress={verify}
                disabled={
                  loading ||
                  resending
                }
                loading={loading}
                size="lg"
                fullWidth
              />

              <Pressable
                onPress={() =>
                  void resend()
                }
                disabled={
                  loading ||
                  resending
                }
                style={
                  styles.resendButton
                }
              >
                {resending ? (
                  <Text
                    style={
                      styles.resendText
                    }
                  >
                    Envoi du code…
                  </Text>
                ) : (
                  <Text
                    style={
                      styles.resendText
                    }
                  >
                    Renvoyer le code
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={styles.infoBox}>
              <View
                style={styles.infoDot}
              />

              <Text
                style={styles.infoText}
              >
                Ce code est utilisé
                uniquement pour la
                réinitialisation du mot de
                passe.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() =>
              navigation.goBack()
            }
            disabled={
              loading || resending
            }
            style={styles.footer}
          >
            <Text
              style={
                styles.footerText
              }
            >
              ← Modifier le numéro
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

  stepText: {
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

  codeBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },

  codeBadgeText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
    letterSpacing: 0.5,
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
    lineHeight: 31,
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

  resendButton: {
    minHeight: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
  },

  resendText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
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

  footer: {
    alignSelf: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginTop: spacing[3],
  },

  footerText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
