import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { transporterApi } from '../../features/transporter/transporterApi';
import { getCurrentLocation } from '../../services/device/location';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function LiveMapScreen() {
  const [pos, setPos] = useState<any>(null);
  const [tracking, setTracking] = useState(false);
  const [started, setStarted] = useState(false);

  const load = useCallback(async () => {
    try { setPos(await getCurrentLocation()); }
    catch (e: any) { Alert.alert('Localisation', e?.message ?? 'Position indisponible.'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!tracking) return;
    let sub: Location.LocationSubscription | undefined;
    (async () => {
      try {
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 20 }, async (p) => {
          const x = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy ?? undefined };
          setPos(x);
          try { await transporterApi.updateLocation(x.latitude, x.longitude, x.accuracy); } catch {}
        });
      } catch (e: any) { Alert.alert('GPS', e?.message ?? "Impossible d'activer le suivi."); setTracking(false); }
    })();
    return () => sub?.remove();
  }, [tracking]);

  return (
    <View style={s.container}>
      <Text style={s.title}>Carte & position</Text>
      <View style={s.map}>
        <Text style={s.pin}>⌖</Text>
        <Text style={s.mapTitle}>{started ? 'Suivi de position actif' : 'Position actuelle'}</Text>
        <Text style={s.muted}>Une vraie carte peut être branchée ici sans modifier le contrat backend. Les coordonnées ci-dessous proviennent du GPS réel.</Text>
        {pos && (
          <Text style={s.coords}>
            {pos.latitude.toFixed(6)}{'\n'}{pos.longitude.toFixed(6)}{pos.accuracy ? `\nPrécision : ${Math.round(pos.accuracy)} m` : ''}
          </Text>
        )}
      </View>
      <Text style={s.note}>Le GPS transmet uniquement la position. Le backend décide des transitions de mission.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: spacing[5], gap: spacing[4], backgroundColor: colors.dark },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  map: { flex: 1, minHeight: 420, backgroundColor: colors.dark3, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3], borderWidth: 1, borderColor: colors.border },
  pin: { fontSize: 60, color: colors.gold },
  mapTitle: { fontSize: fontSize.xl, fontFamily: fonts.brandSemibold, color: colors.textPrimary },
  coords: { fontSize: fontSize.md, fontFamily: fonts.bodySemibold, textAlign: 'center', color: colors.gold },
  muted: { color: colors.gray, textAlign: 'center', fontFamily: fonts.body },
  note: { padding: spacing[4], backgroundColor: colors.dark3, borderRadius: radius.md, color: colors.gray, fontFamily: fonts.body, borderWidth: 1, borderColor: colors.border },
});
