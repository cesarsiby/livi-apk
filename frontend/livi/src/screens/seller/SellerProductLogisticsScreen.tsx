import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { sellerApi } from '../../features/seller/sellerApi';
import { Button, Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

const PREPARATION_OPTIONS = [1, 2, 3, 4, 12, 24];

export function SellerProductLogisticsScreen({ route, navigation }: any) {
  const productId = String(route?.params?.productId ?? '');
  const [product, setProduct] = useState<any | null>(null);
  const [prep, setPrep] = useState<number | null>(null);
  const [unit, setUnit] = useState('');
  const [perishable, setPerishable] = useState(false);
  const [productionDate, setProductionDate] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [shelfHours, setShelfHours] = useState('');
  const [shelfReference, setShelfReference] = useState('');
  const [shelfReferenceType, setShelfReferenceType] = useState('');
  const [storage, setStorage] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    sellerApi.products({ limit: 100 }).then((response: any) => {
      const list = Array.isArray(response) ? response : response?.data ?? response?.products ?? [];
      const found = list.find((item: any) => String(item.id) === productId);
      if (!mounted || !found) return;
      setProduct(found);
      setPrep(found.preparation_time_hours != null ? Number(found.preparation_time_hours) : null);
      setUnit(found.unit ?? '');
      setPerishable(Boolean(found.is_perishable));
      setProductionDate(found.production_date ? String(found.production_date) : '');
      setHarvestDate(found.harvest_date ? String(found.harvest_date) : '');
      setShelfHours(found.shelf_life_hours != null ? String(found.shelf_life_hours) : '');
      setShelfReference(found.shelf_life_reference_at ? String(found.shelf_life_reference_at) : '');
      setShelfReferenceType(found.shelf_life_reference_type ? String(found.shelf_life_reference_type) : '');
      setStorage(found.storage_conditions ?? '');
      setAvailableFrom(found.available_from ? String(found.available_from) : '');
    }).catch((e: any) => mounted && setError(e?.message ?? 'Impossible de charger le produit.'));
    return () => { mounted = false; };
  }, [productId]);

  async function save() {
    if (!prep) {
      setError('Choisissez le délai minimal de préparation.');
      return;
    }
    if (perishable && (!shelfHours || Number(shelfHours) <= 0 || !shelfReferenceType)) {
      setError('Pour un produit périssable, indiquez la durée et la base de départ de la conservation.');
      return;
    }
    if (perishable && shelfReferenceType !== 'preparation' && !shelfReference) {
      setError('Pour cette base, indiquez la date/heure de référence de conservation.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await sellerApi.updateProduct(productId, {
        unit: unit.trim() || undefined,
        preparation_time_hours: prep,
        is_perishable: perishable,
        production_date: productionDate.trim() || undefined,
        harvest_date: harvestDate.trim() || undefined,
        shelf_life_hours: perishable ? Number(shelfHours) : undefined,
        shelf_life_reference_at: perishable && shelfReferenceType !== 'preparation' ? shelfReference.trim() : undefined,
        shelf_life_reference_type: perishable ? shelfReferenceType : undefined,
        storage_conditions: storage.trim() || undefined,
        available_from: availableFrom.trim() || undefined,
      } as any);
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? 'Impossible d’enregistrer les informations logistiques.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>LIVI VENDEUR</Text>
      <Text style={styles.title}>Préparation & conservation</Text>
      <Text style={styles.subtitle}>
        Le délai annoncé est le délai minimal après confirmation du paiement. Le produit ne pourra pas être déclaré prêt avant cette échéance.
      </Text>

      {error ? <Card style={styles.errorCard}><Text style={styles.error}>{error}</Text></Card> : null}

      <Card>
        <Text style={styles.sectionTitle}>Délai minimal de préparation</Text>
        <View style={styles.chips}>
          {PREPARATION_OPTIONS.map((hours) => (
            <Pressable
              key={hours}
              onPress={() => setPrep(hours)}
              style={[styles.chip, prep === hours && styles.chipActive]}
            >
              <Text style={[styles.chipText, prep === hours && styles.chipTextActive]}>{hours} h</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helper}>Choisissez exactement une des durées proposées.</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Produit</Text>
        <TextInput value={unit} onChangeText={setUnit} placeholder="Unité : pièce, kg, sac, litre…" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={availableFrom} onChangeText={setAvailableFrom} placeholder="Disponible à partir de (ISO 8601, facultatif)" placeholderTextColor={colors.textMuted} style={styles.input} />
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Produit périssable</Text>
          <Pressable onPress={() => setPerishable((v) => !v)} style={[styles.toggle, perishable && styles.toggleActive]}>
            <Text style={styles.toggleText}>{perishable ? 'OUI' : 'NON'}</Text>
          </Pressable>
        </View>
        {perishable ? (
          <>
            <TextInput value={productionDate} onChangeText={setProductionDate} placeholder="Date/heure de production (ISO 8601)" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={harvestDate} onChangeText={setHarvestDate} placeholder="Date/heure de récolte (ISO 8601)" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={shelfHours} onChangeText={setShelfHours} keyboardType="number-pad" placeholder="Durée de conservation (heures)" placeholderTextColor={colors.textMuted} style={styles.input} />
            <Text style={styles.helper}>Base de départ de la durée de conservation</Text>
            <View style={styles.chips}>
              {([['harvest','Récolte'],['production','Production'],['packaging','Conditionnement'],['preparation','Préparation']] as const).map(([value,label]) => (
                <Pressable key={value} onPress={() => setShelfReferenceType(value)} style={[styles.chip, shelfReferenceType === value && styles.chipActive]}>
                  <Text style={[styles.chipText, shelfReferenceType === value && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {shelfReferenceType !== 'preparation' ? <TextInput value={shelfReference} onChangeText={setShelfReference} placeholder="Date/heure de référence (ISO 8601)" placeholderTextColor={colors.textMuted} style={styles.input} /> : <Text style={styles.helper}>Pour « Préparation », cette date/heure est créée lorsque la préparation démarre. Le temps de préparation n’est pas déduit de la durée de conservation.</Text>}
            <TextInput value={storage} onChangeText={setStorage} placeholder="Conditions de conservation" placeholderTextColor={colors.textMuted} style={[styles.input, styles.textArea]} multiline />
          </>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Règle LIVI</Text>
        <Text style={styles.helper}>
          Pour un périssable, LIVI revalide la durée de conservation au paiement et avant la prise en charge. La base « Préparation » démarre après la préparation ; les autres bases sont calculées depuis leur date/heure de référence.
        </Text>
      </Card>

      <Button title={busy ? 'Enregistrement…' : 'Enregistrer'} onPress={save} loading={busy} disabled={busy || !product} fullWidth size="lg" />
      <Button title="Annuler" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  kicker: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5 },
  title: { color: colors.textPrimary, fontFamily: fonts.brand, fontSize: fontSize['3xl'], lineHeight: 36 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 20 },
  errorCard: { borderWidth: 1, borderColor: colors.redBorder },
  error: { color: colors.red, fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 19 },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, marginBottom: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.dark3 },
  chipActive: { backgroundColor: colors.goldDim, borderColor: colors.goldBorder },
  chipText: { color: colors.textSecondary, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm },
  chipTextActive: { color: colors.gold },
  helper: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 18 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.dark4, color: colors.textPrimary, paddingHorizontal: spacing[3], marginBottom: spacing[2], fontFamily: fonts.body, fontSize: fontSize.sm },
  textArea: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing[3] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  toggle: { minWidth: 52, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.dark4, alignItems: 'center' },
  toggleActive: { borderColor: colors.goldBorder, backgroundColor: colors.goldDim },
  toggleText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: fontSize.xs },
});
