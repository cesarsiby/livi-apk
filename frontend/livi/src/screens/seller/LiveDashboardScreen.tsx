import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { liveApi } from '../../features/live/liveApi';
import { Button } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

export function LiveDashboardScreen() {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setBusy(true);
    try { setD(await liveApi.startLive({})); }
    catch (e: any) { setError(e?.message ?? 'Démarrage impossible.'); }
    finally { setBusy(false); }
  };
  const end = async () => {
    if (!d?.id) return;
    setBusy(true);
    try { await liveApi.endLive(d.id); setD(null); }
    catch (e: any) { setError(e?.message ?? 'Arrêt impossible.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { setD(null); }, []);

  return (
    <View style={s.c}>
      <Text style={s.h}>Live Dashboard</Text>
      {d ? (
        <>
          <Text style={s.meta}>Live actif : {d.title || d.id}</Text>
          <Button title="Terminer le live" onPress={end} disabled={busy} loading={busy} variant="red" fullWidth />
        </>
      ) : (
        <Button title="Démarrer un live" onPress={start} disabled={busy} loading={busy} fullWidth size="lg" />
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, padding: spacing[5], gap: spacing[4], backgroundColor: colors.dark },
  h: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2 },
  error: { color: colors.red, fontFamily: fonts.body },
});
