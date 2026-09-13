import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { adminApi } from '../../features/admin/adminApi';
import { Screen, Skeleton, StatCard } from '../../design/components';
import { formatMoney } from '../../design/components/Money';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, périmètre admin) : cet écran appelle
// EXACTEMENT le même endpoint que AdminDashboardScreen (adminApi.
// getDashboard() → GET /admin/dashboard) et affichait le JSON brut de
// chaque champ (Object.entries + JSON.stringify pour tout objet imbriqué)
// sous un simple habillage "📊 Analytics" — alors que l'endpoint ne
// renvoie aucune série temporelle, seulement 4 compteurs instantanés. Même
// traitement que le dashboard plutôt qu'une fausse page d'analytics ; pas
// de graphique ajouté pour "faire moderne" (règle §21 — une statistique
// doit répondre à une question, pas occuper l'espace).
export function PlatformAnalyticsScreen() {
  const [d, setD] = useState<any>();
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getDashboard().then(setD).catch((e: any) => setError(e?.message ?? 'Erreur.'));
  }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Analytics plateforme</Text>
        {error ? (
          <Text style={s.error}>{error}</Text>
        ) : !d ? (
          <View style={s.grid}>
            <Skeleton height={92} radius={radius.lg} />
            <Skeleton height={92} radius={radius.lg} />
          </View>
        ) : (
          <View style={s.grid}>
            <StatCard label="Utilisateurs" value={String(d.users ?? '—')} icon="👤" accent="blue" />
            <StatCard label="Commandes" value={String(d.orders ?? '—')} icon="📦" accent="blue" />
            <StatCard label="Commandes payées" value={String(d.paid_orders ?? '—')} icon="✅" accent="green" />
            <StatCard label="Valeur brute des commandes" value={d.gross_order_value != null ? formatMoney(d.gross_order_value) : '—'} icon="💰" accent="gold" />
          </View>
        )}
        <Text style={s.note}>GET /admin/dashboard ne fournit que ces 4 compteurs pour l'instant — aucune évolution dans le temps n'est disponible côté serveur.</Text>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing[5], gap: spacing[4] },
  title: { color: colors.textPrimary, fontFamily: fonts.brand, fontSize: fontSize['2xl'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  note: { color: colors.textMuted, fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 16 },
  error: { color: colors.red, fontFamily: fonts.body },
});
