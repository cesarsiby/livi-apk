import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../../services/api/client';
import { Button, Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function AdminDeliveryTimingScreen() {
  const [rules, setRules] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [minD, setMinD] = useState('0');
  const [maxD, setMaxD] = useState('');
  const [minT, setMinT] = useState('');
  const [maxT, setMaxT] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiRequest<any>('/intercity/admin/urban-time-rules');
      setRules(Array.isArray(response) ? response : response?.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Chargement impossible.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    try {
      await apiRequest('/intercity/admin/urban-time-rules', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          min_distance_km: Number(minD),
          max_distance_km: maxD === '' ? null : Number(maxD),
          transit_min_minutes: Number(minT),
          transit_max_minutes: Number(maxT),
          active: true,
        }),
      });
      setName(''); setMinD('0'); setMaxD(''); setMinT(''); setMaxT('');
      setError('');
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Création impossible.');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>LIVI ADMIN — LOGISTIQUE</Text>
      <Text style={styles.title}>Délais urbains</Text>
      <Text style={styles.subtitle}>Les délais de transit urbain sont configurés par distance. Aucun délai arbitraire n’est inventé par l’application.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Card>
        <Text style={styles.sectionTitle}>Nouvelle règle</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Nom" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={minD} onChangeText={setMinD} keyboardType="decimal-pad" placeholder="Distance min (km)" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={maxD} onChangeText={setMaxD} keyboardType="decimal-pad" placeholder="Distance max (km), vide = sans limite" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={minT} onChangeText={setMinT} keyboardType="number-pad" placeholder="Transit minimum (minutes)" placeholderTextColor={colors.textMuted} style={styles.input} />
        <TextInput value={maxT} onChangeText={setMaxT} keyboardType="number-pad" placeholder="Transit maximum (minutes)" placeholderTextColor={colors.textMuted} style={styles.input} />
        <Button title="Ajouter la règle" onPress={add} fullWidth />
      </Card>
      <View style={styles.list}>
        {rules.map((rule) => (
          <Card key={rule.id}>
            <Text style={styles.ruleName}>{rule.name}</Text>
            <Text style={styles.meta}>{rule.min_distance_km}–{rule.max_distance_km ?? '∞'} km · {rule.transit_min_minutes}–{rule.transit_max_minutes} min · {rule.active ? 'active' : 'inactive'}</Text>
          </Card>
        ))}
      </View>
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
  error: { color: colors.red, fontFamily: fonts.body, fontSize: fontSize.sm },
  list: { gap: spacing[3] },
  ruleName: { color: colors.textPrimary, fontFamily: fonts.bodySemibold, fontSize: fontSize.sm },
  meta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 18, marginTop: 3 },
});
