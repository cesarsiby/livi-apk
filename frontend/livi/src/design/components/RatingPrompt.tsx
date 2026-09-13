import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ratingsApi } from '../../features/ratings/ratingsApi';
import { Button } from './Button';
import { Card } from './Card';
import { colors, fonts, fontSize, spacing } from '../theme';

// V54 (RAPPORT — "SYSTÈME DE NOTATION"): one reusable prompt for all three
// pairs (Acheteur/Vendeur/Transporteur) — see POST /ratings. `submitted`
// starts true if `alreadyRated` is passed, so re-opening an order that was
// already rated shows a thank-you state instead of a form that would just
// 409 on submit (ratings.rated_id,order_id,rater_id is unique).
export function RatingPrompt({
  orderId,
  ratedId,
  ratedLabel,
  alreadyRated = false,
  onSubmitted,
}: {
  orderId: string;
  ratedId: string;
  ratedLabel: string;
  alreadyRated?: boolean;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(alreadyRated);

  if (submitted) {
    return (
      <Card style={styles.card} padded>
        <Text style={styles.thanks}>Merci pour votre note à propos de {ratedLabel}.</Text>
      </Card>
    );
  }

  async function submit() {
    if (rating < 1) { Alert.alert('Notation', 'Choisissez une note de 1 à 5 étoiles.'); return; }
    try {
      setBusy(true);
      await ratingsApi.submit(orderId, ratedId, rating, comment.trim() || undefined);
      setSubmitted(true);
      onSubmitted?.();
    } catch (e: any) {
      Alert.alert('Notation', e?.message ?? 'Impossible d\u2019enregistrer la note.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.card} padded>
      <Text style={styles.title}>Noter {ratedLabel}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} hitSlop={8}>
            <Text style={[styles.star, n <= rating && styles.starFilled]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Commentaire (optionnel)"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
      />
      <Button title={busy ? 'Envoi…' : 'Envoyer la note'} onPress={submit} disabled={busy} loading={busy} size="sm" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  title: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  stars: { flexDirection: 'row', gap: spacing[1] },
  star: { fontSize: 28, color: colors.dark4 },
  starFilled: { color: colors.gold },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing[2], color: colors.textPrimary, fontFamily: fonts.body, minHeight: 44 },
  thanks: { fontFamily: fonts.body, color: colors.gray2 },
});
