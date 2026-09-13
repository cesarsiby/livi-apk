import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { getCurrentLocation } from '../../services/device/location';
import { transporterApi } from '../../features/transporter/transporterApi';
import { Button, Card } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function TrackingScreen({ route }: any) {
  const id = route.params?.missionId ? String(route.params.missionId) : null;
  const [pos, setPos] = useState<any>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    let sub: Location.LocationSubscription | undefined;
    (async () => {
      try {
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 20 }, async (p) => {
          const x = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy ?? undefined };
          setPos(x);
          try { await transporterApi.updateLocation(x.latitude, x.longitude, x.accuracy); } catch {}
        });
      } catch (e: any) { Alert.alert('GPS', e?.message ?? 'Erreur GPS'); setActive(false); }
    })();
    return () => sub?.remove();
  }, [active]);

  const arrive = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const x = await getCurrentLocation();
      setPos(x);
      await transporterApi.arrive(id, x);
      Alert.alert('Arrivée', 'La position a été transmise au backend.');
    } catch (e: any) { Alert.alert('Arrivée', e?.message ?? 'Action refusée.'); }
    finally { setBusy(false); }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Suivi de livraison</Text>
      {id && <Text style={s.meta}>Mission : {id}</Text>}
      <Card style={s.card} padded>
        <Text style={s.status}>{active ? '● Suivi actif' : '○ Suivi inactif'}</Text>
        {pos ? (
          <Text style={s.coords}>
            {pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}{pos.accuracy ? `\nPrécision : ${Math.round(pos.accuracy)} m` : ''}
          </Text>
        ) : <ActivityIndicator color={colors.gold} />}
      </Card>
      <Button title={active ? 'Arrêter le suivi' : 'Démarrer le suivi'} onPress={() => setActive((v) => !v)} fullWidth />
      {id && <Button title={busy ? 'Transmission…' : "Déclarer l'arrivée avec GPS"} disabled={busy} loading={busy} onPress={arrive} variant="secondary" fullWidth />}
      <Text style={s.note}>Le suivi GPS ne marque jamais une livraison comme terminée. Seul le backend valide les transitions.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: spacing[5], gap: spacing[4], backgroundColor: colors.dark },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2 },
  card: { gap: spacing[3] },
  status: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.gold },
  coords: { fontSize: fontSize.md, fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  note: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18, fontFamily: fonts.body },
});
