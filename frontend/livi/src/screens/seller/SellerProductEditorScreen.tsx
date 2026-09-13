import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View, ScrollView, Share, Pressable } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { sellerApi, SellerProduct, ProductVariant } from '../../features/seller/sellerApi';
import { categoriesApi, Category } from '../../features/catalogue/categoriesApi';
import { Button, Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function SellerProductEditorScreen({ route, navigation }: any) {
  const id = route.params?.productId;
  const [product, setProduct] = useState<SellerProduct | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantLabel, setVariantLabel] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantStock, setVariantStock] = useState('');
  const [addingVariant, setAddingVariant] = useState(false);

  const loadVariants = () => { if (id) sellerApi.variants(String(id)).then(setVariants).catch(() => undefined); };

  useEffect(() => {
    // V54 (RAPPORT — "catégorie... description"): neither field existed
    // anywhere in this screen despite both being supported by the backend
    // (description already was; category_id needed a route change — see
    // routes/compatibility.js and the new GET /categories).
    categoriesApi.list().then(setCategories).catch(() => undefined);
    if (id) { sellerApi.media(String(id)).then(setMedia).catch(() => undefined); }
    if (id) loadVariants();
    if (id) sellerApi.products({ id: String(id) }).then((r) => {
      const p = r?.product ?? r?.products?.[0] ?? r?.data?.[0];
      if (p) {
        setProduct(p); setName(p.name ?? p.title ?? ''); setPrice(String(p.price ?? ''));
        setStock(String(p.stock ?? '')); setDescription((p as any).description ?? '');
        setCategoryId((p as any).category_id ?? null);
      }
    }).catch((e) => Alert.alert('Produit', e?.message ?? 'Erreur.'));
  }, [id]);

  async function addVariant() {
    if (!id || !variantLabel.trim()) return;
    try {
      setAddingVariant(true);
      await sellerApi.createVariant(String(id), {
        attributes: { name: variantLabel.trim() },
        price_xof: variantPrice.trim() ? Number(variantPrice) : undefined,
        stock_qty: Number(variantStock || 0),
      });
      setVariantLabel(''); setVariantPrice(''); setVariantStock('');
      loadVariants();
    } catch (e: any) { Alert.alert('Variante', e?.message ?? "Impossible d'ajouter la variante."); }
    finally { setAddingVariant(false); }
  }
  async function removeVariant(variantId: string) {
    try { await sellerApi.archiveVariant(String(id), variantId); loadVariants(); }
    catch (e: any) { Alert.alert('Variante', e?.message ?? 'Suppression impossible.'); }
  }

  async function addPhotos() {
    if (!id) return;
    const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp'], multiple: true, copyToCacheDirectory: true });
    if (picked.canceled) return;
    try {
      setBusy(true);
      for (const f of picked.assets) { await sellerApi.uploadMedia(String(id), f.uri); }
      setMedia(await sellerApi.media(String(id)));
    } catch (e: any) { Alert.alert('Photos', e?.message ?? 'Upload impossible.'); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!id) return;
    try { setBusy(true); await sellerApi.updateProductStatus(String(id), 'active'); Alert.alert('Produit', 'Produit publié.'); navigation.goBack(); }
    catch (e: any) { Alert.alert('Publication', e?.message ?? 'Ajoutez au moins 3 photos.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!name.trim() || !price.trim()) return Alert.alert('Produit', 'Nom et prix sont obligatoires.');
    try {
      setBusy(true);
      const payload = { name: name.trim(), price: Number(price), stock: Number(stock || 0), description: description.trim() || undefined, category_id: categoryId ?? undefined };
      if (id) await sellerApi.updateProduct(String(id), payload); else await sellerApi.createProduct(payload);
      navigation.goBack();
    } catch (e: any) { Alert.alert('Enregistrement', e?.message ?? "Impossible d'enregistrer."); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{product ? 'Modifier le produit' : 'Nouveau produit'}</Text>

      <Text style={styles.label}>Nom</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Matières, dimensions, utilisation, avantages…"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.textArea]}
        multiline
      />
      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.categoryRow}>
        {categories.map((c) => (
          <Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={[styles.categoryChip, categoryId === c.id && styles.categoryChipSelected]}>
            <Text style={[styles.categoryChipText, categoryId === c.id && styles.categoryChipTextSelected]}>{c.name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Prix</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Stock</Text>
      <TextInput value={stock} onChangeText={setStock} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.textMuted} />

      <Button title={busy ? 'Traitement…' : 'Enregistrer'} disabled={busy} loading={busy} onPress={save} fullWidth size="lg" />

      {product && (
        <>
          <Text style={styles.subheading}>Photos ({media.length}/3 minimum)</Text>
          <Button title={busy ? 'Upload…' : 'Ajouter des photos'} disabled={busy} onPress={() => void addPhotos()} variant="outline" fullWidth />
          {media.map((m) => <Text key={String(m.id)} style={styles.mediaUrl}>{m.media_url}</Text>)}
          <Button title={busy ? 'Publication…' : 'Publier le produit'} disabled={busy || media.length < 3} onPress={() => void publish()} variant="green" fullWidth />
          {/* V54: "le vendeur doit pouvoir créer un lien unique partageable
              pour chaque produit" — uses the livi:// deep link (App.tsx). */}
          <Button
            title="Partager le lien du produit"
            variant="outline"
            onPress={() => Share.share({ message: `${name || 'Mon produit'} sur LIVI : livi://product/${id}` })}
            fullWidth
          />

          {/* V54 (RAPPORT — "VARIANTES PRODUITS"): backend routes existed
              (GET/POST/PUT/DELETE /vendor/products/:id/variants), nothing
              in the app ever let a vendor create one. */}
          <Text style={styles.subheading}>Variantes (tailles, couleurs, modèles…)</Text>
          {variants.map((v) => (
            <Card key={v.id} style={styles.variantRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.variantName}>{String((v.attributes as any)?.name ?? v.sku ?? 'Variante')}</Text>
                <Text style={styles.mediaUrl}>
                  {v.price_xof != null ? `${Number(v.price_xof).toLocaleString()} FCFA` : 'Prix du produit'} · Stock : {v.stock_qty}
                </Text>
              </View>
              <Button title="Retirer" variant="outline" size="sm" onPress={() => void removeVariant(v.id)} />
            </Card>
          ))}
          <TextInput value={variantLabel} onChangeText={setVariantLabel} placeholder="Ex : Rouge - Taille M" placeholderTextColor={colors.textMuted} style={styles.input} />
          <View style={styles.variantInputsRow}>
            <TextInput value={variantPrice} onChangeText={setVariantPrice} placeholder="Prix (optionnel)" keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1 }]} />
            <TextInput value={variantStock} onChangeText={setVariantStock} placeholder="Stock" keyboardType="number-pad" placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1 }]} />
          </View>
          <Button title={addingVariant ? 'Ajout…' : '+ Ajouter la variante'} disabled={addingVariant || !variantLabel.trim()} onPress={() => void addVariant()} variant="outline" fullWidth />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  container: { flex: 1, padding: spacing[5], gap: spacing[2] },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary, marginBottom: spacing[3] },
  label: { fontFamily: fonts.bodySemibold, color: colors.textSecondary, marginTop: spacing[2] },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], fontSize: fontSize.base, marginBottom: spacing[2], color: colors.textPrimary, fontFamily: fonts.body, backgroundColor: colors.dark3 },
  subheading: { fontFamily: fonts.bodySemibold, marginTop: spacing[4], color: colors.textPrimary },
  mediaUrl: { color: colors.gray2, fontFamily: fonts.body, fontSize: fontSize.xs },
  variantRow: { flexDirection: 'row', alignItems: 'center', padding: spacing[3], gap: spacing[2], marginTop: spacing[2] },
  variantName: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  variantInputsRow: { flexDirection: 'row', gap: spacing[2] },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  categoryChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.dark3 },
  categoryChipSelected: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  categoryChipText: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  categoryChipTextSelected: { color: colors.gold, fontFamily: fonts.bodySemibold },
});
