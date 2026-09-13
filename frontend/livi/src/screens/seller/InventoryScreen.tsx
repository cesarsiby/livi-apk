import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { sellerApi } from '../../features/seller/sellerApi';
import { normalizeList } from '../../services/api/normalize';
import { Card, EmptyState } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

function InventoryRow({ item, onSaved }: { item: any; onSaved: () => void }) {
  const id = String(item.product_id ?? item.id);
  const [qty, setQty] = useState(String(item.quantity ?? item.stock ?? 0));
  const [busy, setBusy] = useState(false);
  return (
    <Card style={s.card}>
      <Text style={s.title}>{item.name ?? item.product_name ?? 'Produit'}</Text>
      <Text style={s.muted}>Stock actuel : {item.quantity ?? item.stock ?? '—'}</Text>
      <View style={s.line}>
        <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" style={s.input} placeholderTextColor={colors.textMuted} />
        <Pressable
          disabled={busy}
          style={s.btn}
          onPress={async () => {
            try { setBusy(true); await sellerApi.updateStock(id, Number(qty)); Alert.alert('Inventaire', 'Stock mis à jour.'); onSaved(); }
            catch (e: any) { Alert.alert('Inventaire', e.message); }
            finally { setBusy(false); }
          }}
        >
          <Text style={s.btnText}>{busy ? '…' : 'Enregistrer'}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, feuille de route priorité 1, constat
// C0) : GET /vendor/inventory renvoie un tableau brut (routes/
// compatibility.js, `ok(res, rows)`) — `r?.items ?? r?.inventory ?? r?.data
// ?? []` retombait toujours sur []. Corrigé avec normalizeList().
export function InventoryScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    sellerApi.inventory()
      .then((r) => setItems(normalizeList<any>(r, ['items', 'inventory', 'data'])))
      .catch((e) => Alert.alert('Inventaire', e.message))
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <FlatList
      style={s.screen}
      data={items}
      keyExtractor={(x, i) => String(x.product_id ?? x.id ?? i)}
      contentContainerStyle={s.list}
      ListEmptyComponent={<EmptyState icon="📋" title="Aucun produit à gérer" description="Vos produits apparaîtront ici pour ajuster leur stock rapidement." />}
      renderItem={({ item }) => <InventoryRow item={item} onSaved={load} />}
    />
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3] },
  card: { padding: spacing[4], gap: spacing[2] },
  title: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  muted: { color: colors.gray2, fontFamily: fonts.body },
  line: { flexDirection: 'row', gap: spacing[2] },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], color: colors.textPrimary, fontFamily: fonts.body, backgroundColor: colors.dark4 },
  btn: { backgroundColor: colors.gold, paddingHorizontal: spacing[4], justifyContent: 'center', borderRadius: radius.md },
  btnText: { color: colors.dark, fontFamily: fonts.bodyBold },
  empty: { padding: spacing[10], textAlign: 'center', color: colors.textMuted, fontFamily: fonts.body },
});
