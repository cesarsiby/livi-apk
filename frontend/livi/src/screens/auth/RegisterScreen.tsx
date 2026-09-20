import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../features/auth/AuthProvider';
import type { UserRole } from '../../types/auth';

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

type RegisterRole = Exclude<UserRole, 'admin'>;

const ROLES: {
  key: RegisterRole;
  label: string;
  helper: string;
}[] = [
  {
    key: 'client',
    label: 'Acheteur',
    helper: 'Acheter et suivre vos commandes',
  },
  {
    key: 'vendor',
    label: 'Vendeur',
    helper: 'Vendre vos produits',
  },
  {
    key: 'transporter',
    label: 'Transporteur',
    helper: 'Transporter des colis',
  },
];

export function RegisterScreen({
  navigation,
}: any) {
  const { register } = useAuth();

  const [role, setRole] =
    useState<RegisterRole>('client');

  const [firstName, setFirstName] =
    useState('');
  const [lastName, setLastName] =
    useState('');
  const [phone, setPhone] =
    useState('');
  const [password, setPassword] =
    useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [accepted, setAccepted] =
    useState(false);
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

  function clearError() {
    if (error) {
      setError(undefined);
    }
  }

  async function submit() {
    const trimmedFirstName =
      firstName.trim();
    const trimmedLastName =
      lastName.trim();
    const trimmedPhone = phone.trim();

    if (
      !trimmedFirstName ||
      !trimmedLastName ||
      !/^\+?[0-9\s]{8,18}$/.test(
        trimmedPhone,
      )
    ) {
      setError(
        'Renseignez votre prénom, votre nom et un numéro de téléphone valide.',
      );
      return;
    }

    if (password.length < 10) {
      setError(
        'Le mot de passe doit contenir au moins 10 caractères.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        'Les deux mots de passe doivent être identiques.',
      );
      return;
    }

    if (!accepted) {
      setError(
        'Acceptez les conditions d’utilisation pour continuer.',
      );
      return;
    }

    setError(undefined);

    try {
      setLoading(true);

      await register({
        role,
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        phone: trimmedPhone,
        password,
        password_confirmation:
          confirmPassword,
      });
    } catch (e: any) {
      const message =
        e?.message ??
        'Impossible de créer le compte.';

      setError(message);

      Alert.alert(
        'Inscription',
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
        <ScrollView
          style={styles.flex}
          contentContainerStyle={
            styles.scroll
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <Animated.View
            style={[
              styles.content,
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
              <Text style={styles.eyebrow}>
                REJOINDRE LIVI
              </Text>

              <Text style={styles.title}>
                Créer votre compte
              </Text>

              <Text style={styles.subtitle}>
                Choisissez votre espace puis
                renseignez vos informations.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.section}>
                <Text
                  style={
                    styles.sectionLabel
                  }
                >
                  Votre espace
                </Text>

                <Text
                  style={
                    styles.sectionHint
                  }
                >
                  Ce choix détermine votre rôle
                  dans LIVI.
                </Text>

                <View
                  style={
                    styles.roleList
                  }
                >
                  {ROLES.map((item) => {
                    const active =
                      role === item.key;

                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => {
                          setRole(
                            item.key,
                          );
                          clearError();
                        }}
                        disabled={loading}
                        style={[
                          styles.roleCard,
                          active &&
                            styles.roleCardActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.roleMark,
                            active &&
                              styles.roleMarkActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleMarkText,
                              active &&
                                styles.roleMarkTextActive,
                            ]}
                          >
                            {item.label.charAt(
                              0,
                            )}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.roleCopy
                          }
                        >
                          <Text
                            style={[
                              styles.roleLabel,
                              active &&
                                styles.roleLabelActive,
                            ]}
                          >
                            {item.label}
                          </Text>

                          <Text
                            style={
                              styles.roleHelper
                            }
                          >
                            {item.helper}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.radio,
                            active &&
                              styles.radioActive,
                          ]}
                        >
                          {active ? (
                            <View
                              style={
                                styles.radioInner
                              }
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.section}>
                <Text
                  style={
                    styles.sectionLabel
                  }
                >
                  Vos informations
                </Text>

                <View
                  style={
                    styles.form
                  }
                >
                  <TextField
                    label="Prénom"
                    required
                    value={firstName}
                    onChangeText={(value) => {
                      setFirstName(
                        value,
                      );
                      clearError();
                    }}
                    placeholder="Votre prénom"
                    editable={!loading}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />

                  <TextField
                    label="Nom"
                    required
                    value={lastName}
                    onChangeText={(value) => {
                      setLastName(
                        value,
                      );
                      clearError();
                    }}
                    placeholder="Votre nom"
                    editable={!loading}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />

                  <TextField
                    label="Numéro de téléphone"
                    required
                    icon="📱"
                    value={phone}
                    onChangeText={(value) => {
                      setPhone(
                        value,
                      );
                      clearError();
                    }}
                    placeholder="+223 XX XX XX XX"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    editable={!loading}
                  />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.section}>
                <Text
                  style={
                    styles.sectionLabel
                  }
                >
                  Sécuriser votre compte
                </Text>

                <Text
                  style={
                    styles.sectionHint
                  }
                >
                  Utilisez au moins 10 caractères
                  pour votre mot de passe.
                </Text>

                <View
                  style={
                    styles.form
                  }
                >
                  <TextField
                    label="Mot de passe"
                    required
                    icon="🔒"
                    secureTextEntry
                    value={password}
                    onChangeText={(value) => {
                      setPassword(
                        value,
                      );
                      clearError();
                    }}
                    placeholder="10 caractères minimum"
                    editable={!loading}
                    textContentType="newPassword"
                    autoComplete="new-password"
                  />

                  <TextField
                    label="Confirmer le mot de passe"
                    required
                    icon="🔒"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={(value) => {
                      setConfirmPassword(
                        value,
                      );
                      clearError();
                    }}
                    placeholder="Répétez votre mot de passe"
                    editable={!loading}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    error={error}
                  />
                </View>
              </View>

              <Pressable
                onPress={() => {
                  setAccepted(
                    (current) =>
                      !current,
                  );
                  clearError();
                }}
                disabled={loading}
                style={styles.termsRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    accepted &&
                      styles.checkboxActive,
                  ]}
                >
                  {accepted ? (
                    <Text
                      style={
                        styles.checkboxMark
                      }
                    >
                      ✓
                    </Text>
                  ) : null}
                </View>

                <Text
                  style={styles.termsText}
                >
                  J’accepte les conditions
                  d’utilisation de LIVI.
                </Text>
              </Pressable>

              <Button
                title="Créer mon compte"
                onPress={() =>
                  void submit()
                }
                disabled={loading}
                loading={loading}
                size="lg"
                fullWidth
              />

              <Button
                title="J’ai déjà un compte"
                onPress={() =>
                  navigation.navigate(
                    'Login',
                  )
                }
                disabled={loading}
                variant="outline"
                size="lg"
                fullWidth
              />
            </View>

            <Text
              style={
                styles.footerNote
              }
            >
              L’ouverture du compte se fait
              directement avec votre numéro de
              téléphone et votre mot de passe.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[6],
  },

  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },

  header: {
    marginBottom: spacing[5],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.8,
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

  card: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[5],
    ...shadow.md,
  },

  section: {
    gap: spacing[3],
  },

  sectionLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  sectionHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  roleList: {
    gap: spacing[2],
  },

  roleCard: {
    minHeight: 72,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  roleCardActive: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldDim,
  },

  roleMark: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.dark5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleMarkActive: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  roleMarkText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  roleMarkTextActive: {
    color: colors.gold,
  },

  roleCopy: {
    flex: 1,
    minWidth: 0,
  },

  roleLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  roleLabelActive: {
    color: colors.textPrimary,
  },

  roleHelper: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 15,
    color: colors.textMuted,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioActive: {
    borderColor: colors.gold,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  form: {
    gap: spacing[4],
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.dark4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },

  checkboxMark: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  termsText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  footerNote: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[3],
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
