import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { disputesApi } from '../../features/disputes/disputesApi';
import type { Dispute } from '../../features/disputes/types';
import { useAuth } from '../../features/auth/AuthProvider';
import { Badge, Button, Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

type Props = { route: any; navigation: any };

export function DisputeDetailsScreen({ route }: Props) {
  const id = String(route.params?.disputeId ?? '');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); setDispute(await disputesApi.get(id)); }
    catch (e: any) { setError(e?.message ?? 'Impossible de charger le litige.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function reply() {
    if (!message.trim()) return;
    try { setBusy(true); setError(null); await disputesApi.reply(id, { content: message.trim() }); setMessage(''); await load(); }
    catch (e: any) { setError(e?.message ?? "Impossible d'envoyer la réponse."); }
    finally { setBusy(false); }
  }
  async function resolve(resolution: 'release' | 'refund') {
    if (!note.trim()) { setError('Une note explicative est requise.'); return; }
    try { setBusy(true); setError(null); await disputesApi.resolve(id, { resolution, note: note.trim() }); setNote(''); await load(); }
    catch (e: any) { setError(e?.message ?? 'Impossible de résoudre le litige.'); }
    finally { setBusy(false); }
  }

  function authorLabel(m: { sender_id?: string }) {
    if (m.sender_id === user?.id) return 'Vous';
    if (m.sender_id === dispute?.buyer_id) return 'Acheteur';
    if (m.sender_id === dispute?.vendor_id) return 'Vendeur';
    return 'Utilisateur';
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;
  if (error && !dispute) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <Pressable onPress={load}><Text style={styles.link}>Réessayer</Text></Pressable>
    </View>
  );
  if (!dispute) return <View style={styles.center}><Text style={styles.muted}>Litige introuvable.</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Litige #{dispute.id}</Text>
      <View style={styles.badgeRow}>
        <Badge label={`Statut : ${dispute.status ?? '—'}`} variant="gold" />
        <Badge label={`Commande : ${dispute.order_id ?? '—'}`} variant="blue" />
      </View>

      <Text style={styles.heading}>Motif</Text>
      <Text style={styles.body}>{dispute.reason ?? '—'}</Text>

      {!!dispute.resolution && (
        <>
          <Text style={styles.heading}>Résolution</Text>
          <Text style={styles.body}>{dispute.resolution}</Text>
        </>
      )}

      <Text style={styles.heading}>Échanges</Text>
      {(dispute.messages ?? []).length === 0 ? (
        <Text style={styles.muted}>Aucun échange.</Text>
      ) : (dispute.messages ?? []).map((m) => (
        <Card key={m.id} style={styles.message}>
          <Text style={styles.messageMeta}>{authorLabel(m)}</Text>
          <Text style={styles.body}>{m.content ?? ''}</Text>
        </Card>
      ))}

      {user && (
        <>
          <Text style={styles.heading}>Répondre</Text>
          <TextInput value={message} onChangeText={setMessage} style={[styles.input, styles.textarea]} multiline placeholder="Votre réponse" placeholderTextColor={colors.textMuted} />
          <Button title={busy ? 'Envoi…' : 'Envoyer la réponse'} disabled={busy} loading={busy} onPress={reply} fullWidth />
        </>
      )}

      {isAdmin && (
        <>
          <Text style={styles.heading}>Résolution administrative</Text>
          <TextInput value={note} onChangeText={setNote} style={[styles.input, styles.textarea]} multiline placeholder="Note expliquant la décision (obligatoire)" placeholderTextColor={colors.textMuted} />
          <View style={styles.badgeRow}>
            <Button title={busy ? 'Traitement…' : 'Libérer les fonds au vendeur'} disabled={busy} loading={busy} onPress={() => resolve('release')} />
            <Button title={busy ? 'Traitement…' : "Rembourser l'acheteur"} disabled={busy} loading={busy} onPress={() => resolve('refund')} variant="secondary" />
          </View>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[2] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], backgroundColor: colors.dark },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary, marginBottom: spacing[2] },
  badgeRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap', marginBottom: spacing[2] },
  heading: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, marginTop: spacing[5], marginBottom: spacing[2], color: colors.textPrimary },
  body: { color: colors.gray2, fontFamily: fonts.body },
  message: { padding: spacing[3], marginTop: spacing[2] },
  messageMeta: { fontFamily: fonts.bodySemibold, marginBottom: 4, color: colors.gold },
  input: { backgroundColor: colors.dark3, borderRadius: radius.md, padding: spacing[3], borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontFamily: fonts.body },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  error: { color: colors.red, marginTop: spacing[3], fontFamily: fonts.body },
  link: { color: colors.gold, fontFamily: fonts.bodyBold },
  muted: { color: colors.textMuted, fontFamily: fonts.body },
});
