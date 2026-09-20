import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { profileApi } from '../../features/profile/profileApi';
import type { SecuritySession } from '../../features/profile/types';
import { useAuth } from '../../features/auth/AuthProvider';

import {
  Button,
  EmptyState,
  Skeleton,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

function SecurityField({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TextInput
        secureTextEntry
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

function SessionCard({
  session,
  onRevoke,
}: {
  session: SecuritySession;
  onRevoke: () => void;
}) {
  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <View style={styles.deviceIcon}>
          <Text style={styles.deviceIconText}>
            {session.current ? '✓' : '•'}
          </Text>
        </View>

        <View style={styles.deviceContent}>
          <Text style={styles.deviceName}>
            {session.device_name ?? 'Appareil'}
          </Text>

          <View style={styles.sessionStatusRow}>
            <View
              style={[
                styles.statusDot,
                session.current &&
                  styles.statusDotActive,
              ]}
            />

            <Text style={styles.sessionStatus}>
              {session.current
                ? 'Session actuelle'
                : 'Autre session'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sessionMeta}>
        {session.last_used_at ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>
              Dernière activité
            </Text>

            <Text style={styles.metaValue}>
              {new Date(
                session.last_used_at,
              ).toLocaleString('fr-FR')}
            </Text>
          </View>
        ) : null}

        {session.created_at ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>
              Créée le
            </Text>

            <Text style={styles.metaValue}>
              {new Date(
                session.created_at,
              ).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        ) : null}
      </View>

      {!session.current ? (
        <Pressable
          style={styles.revokeButton}
          onPress={onRevoke}
        >
          <Text style={styles.revokeText}>
            Révoquer cette session
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SecurityScreen() {
  const { signOut } = useAuth();

  const [sessions, setSessions] =
    useState<SecuritySession[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState('');

  const [currentPassword, setCurrentPassword] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [changing, setChanging] =
    useState(false);

  const [loggingOutAll, setLoggingOutAll] =
    useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const result =
        await profileApi.listSessions();

      setSessions(
        Array.isArray(result) ? result : [],
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'Impossible de charger les sessions.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(
    (session: SecuritySession) => {
      Alert.alert(
        'Révoquer cette session ?',
        `L’accès de ${
          session.device_name ?? 'cet appareil'
        } à votre compte sera fermé.`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Révoquer',
            style: 'destructive',
            onPress: async () => {
              try {
                setMessage('');

                await profileApi.revokeSession(
                  session.id,
                );

                await load();
              } catch (e) {
                setMessage(
                  e instanceof Error
                    ? e.message
                    : 'Impossible de révoquer la session.',
                );
              }
            },
          },
        ],
      );
    },
    [load],
  );

  const changePassword =
    useCallback(async () => {
      if (!currentPassword) {
        setMessage(
          'Entrez votre mot de passe actuel.',
        );
        return;
      }

      if (!newPassword) {
        setMessage(
          'Entrez votre nouveau mot de passe.',
        );
        return;
      }

      setChanging(true);
      setMessage('');

      try {
        await profileApi.changePassword(
          currentPassword,
          newPassword,
        );

        setCurrentPassword('');
        setNewPassword('');

        setMessage(
          'Mot de passe modifié.',
        );
      } catch (e) {
        setMessage(
          e instanceof Error
            ? e.message
            : 'Échec du changement de mot de passe.',
        );
      } finally {
        setChanging(false);
      }
    }, [currentPassword, newPassword]);

  const logoutAll = useCallback(() => {
    Alert.alert(
      'Déconnecter tous les appareils ?',
      'Toutes les sessions seront révoquées, y compris celle-ci.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Déconnecter tout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOutAll(true);
            setMessage('');

            try {
              await profileApi.logoutAll();
              await signOut();
            } catch (e) {
              setMessage(
                e instanceof Error
                  ? e.message
                  : 'Échec de la déconnexion globale.',
              );

              setLoggingOutAll(false);
            }
          },
        },
      ],
    );
  }, [signOut]);

  const otherSessions = sessions.filter(
    (session) => !session.current,
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>
                PROTECTION DU COMPTE
              </Text>

              <Text style={styles.title}>
                Sécurité
              </Text>

              <Text style={styles.subtitle}>
                Gérez votre mot de passe et les appareils
                connectés à votre compte.
              </Text>
            </View>

            <View style={styles.securityBanner}>
              <View style={styles.bannerIcon}>
                <Text style={styles.bannerIconText}>
                  ✓
                </Text>
              </View>

              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>
                  Compte protégé
                </Text>

                <Text style={styles.bannerText}>
                  Votre sécurité est gérée depuis les services
                  d’authentification Livi.
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Mot de passe
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Modifiez-le directement depuis votre compte.
                </Text>
              </View>

              <View style={styles.formCard}>
                <SecurityField
                  label="Mot de passe actuel"
                  placeholder="Mot de passe actuel"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />

                <SecurityField
                  label="Nouveau mot de passe"
                  placeholder="Nouveau mot de passe"
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                {message ? (
                  <View
                    style={[
                      styles.messageBox,
                      message ===
                        'Mot de passe modifié.' &&
                        styles.successBox,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        message ===
                          'Mot de passe modifié.' &&
                          styles.successText,
                      ]}
                    >
                      {message}
                    </Text>
                  </View>
                ) : null}

                <Button
                  title={
                    changing
                      ? 'Modification…'
                      : 'Modifier le mot de passe'
                  }
                  onPress={() =>
                    void changePassword()
                  }
                  disabled={changing}
                  loading={changing}
                  fullWidth
                />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Sessions et appareils
                  </Text>

                  <Text style={styles.sectionSubtitle}>
                    Contrôlez les accès à votre compte.
                  </Text>
                </View>

                {!loading ? (
                  <View style={styles.sessionCount}>
                    <Text style={styles.sessionCountText}>
                      {sessions.length}
                    </Text>
                  </View>
                ) : null}
              </View>

              {loading ? (
                <View style={styles.loadingStack}>
                  <Skeleton
                    height={125}
                    radius={radius.xl}
                  />

                  <Skeleton
                    height={125}
                    radius={radius.xl}
                  />
                </View>
              ) : null}

              {!loading &&
              message &&
              sessions.length === 0 ? (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>
                    {message}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onRevoke={() => revoke(item)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={{ height: spacing[3] }} />
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="·"
              title="Aucune autre session"
              description="Votre session actuelle est la seule connexion active enregistrée."
            />
          ) : null
        }
        ListFooterComponent={
          <>
            {otherSessions.length > 0 ? (
              <Pressable
                style={styles.logoutAllButton}
                onPress={logoutAll}
                disabled={loggingOutAll}
              >
                <Text style={styles.logoutAllText}>
                  {loggingOutAll
                    ? 'Déconnexion…'
                    : 'Déconnecter tous les appareils'}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.refreshButton}
              onPress={() => void load()}
            >
              <Text style={styles.refreshText}>
                Actualiser les sessions
              </Text>
            </Pressable>

            <Text style={styles.footer}>
              Gérez régulièrement les appareils ayant accès
              à votre compte.
            </Text>
          </>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  header: {
    marginBottom: spacing[5],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
  },

  title: {
    marginTop: 2,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
  },

  securityBanner: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    flexDirection: 'row',
    gap: spacing[3],
  },

  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bannerIconText: {
    fontFamily: fonts.bodyBold,
    color: colors.dark,
  },

  bannerContent: {
    flex: 1,
  },

  bannerTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  bannerText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
  },

  section: {
    marginTop: spacing[6],
  },

  sectionHeader: {
    marginBottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  formCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  field: {
    marginBottom: spacing[4],
  },

  fieldLabel: {
    marginBottom: spacing[2],
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  input: {
    minHeight: 52,
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark4,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },

  messageBox: {
    marginBottom: spacing[4],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  successBox: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  messageText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  successText: {
    color: colors.gold2,
  },

  sessionCount: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sessionCountText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  loadingStack: {
    gap: spacing[3],
  },

  sessionCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deviceIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  deviceContent: {
    flex: 1,
  },

  deviceName: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  sessionStatusRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.textMuted,
  },

  statusDotActive: {
    backgroundColor: colors.gold,
  },

  sessionStatus: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  sessionMeta: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing[2],
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  metaLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  metaValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.gray2,
  },

  revokeButton: {
    marginTop: spacing[4],
    minHeight: 42,
    borderRadius: radius.full,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  revokeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.red,
  },

  logoutAllButton: {
    marginTop: spacing[5],
    minHeight: 50,
    borderRadius: radius.full,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutAllText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.red,
  },

  refreshButton: {
    minHeight: 46,
    marginTop: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  refreshText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  footer: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[3],
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
