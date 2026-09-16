import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { buyerApi } from '../../features/buyer/buyerApi';
import { normalizeList } from '../../services/api/normalize';
import { Button, Card, EmptyState, Skeleton } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, feuille de route priorité 1, constat
// C0) : `r?.addresses ?? r?.data ?? []` ne fonctionnait jamais — GET
// /users/me/addresses renvoie un tableau brut une fois déballé par
// apiRequest() (routes/compatibility.js, `ok(res, rows)`). Corrigé avec
// normalizeList(). Le reste de l'écran (repères locaux : quartier, type de
// repère, description — précieux pour une adresse en contexte africain où
// l'adressage formel est souvent absent) est inchangé, il était correct.
export function AddressesScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  // SESSION 26 (§19/§49 prompt maître, contrat frontend/backend) : était
  // 'Mali' (4 caractères) — le backend (routes/compatibility.js,
  // POST /users/me/addresses) exige `z.string().length(2)` pour `country`.
  // Comme ce champ n'est jamais affiché dans le formulaire (pas dans la
  // liste des champs édités plus bas), il partait toujours avec cette
  // valeur par défaut, jamais corrigée par l'utilisateur : CHAQUE création
  // d'adresse échouait avec une erreur de validation Zod, sans exception.
  // Corrigé à 'ML', qui correspond au défaut réel du backend
  // (`country:z.string().length(2).default('ML')`) et à la valeur que la
  // liste d'adresses affiche déjà pour ce même champ (item.country).
  const [form, setForm] = useState<any>({ label: '', recipient_name: '', phone: '', address_line: '', city: '', country: 'ML', is_default: false, neighborhood: '', landmark_type: '', landmark_description: '' });

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    buyerApi.addresses()
      .then((r) => setItems(normalizeList<any>(r, ['addresses', 'data'])))
      .catch((e) => setError(e?.message ?? 'Impossible de charger vos adresses.'))
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (a?: any) => {
    setEditing(a ?? null);
    setForm(a ? { ...form, ...a } : { label: '', recipient_name: '', phone: '', address_line: '', city: '', country: 'ML', is_default: false, neighborhood: '', landmark_type: '', landmark_description: '' });
    setModal(true);
  };

  async function save() {
    try {
      if (editing) await buyerApi.updateAddress(String(editing.id), form);
      else await buyerApi.addAddress(form);
      setModal(false); load();
    } catch (e: any) { setError(e?.message ?? "Impossible d'enregistrer l'adresse."); }
  }
  async function remove(id: string) {
    Alert.alert('Supprimer cette adresse ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await buyerApi.deleteAddress(id); load(); }
        catch (e: any) { setError(e?.message ?? "Impossible de supprimer l'adresse."); }
      } },
    ]);
  }
  async function setDefault(id: string) {
    try { await buyerApi.updateAddress(id, { is_default: true }); load(); }
    catch (e: any) { setError(e?.message ?? 'Erreur.'); }
  }

  if (loading) {
    return (
      <View style={styles.list}>
        <Skeleton height={44} radius={radius.md} />
        <Skeleton height={110} radius={radius.xl} />
        <Skeleton height={110} radius={radius.xl} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(x) => String(x.id)}
        ListHeaderComponent={
          <>
            <Pressable onPress={() => open()}>
              <Card style={styles.add}><Text style={styles.addText}>+ Ajouter une adresse</Text></Card>
            </Pressable>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          <EmptyState icon="📍" title="Aucune adresse enregistrée" description="Ajoutez une adresse pour passer votre première commande." />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.title}>{item.label ?? 'Adresse'} {item.is_default ? '· Par défaut' : ''}</Text>
            <Text style={styles.meta}>{item.recipient_name ?? '—'} · {item.phone ?? '—'}</Text>
            <Text style={styles.meta}>{item.address_line ?? item.address ?? '—'}</Text>
            <Text style={styles.meta}>{item.city ?? '—'}, {item.country ?? '—'}</Text>
            {!!(item.neighborhood || item.landmark_description) && (
              <Text style={styles.meta}>
                📍 {[item.neighborhood, item.landmark_type && item.landmark_description ? `${item.landmark_type} : ${item.landmark_description}` : item.landmark_description].filter(Boolean).join(' · ')}
              </Text>
            )}
            <View style={styles.row}>
              <Pressable onPress={() => open(item)}><Text style={styles.link}>Modifier</Text></Pressable>
              <Pressable onPress={() => remove(String(item.id))}><Text style={styles.danger}>Supprimer</Text></Pressable>
              {!item.is_default ? <Pressable onPress={() => setDefault(String(item.id))}><Text style={styles.link}>Par défaut</Text></Pressable> : null}
            </View>
          </Card>
        )}
      />
      <Modal visible={modal} animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{editing ? 'Modifier' : 'Ajouter'} une adresse</Text>
          {['label', 'recipient_name', 'phone', 'address_line', 'city'].map((k) => (
            <TextInput
              key={k}
              placeholder={k}
              placeholderTextColor={colors.textMuted}
              value={String(form[k] ?? '')}
              onChangeText={(v) => setForm({ ...form, [k]: v })}
              style={styles.input}
            />
          ))}
          <Text style={styles.sectionLabel}>Repères locaux (pour faciliter la livraison)</Text>
          <TextInput
            placeholder="Quartier / secteur"
            placeholderTextColor={colors.textMuted}
            value={String(form.neighborhood ?? '')}
            onChangeText={(v) => setForm({ ...form, neighborhood: v })}
            style={styles.input}
          />
          <TextInput
            placeholder="Type de repère (ex : pharmacie, mosquée, école, boutique connue…)"
            placeholderTextColor={colors.textMuted}
            value={String(form.landmark_type ?? '')}
            onChangeText={(v) => setForm({ ...form, landmark_type: v })}
            style={styles.input}
          />
          <TextInput
            placeholder="Précisez le repère (ex : en face de la pharmacie Kayira)"
            placeholderTextColor={colors.textMuted}
            value={String(form.landmark_description ?? '')}
            onChangeText={(v) => setForm({ ...form, landmark_description: v })}
            style={styles.input}
            multiline
          />
          <View style={styles.row}>
            <Button title="Enregistrer" onPress={save} style={{ flex: 1 }} />
            <Pressable style={styles.cancel} onPress={() => setModal(false)}><Text style={styles.cancelText}>Annuler</Text></Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  add: { backgroundColor: colors.gold, padding: spacing[4] },
  addText: { color: colors.dark, fontFamily: fonts.bodyBold, textAlign: 'center' },
  card: { padding: spacing[4], gap: 7, marginTop: spacing[3] },
  title: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  row: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[2], alignItems: 'center' },
  link: { fontFamily: fonts.bodyBold, color: colors.gold },
  danger: { color: colors.red, fontFamily: fonts.bodySemibold },
  errorText: { color: colors.red, fontFamily: fonts.body, marginTop: spacing[2], textAlign: 'center' },
  modal: { flex: 1, padding: spacing[5], justifyContent: 'center', gap: spacing[3], backgroundColor: colors.dark },
  modalTitle: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  sectionLabel: { fontFamily: fonts.bodySemibold, color: colors.gray2, fontSize: fontSize.sm, marginTop: spacing[2] },
  input: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.textPrimary,
    fontFamily: fonts.body,
  },
  cancel: { padding: spacing[4], alignItems: 'center' },
  cancelText: { color: colors.gray, fontFamily: fonts.body },
});
