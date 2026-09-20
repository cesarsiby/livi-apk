import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { disputesApi } from '../../features/disputes/disputesApi';
import { Button, Card } from '../../design/components';
import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

type Props = {
  navigation: any;
  route: any;
};

export function CreateDisputeScreen({
  navigation,
  route,
}: Props) {
  const orderId = String(route.params?.orderId ?? '');

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    null,
  );

  const canSubmit = useMemo(
    () =>
      orderId.length > 0 &&
      reason.trim().length > 0 &&
      description.trim().length > 0 &&
      !submitting,
    [orderId, reason, description, submitting],
  );

  async function submit() {
    if (!orderId) {
      setError(
        'Cette ouverture de litige doit être liée à une commande.',
      );
      return;
    }

    if (!reason.trim()) {
      setError('Indiquez le motif du litige.');
      return;
    }

    if (!description.trim()) {
      setError(
        'Décrivez précisément le problème rencontré.',
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const dispute = await disputesApi.create({
        order_id: orderId,
        reason: `${reason.trim()}\n\n${description.trim()}`,
      });

      navigation.replace('DisputeDetails', {
        disputeId: dispute.id,
      });
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible d'ouvrir le litige.",
      );
    } finally {
      setSubmitting(false);
    }
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ASSISTANCE LIVI</Text>
          <Text style={styles.title}>Ouvrir un litige</Text>
          <Text style={styles.subtitle}>
            Signalez précisément le problème rencontré sur votre
            commande.
          </Text>
        </View>

        <Card style={styles.orderCard}>
          <Text style={styles.orderLabel}>
            Commande concernée
          </Text>

          <Text
            style={styles.orderId}
            numberOfLines={1}
          >
            {orderId || 'Commande non définie'}
          </Text>
        </Card>

        <View style={styles.formBlock}>
          <Text style={styles.label}>Motif</Text>

          <TextInput
            value={reason}
            onChangeText={setReason}
            editable={!submitting}
            placeholder="Ex. problème avec la commande"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            maxLength={160}
          />

          <Text style={styles.helper}>
            Décrivez le motif en quelques mots.
          </Text>
        </View>

        <View style={styles.formBlock}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.counter}>
              {description.length}/1200
            </Text>
          </View>

          <TextInput
            value={description}
            onChangeText={setDescription}
            editable={!submitting}
            multiline
            maxLength={1200}
            textAlignVertical="top"
            placeholder="Décrivez les faits, ce qui manque, ce qui a été reçu ou tout autre élément utile."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              styles.textarea,
            ]}
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.error}>{error}</Text>

            <Pressable
              onPress={() => setError(null)}
            >
              <Text style={styles.dismiss}>
                Modifier les informations
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.noteCard}>
          <View style={styles.noteDot} />

          <Text style={styles.noteText}>
            Votre demande est enregistrée côté serveur. Aucun statut
            de commande ou mouvement financier n’est simulé par cet
            écran.
          </Text>
        </View>

        <Button
          title={
            submitting
              ? 'Ouverture en cours…'
              : 'Ouvrir le litige'
          }
          onPress={submit}
          disabled={!canSubmit}
          loading={submitting}
          fullWidth
          size="lg"
        />

        <Pressable
          onPress={() => navigation.goBack()}
          disabled={submitting}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            Retour à la commande
          </Text>
        </Pressable>
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
    gap: spacing[5],
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

  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  orderCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[2],
  },

  orderLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  orderId: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  formBlock: {
    gap: spacing[2],
  },

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  counter: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },

  textarea: {
    minHeight: 150,
    paddingTop: spacing[4],
  },

  helper: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  errorCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.redBorder,
    gap: spacing[2],
  },

  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  dismiss: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  noteDot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },

  noteText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  backButton: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },

  backText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
