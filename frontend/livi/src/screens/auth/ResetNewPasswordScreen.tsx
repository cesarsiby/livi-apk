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

export function ResetNewPasswordScreen({
  route,
  navigation,
}: any) {
  const { phone, code } =
    route?.params ?? {};

  const { resetPassword } =
    useAuth();

  const [password, setPassword] =
    useState('');
  const [confirm, setConfirm] =
    useState('');
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState<string | undefined>();

  const entrance = useRef(
    new Animated.Value(0),
  ).current;

  useEffect(() => {
    if (!phone || !code) {
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
    code,
    navigation,
    entrance,
  ]);

  if (!phone || !code) {
    return null;
  }

  function validate() {
    if (password.length < 10) {
      setError(
        'Le mot de passe doit contenir au moins 10 caractères.',
      );
      return false;
    }

    if (password !== confirm) {
      setError(
        'Les deux mots de passe doivent être identiques.',
      );
      return false;
    }

    setError(undefined);
    return true;
  }

  async function submit() {
    if (!validate()) return;

    try {
      setLoading(true);

      await resetPassword(
        phone,
        code,
        password,
      );

      Alert.alert(
        'Mot de passe modifié',
        'Votre nouveau mot de passe est enregistré. Vous pouvez maintenant vous connecter.',
        [
          {
            text: 'Se connecter',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'Login',
                  },
                ],
              }),
          },
        ],
      );
    } catch (e: any) {
      const message =
        e?.message ??
        'Impossible de modifier le mot de passe.';

      setError(message);

      Alert.alert(
        'Réinitialisation',
        message,
        [
          {
            text: 'Recommencer',
            onPress: () =>
              navigation.navigate(
                'ForgotPassword',
              ),
          },
          {
            text: 'Fermer',
            style: 'cancel',
          },
        ],
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
                style={styles.stepText}
              >
                ÉTAPE 2 / 2
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View
              style={
                styles.successMark
              }
            >
              <Text
                style={
                  styles.successMarkText
                }
              >
                ✓
              </Text>
            </View>

            <Text style={styles.eyebrow}>
              NOUVEAUX IDENTIFIANTS
            </Text>

            <Text style={styles.title}>
              Créez un nouveau mot de passe
            </Text>

            <Text style={styles.subtitle}>
              Choisissez un mot de passe
              personnel d’au moins 10
              caractères pour sécuriser votre
              compte.
            </Text>

            <View style={styles.accountPill}>
              <Text
                style={styles.accountLabel}
              >
                NUMÉRO
              </Text>
              <Text
                style={styles.accountValue}
                numberOfLines={1}
              >
                {phone}
              </Text>
            </View>

            <View style={styles.form}>
              <TextField
                label="Nouveau mot de passe"
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
                placeholder="10 caractères minimum"
                editable={!loading}
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="next"
              />

              <TextField
                label="Confirmer le mot de passe"
                required
                icon="🔒"
                secureTextEntry
                value={confirm}
                onChangeText={(value) => {
                  setConfirm(value);
                  if (error) {
                    setError(undefined);
                  }
                }}
                placeholder="Répétez votre mot de passe"
                editable={!loading}
                textContentType="newPassword"
                autoComplete="new-password"
                error={error}
                returnKeyType="done"
                onSubmitEditing={() =>
                  void submit()
                }
              />

              <Button
                title="Enregistrer le mot de passe"
                onPress={() =>
                  void submit()
                }
                disabled={loading}
                loading={loading}
                size="lg"
                fullWidth
              />
            </View>

            <View style={styles.securityBox}>
              <View
                style={
                  styles.securityIcon
                }
              >
                <Text
                  style={
                    styles.securityIconText
                  }
                >
                  •
                </Text>
              </View>

              <View
                style={
                  styles.securityCopy
                }
              >
                <Text
                  style={styles.securityTitle}
                >
                  Réinitialisation sécurisée
                </Text>

                <Text
                  style={styles.securityText}
                >
                  Le code de récupération et le
                  nouveau mot de passe sont
                  traités par le serveur LIVI.
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() =>
              !loading &&
              navigation.navigate(
                'ForgotPassword',
              )
            }
            disabled={loading}
            style={styles.footer}
          >
            <Text
              style={styles.footerText}
            >
              Recommencer la récupération
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

  successMark: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },

  successMarkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.green,
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

  accountPill: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  accountLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.textMuted,
  },

  accountValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  form: {
    marginTop: spacing[5],
    gap: spacing[4],
  },

  securityBox: {
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

  securityIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  securityIconText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  securityCopy: {
    flex: 1,
    gap: spacing[1],
  },

  securityTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  securityText: {
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
