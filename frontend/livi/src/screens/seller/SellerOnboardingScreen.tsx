import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { sellerOnboardingApi } from '../../features/seller/sellerOnboardingApi';
import { getCurrentLocation } from '../../services/device/location';
import { Button, Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function SellerOnboardingScreen({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [commissionPassthrough, setCommissionPassthrough] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // V54 (RAPPORT section 36 — "BOUTIQUE VENDEUR"): this screen never loaded
  // the vendor's existing shop before — every field always started blank.
  // PATCH /vendor/shop (sellerOnboardingApi.submit) sends every field on
  // every submit, `address` included even when left empty, so a vendor
  // reopening this screen to tweak one field (e.g. the phone number) was
  // silently overwriting the rest of their real shop data with blanks. This
  // now pre-fills from GET /vendor/shop when a shop already exists, and
  // reframes the first/last step as an edit instead of a first-time wizard —
  // the wizard itself (steps 2-6) is otherwise untouched.
  useEffect(() => {
    sellerOnboardingApi.getShop()
      .then((shop) => {
        if (!shop) return;
        // Every vendor account already has a `vendors` row from registration
        // (shop_name pre-filled, everything else null) — so "the row exists"
        // isn't "onboarding is done". Treat it as done, and switch to
        // editing, only once the fields the wizard itself requires
        // (category/phone/city) are actually set.
        const onboarded = !!(shop.category && shop.phone && shop.city);
        setName(shop.shop_name ?? ''); setSlogan(shop.slogan ?? ''); setCategory(shop.category ?? '');
        setPhone(shop.phone ?? ''); setCity(shop.city ?? ''); setAddress(shop.address ?? '');
        setCommissionPassthrough(!!shop.commission_passthrough);
        if (shop.latitude != null && shop.longitude != null) setCoords({ latitude: Number(shop.latitude), longitude: Number(shop.longitude) });
        if (onboarded) { setIsEditing(true); setStep(2); }
      })
      .catch(() => { /* no shop row at all: first-time onboarding, keep step 1 */ })
      .finally(() => setLoadingExisting(false));
  }, []);

  const next = () => {
    if (step === 2 && !name.trim()) return Alert.alert('Boutique', 'Le nom est obligatoire.');
    if (step === 3 && !category.trim()) return Alert.alert('Boutique', 'La catégorie est obligatoire.');
    if (step === 5 && (!phone.trim() || !city.trim())) return Alert.alert('Boutique', 'Téléphone et ville sont obligatoires.');
    setStep((s) => Math.min(6, s + 1));
  };
  const submit = async () => {
    try {
      setBusy(true);
      await sellerOnboardingApi.submit({ shop_name: name.trim(), slogan: slogan.trim(), category: category.trim(), phone: phone.trim(), city: city.trim(), address: address.trim(), commission_passthrough: commissionPassthrough, ...(coords ?? {}) });
      setStep(7);
    } catch (e: any) { Alert.alert('Boutique', e.message); }
    finally { setBusy(false); }
  };

  const titles = [isEditing ? 'Ma boutique' : 'Bienvenue sur LIVI', 'Nom de votre boutique', 'Catégorie principale', 'Slogan', 'Coordonnées', 'Confirmation', isEditing ? 'Boutique mise à jour' : 'Boutique créée'];

  if (loadingExisting) {
    return <View style={s.center}><ActivityIndicator color={colors.gold} /></View>;
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <Text style={s.kicker}>{isEditing ? 'MA BOUTIQUE' : 'ONBOARDING VENDEUR'}</Text>
      <Text style={s.title}>{titles[step - 1]}</Text>

      {step === 1 && <Text style={s.info}>Configurez votre boutique avant de commencer à vendre.</Text>}
      {step === 2 && <TextInput value={name} onChangeText={setName} placeholder="Nom de la boutique" placeholderTextColor={colors.textMuted} style={s.input} />}
      {step === 3 && <TextInput value={category} onChangeText={setCategory} placeholder="Catégorie" placeholderTextColor={colors.textMuted} style={s.input} />}
      {step === 4 && <TextInput value={slogan} onChangeText={setSlogan} placeholder="Slogan (optionnel)" placeholderTextColor={colors.textMuted} style={s.input} />}
      {step === 5 && (
        <>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Téléphone" placeholderTextColor={colors.textMuted} style={s.input} />
          <TextInput value={city} onChangeText={setCity} placeholder="Ville" placeholderTextColor={colors.textMuted} style={s.input} />
          <TextInput value={address} onChangeText={setAddress} placeholder="Adresse (optionnel)" placeholderTextColor={colors.textMuted} style={s.input} />
          <Button
            title={locating ? 'Localisation…' : coords ? '✓ Position enregistrée — mettre à jour' : 'Utiliser ma position actuelle'}
            variant="outline"
            disabled={locating}
            loading={locating}
            onPress={async () => {
              try { setLocating(true); const loc = await getCurrentLocation(); setCoords({ latitude: loc.latitude, longitude: loc.longitude }); }
              catch (e: any) { Alert.alert('Position', e?.message ?? 'Impossible de récupérer la position.'); }
              finally { setLocating(false); }
            }}
            fullWidth
          />
          <Text style={s.info}>Nécessaire pour calculer des frais de livraison selon la distance réelle avec vos acheteurs.</Text>
          {/* V54 (RAPPORT — "COMMISSION VENDEUR"): backend already supported
              vendors.commission_passthrough (PATCH /vendor/shop) — nothing
              in the UI let a vendor actually set it. */}
          <Card style={s.passthroughCard} padded>
            <View style={s.passthroughRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.passthroughTitle}>Répercuter la commission LIVI (3%)</Text>
                <Text style={s.info}>
                  {commissionPassthrough
                    ? 'Un produit à 1 000 FCFA est affiché 1 030 FCFA à l\u2019acheteur. Vous recevez 1 000 FCFA.'
                    : 'Un produit à 1 000 FCFA reste affiché 1 000 FCFA. Vous recevez 970 FCFA après commission.'}
                </Text>
              </View>
              <Switch value={commissionPassthrough} onValueChange={setCommissionPassthrough} trackColor={{ false: colors.dark4, true: colors.gold }} thumbColor={colors.white} />
            </View>
          </Card>
        </>
      )}
      {step === 6 && (
        <Card style={s.summary} padded>
          <Text style={s.summaryLine}>Nom : {name}</Text>
          <Text style={s.summaryLine}>Catégorie : {category}</Text>
          <Text style={s.summaryLine}>Téléphone : {phone}</Text>
          <Text style={s.summaryLine}>Ville : {city}</Text>
          <Text style={s.summaryLine}>Commission répercutée à l'acheteur : {commissionPassthrough ? 'Oui' : 'Non'}</Text>
          <Text style={s.info}>{isEditing ? 'En continuant, vous mettez à jour les informations de votre boutique.' : 'En continuant, vous confirmez les informations fournies et acceptez le parcours de vérification KYC requis par LIVI.'}</Text>
        </Card>
      )}
      {step === 7 && (
        <View>
          <Text style={s.success}>✓ {isEditing ? 'Boutique mise à jour' : 'Boutique configurée'}</Text>
          <Button title="Gérer mes produits" onPress={() => navigation.navigate('Products')} fullWidth size="lg" />
        </View>
      )}
      {step < 7 && (
        <View style={s.actions}>
          {step > 1 && !(isEditing && step === 2) && <Button title="Retour" onPress={() => setStep(step - 1)} variant="secondary" style={{ flex: 1 }} />}
          <Button title={busy ? 'Envoi…' : step === 6 ? (isEditing ? 'Enregistrer' : 'Créer ma boutique') : 'Continuer'} disabled={busy} loading={busy} onPress={step === 6 ? submit : next} style={{ flex: 1 }} />
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[4] },
  kicker: { fontSize: fontSize.xs, fontFamily: fonts.bodyBold, color: colors.gold, letterSpacing: 1.5 },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  info: { color: colors.gray, lineHeight: 21, fontFamily: fonts.body, fontSize: fontSize.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], backgroundColor: colors.dark3, color: colors.textPrimary, fontFamily: fonts.body },
  summary: { gap: spacing[3] },
  summaryLine: { fontFamily: fonts.body, color: colors.gray2 },
  passthroughCard: { gap: spacing[2] },
  passthroughRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  passthroughTitle: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: spacing[3] },
  success: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.gold, marginBottom: spacing[4] },
});
