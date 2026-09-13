import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { buyerApi } from '../../features/buyer/buyerApi';
import { normalizeList } from '../../services/api/normalize';
import { Button, Card, EmptyState, Skeleton } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, feuille de route priorité 1, constat
// C0) : GET /users/me/payment-methods renvoie un tableau brut (routes/
// compatibility.js, `ok(res, rows)`) — `r?.methods ?? r?.payment_methods ??
// r?.data ?? []` retombait toujours sur []. Corrigé avec normalizeList().
export function PaymentMethodsScreen() {
  const [a, setA] = useState<any[]>([]);
  const [l, setL] = useState(true);
  const [error, setError] = useState('');
  const [m, setM] = useState(false);
  const [operator, setOperator] = useState('Orange Money');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [session, setSession] = useState('');
  const [def, setDef] = useState(true);

  const load = useCallback(() => {
    setL(true);
    setError('');
    buyerApi.paymentMethods()
      .then((r) => setA(normalizeList<any>(r, ['methods', 'payment_methods', 'data'])))
      .catch((e) => setError(e?.message ?? 'Impossible de charger vos moyens de paiement.'))
      .finally(() => setL(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function start() {
    try {
      const r = await buyerApi.initiatePaymentMethod(operator, phone);
      setSession(String((r as any)?.session_id ?? (r as any)?.sessionId ?? ''));
      setM(true);
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'initier la vérification.");
    }
  }
  async function verify() {
    try {
      if (!session) throw new Error('Session de vérification absente.');
      await buyerApi.verifyPaymentMethod(session, otp, def);
      setM(false); setOtp(''); setSession(''); load();
    } catch (e: any) {
      setError(e?.message ?? 'Code invalide ou opération refusée.');
    }
  }
  async function remove(id: string) {
    try { await buyerApi.removePaymentMethod(id); load(); }
    catch (e: any) { setError(e?.message ?? 'Erreur.'); }
  }
  async function makeDefault(id: string) {
    try { await buyerApi.setDefaultPaymentMethod(id); load(); }
    catch (e: any) { setError(e?.message ?? 'Erreur.'); }
  }

  if (l) {
    return (
      <View style={s.c}>
        <Skeleton height={44} radius={radius.md} />
        <Skeleton height={90} radius={radius.xl} />
      </View>
    );
  }

  return (
    <>
      <View style={s.c}>
        <Pressable onPress={() => { setPhone(''); setOperator('Orange Money'); setError(''); start(); }}>
          <Card style={s.add}><Text style={s.addText}>+ Ajouter un moyen de paiement</Text></Card>
        </Pressable>
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        {a.length ? a.map((x, i) => (
          <Card key={String(x.id ?? i)} style={s.card}>
            <Text style={s.title}>{x.operator ?? x.provider ?? 'Mobile Money'}</Text>
            <Text style={s.meta}>{x.phone_masked ?? x.phone ?? '—'}</Text>
            <Text style={s.meta}>{x.is_default ? 'Par défaut' : '—'}</Text>
            <View style={s.row}>
              <Pressable onPress={() => makeDefault(String(x.id))}><Text style={s.link}>Définir par défaut</Text></Pressable>
              <Pressable onPress={() => remove(String(x.id))}><Text style={s.danger}>Supprimer</Text></Pressable>
            </View>
          </Card>
        )) : <EmptyState icon="💳" title="Aucun moyen de paiement" description="Ajoutez un numéro Mobile Money pour payer plus vite au moment du paiement." />}
      </View>

      <Modal visible={m} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Vérification Mobile Money</Text>
            {!session ? (
              <>
                <Text style={s.modalLabel}>Opérateur</Text>
                <TextInput value={operator} onChangeText={setOperator} style={s.input} placeholderTextColor={colors.textMuted} />
                <Text style={s.modalLabel}>Numéro</Text>
                <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={s.input} placeholderTextColor={colors.textMuted} />
                {error ? <Text style={s.errorText}>{error}</Text> : null}
                <Button title="Envoyer OTP" onPress={start} fullWidth />
              </>
            ) : (
              <>
                <Text style={s.modalLabel}>Code OTP</Text>
                <TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" style={s.input} placeholderTextColor={colors.textMuted} />
                {error ? <Text style={s.errorText}>{error}</Text> : null}
                <Button title="Vérifier" onPress={verify} fullWidth />
              </>
            )}
            <Pressable onPress={() => setM(false)}><Text style={s.cancel}>Fermer</Text></Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  c: { padding: spacing[4], gap: spacing[3], backgroundColor: colors.dark, flexGrow: 1 },
  add: { backgroundColor: colors.gold, padding: spacing[4] },
  addText: { color: colors.dark, fontFamily: fonts.bodyBold, textAlign: 'center' },
  card: { padding: spacing[4], gap: 6 },
  title: { fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  row: { flexDirection: 'row', gap: spacing[5], marginTop: spacing[2] },
  link: { fontFamily: fonts.bodyBold, color: colors.gold },
  danger: { color: colors.red, fontFamily: fonts.bodySemibold },
  errorText: { color: colors.red, fontFamily: fonts.body, fontSize: fontSize.sm },
  empty: { textAlign: 'center', padding: spacing[8], color: colors.textMuted, fontFamily: fonts.body },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.dark2,
    padding: spacing[5],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    gap: spacing[3],
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  modalLabel: { fontFamily: fonts.bodySemibold, color: colors.textSecondary, fontSize: fontSize.xs },
  input: {
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[3],
    borderRadius: radius.md,
    color: colors.textPrimary,
    fontFamily: fonts.body,
  },
  cancel: { textAlign: 'center', padding: spacing[3], color: colors.gray, fontFamily: fonts.body },
});
