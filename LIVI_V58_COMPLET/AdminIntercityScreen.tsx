import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../../services/api/client';
import { Button, Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function AdminIntercityScreen() {
  const [partners, setPartners] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [partnerCode, setPartnerCode] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [fuel, setFuel] = useState('');
  const [charges, setCharges] = useState('');
  const [partnerCharge, setPartnerCharge] = useState('');
  const [minH, setMinH] = useState('');
  const [maxH, setMaxH] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        apiRequest<any>('/intercity/admin/partners'),
        apiRequest<any>('/intercity/admin/routes'),
      ]);
      setPartners(Array.isArray(p) ? p : p?.data ?? []);
      setRoutes(Array.isArray(r) ? r : r?.data ?? []);
      setError('');
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger la configuration.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addPartner() {
    try {
      await apiRequest('/intercity/admin/partners', { method: 'POST', body: JSON.stringify({ code: partnerCode.trim(), name: partnerName.trim() }) });
      setPartnerCode(''); setPartnerName(''); await load();
    } catch (e: any) { setError(e?.message ?? 'Création du partenaire impossible.'); }
  }

  async function addRoute() {
    try {
      const routeTransportCost = Number(fuel || 0) + 1000 + Number(charges || 0) + Number(partnerCharge || 0);
      await apiRequest('/intercity/admin/routes', {
        method: 'POST',
        body: JSON.stringify({
          partner_id: partnerId.trim(),
          origin_city: origin.trim(),
          destination_city: destination.trim(),
          fee_xof: routeTransportCost,
          fuel_cost_xof: Number(fuel || 0),
          operating_charges_xof: Number(charges || 0),
          partner_service_fee_xof: Number(partnerCharge || 0),
          transit_min_hours: Number(minH),
          transit_max_hours: Number(maxH),
        }),
      });
      setFuel(''); setCharges(''); setPartnerCharge(''); setOrigin(''); setDestination(''); setMinH(''); setMaxH('');
      await load();
    } catch (e: any) { setError(e?.message ?? 'Création de la liaison impossible.'); }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>LIVI ADMIN — INTERVILLE</Text>
      <Text style={styles.title}>Partenaires & liaisons</Text>
      <Text style={styles.subtitle}>Le coût transport route est séparé de la garantie de sécurité. La garantie partenaire est fixée à 10 % de la valeur de la marchandise. Aucun minimum distinct n’est appliqué.</Text>
      {error ? <Card><Text style={styles.error}>{error}</Text></Card> : null}

      <Card>
        <Text style={styles.sectionTitle}>Compagnie partenaire</Text>
        <TextInput value={partnerCode} onChangeText={setPartnerCode} placeholder="Code" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={partnerName} onChangeText={setPartnerName} placeholder="Nom de la compagnie" placeholderTextColor={colors.textMuted} style={styles.input} />
        <Button title="Ajouter" onPress={addPartner} fullWidth />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Liaison</Text>
        <TextInput value={partnerId} onChangeText={setPartnerId} placeholder="ID partenaire" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={origin} onChangeText={setOrigin} placeholder="Ville d’origine" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={destination} onChangeText={setDestination} placeholder="Ville de destination" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={fuel} onChangeText={setFuel} keyboardType="number-pad" placeholder="Carburant FCFA" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={charges} onChangeText={setCharges} keyboardType="number-pad" placeholder="Charges d’exploitation FCFA" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={partnerCharge} onChangeText={setPartnerCharge} keyboardType="number-pad" placeholder="Frais partenaire FCFA" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={minH} onChangeText={setMinH} keyboardType="number-pad" placeholder="Transit minimum (heures)" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={maxH} onChangeText={setMaxH} keyboardType="number-pad" placeholder="Transit maximum (heures)" placeholderTextColor={colors.textMuted} style={styles.input} />
        <Text style={styles.helper}>Coût facturé transport interville = carburant + 1 000 FCFA de minimum de livraison + charges d’exploitation + frais partenaire. La garantie partenaire de 10 % est séparée et n’est pas facturée à l’acheteur.</Text>
        <Button title="Ajouter la liaison" onPress={addRoute} fullWidth />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Liaisons actives</Text>
        {routes.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.main}>{r.partner_name} · {r.origin_city} → {r.destination_city}</Text>
            <Text style={styles.meta}>{Number(r.fee_xof).toLocaleString('fr-FR')} FCFA · {r.transit_min_hours}–{r.transit_max_hours} h</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Partenaires enregistrés</Text>
        {partners.map((p) => <Text key={p.id} style={styles.meta}>{p.code} · {p.name} · {p.status}</Text>)}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  kicker: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.4 },
  title: { color: colors.textPrimary, fontFamily: fonts.brand, fontSize: fontSize['3xl'] },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 20 },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, marginBottom: spacing[3] },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.dark4, color: colors.textPrimary, paddingHorizontal: spacing[3], marginBottom: spacing[2] },
  helper: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 18, marginBottom: spacing[3] },
  error: { color: colors.red, fontFamily: fonts.body, fontSize: fontSize.sm },
  row: { paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: colors.border },
  main: { color: colors.textPrimary, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm },
  meta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 18, marginTop: 3 },
});
