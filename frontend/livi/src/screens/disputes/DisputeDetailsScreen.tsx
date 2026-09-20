import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { disputesApi } from '../../features/disputes/disputesApi';
import type { Dispute } from '../../features/disputes/types';

import { useAuth } from '../../features/auth/AuthProvider';

import {
  Button,
  EmptyState,
  Skeleton,
  StatusBadge,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

function formatDate(value?: string) {
  if (!value) return '';

  return new Date(value).toLocaleString(
    'fr-FR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  );
}

function resolutionLabel(value?: string) {
  if (value === 'release') {
    return 'Fonds libérés au vendeur';
  }

  if (value === 'refund') {
    return "Acheteur remboursé";
  }

  return value ?? '—';
}

export function DisputeDetailsScreen({
  route,
}: any) {
  const id = String(
    route.params?.disputeId ?? '',
  );

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [dispute, setDispute] =
    useState<Dispute | null>(null);

  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);

        const result =
          await disputesApi.get(id);

        setDispute(result);
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger le litige.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const messages = useMemo(
    () => dispute?.messages ?? [],
    [dispute],
  );

  async function reply() {
    if (!message.trim()) return;

    try {
      setBusy(true);
      setError(null);

      await disputesApi.reply(id, {
        content: message.trim(),
      });

      setMessage('');
      await load();
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible d'envoyer la réponse.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resolve(
    resolution: 'release' | 'refund',
  ) {
    if (!note.trim()) {
      setError(
        'Une note explicative est requise.',
      );
      return;
    }

    try {
      setBusy(true);
      setError(null);

      await disputesApi.resolve(id, {
        resolution,
        note: note.trim(),
      });

      setNote('');
      await load();
    } catch (e: any) {
      setError(
        e?.message ??
          'Impossible de résoudre le litige.',
      );
    } finally {
      setBusy(false);
    }
  }

  function authorLabel(
    senderId?: string,
  ) {
    if (senderId === user?.id) {
      return 'Vous';
    }

    if (senderId === dispute?.buyer_id) {
      return 'Acheteur';
    }

    if (senderId === dispute?.vendor_id) {
      return 'Vendeur';
    }

    return 'Utilisateur';
  }

  if (loading) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
      >
        <Skeleton
          height={56}
          radius={radius.lg}
        />

        <Skeleton
          height={180}
          radius={radius.xl}
        />

        <Skeleton
          height={110}
          radius={radius.xl}
        />

        <Skeleton
          height={110}
          radius={radius.xl}
        />
      </ScrollView>
    );
  }

  if (error && !dispute) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>

        <Pressable onPress={() => load()}>
          <Text style={styles.retry}>
            Réessayer
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!dispute) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="·"
          title="Litige introuvable"
          description="Aucun dossier correspondant n’a été retourné par le serveur."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={
        Platform.OS === 'ios' ? 'padding' : undefined
      }
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            ASSISTANCE LIVI
          </Text>

          <Text style={styles.title}>
            Litige #{dispute.id}
          </Text>

          <Text style={styles.date}>
            Ouvert le {formatDate(dispute.created_at)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <StatusBadge
            domain="dispute"
            status={dispute.status}
          />

          <View style={styles.orderPill}>
            <Text style={styles.orderPillLabel}>
              Commande
            </Text>

            <Text
              style={styles.orderPillValue}
              numberOfLines={1}
            >
              {dispute.order_id ?? '—'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Motif
          </Text>

          <View style={styles.contentCard}>
            <Text style={styles.body}>
              {dispute.reason ?? '—'}
            </Text>
          </View>
        </View>

        {dispute.resolution ? (
          <View style={styles.resolutionCard}>
            <Text style={styles.resolutionLabel}>
              Résolution
            </Text>

            <Text style={styles.resolutionText}>
              {resolutionLabel(
                dispute.resolution,
              )}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Échanges
          </Text>

          {messages.length === 0 ? (
            <View style={styles.contentCard}>
              <Text style={styles.muted}>
                Aucun échange pour le moment.
              </Text>
            </View>
          ) : (
            <View style={styles.messages}>
              {messages.map((item) => {
                const mine =
                  item.sender_id === user?.id;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.messageBubble,
                      mine &&
                        styles.messageBubbleMine,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageAuthor,
                        mine &&
                          styles.messageAuthorMine,
                      ]}
                    >
                      {authorLabel(item.sender_id)}
                    </Text>

                    <Text style={styles.messageBody}>
                      {item.content ?? ''}
                    </Text>

                    {item.created_at ? (
                      <Text style={styles.messageDate}>
                        {formatDate(
                          item.created_at,
                        )}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {user ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Répondre
            </Text>

            <TextInput
              value={message}
              onChangeText={setMessage}
              editable={!busy}
              multiline
              textAlignVertical="top"
              placeholder="Écrivez votre réponse"
              placeholderTextColor={
                colors.textMuted
              }
              style={[
                styles.input,
                styles.textarea,
              ]}
            />

            <Button
              title={
                busy
                  ? 'Envoi…'
                  : 'Envoyer la réponse'
              }
              onPress={reply}
              disabled={
                busy || !message.trim()
              }
              loading={busy}
              fullWidth
            />
          </View>
        ) : null}

        {isAdmin ? (
          <View style={styles.adminSection}>
            <Text style={styles.sectionTitle}>
              Décision administrative
            </Text>

            <Text style={styles.adminNote}>
              Une note est obligatoire avant de transmettre la
              résolution au backend.
            </Text>

            <TextInput
              value={note}
              onChangeText={setNote}
              editable={!busy}
              multiline
              textAlignVertical="top"
              placeholder="Note de résolution"
              placeholderTextColor={
                colors.textMuted
              }
              style={[
                styles.input,
                styles.textarea,
              ]}
            />

            <Button
              title="Libérer les fonds au vendeur"
              onPress={() =>
                resolve('release')
              }
              disabled={
                busy || !note.trim()
              }
              loading={busy}
              fullWidth
            />

            <Button
              title="Rembourser l’acheteur"
              onPress={() =>
                resolve('refund')
              }
              disabled={
                busy || !note.trim()
              }
              variant="secondary"
              fullWidth
            />
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.error}>
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
    gap: spacing[4],
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
    backgroundColor: colors.dark,
  },

  header: {
    gap: spacing[1],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.6,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  date: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },

  orderPill: {
    maxWidth: '100%',
    minHeight: 34,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  orderPillLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  orderPillValue: {
    maxWidth: 180,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  section: {
    gap: spacing[3],
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  contentCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  muted: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  resolutionCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    gap: spacing[1],
  },

  resolutionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  resolutionText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  messages: {
    gap: spacing[3],
  },

  messageBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    padding: spacing[4],
    borderRadius: radius.xl,
    borderTopLeftRadius: 8,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[2],
  },

  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.dark3,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: 8,
  },

  messageAuthor: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  messageAuthorMine: {
    color: colors.gold2,
  },

  messageBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },

  messageDate: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },

  textarea: {
    minHeight: 120,
    paddingTop: spacing[4],
  },

  adminSection: {
    gap: spacing[3],
    paddingTop: spacing[2],
  },

  adminNote: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textMuted,
  },

  errorCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  retry: {
    marginTop: spacing[2],
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
