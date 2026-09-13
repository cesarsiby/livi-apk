import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { sellerApi } from '../../features/seller/sellerApi';
import { Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function PayoutsScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    sellerApi.payouts().then(setData).catch((e) => Alert.alert('Paiements', e.message)).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.gold} /></View>;

  const payouts = data?.payouts ?? data?.items ?? [];
  const available = data?.available_balance ?? data?.balance ?? null;

  return (
    <FlatList
      style={s.screen}
      data={payouts}
      keyExtractor={(x, i) => String(x.id ?? i)}
      contentContainerStyle={s.list}
      ListHeaderComponent={
        <View style={s.header}>
          <Text style={s.title}>Mes versements</Text>
          <Text style={s.balance}>{available == null ? '—' : `${Number(available).toLocaleString()} FCFA`}</Text>
          <Text style={s.muted}>Solde disponible pour versement</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Montant" placeholderTextColor={colors.textMuted} style={s.input} />
          <TextInput value={destination} onChangeText={setDestination} autoCapitalize="none" placeholder="Identifiant de destination" placeholderTextColor={colors.textMuted} style={s.input} />
          <Pressable
            style={s.btn}
            disabled={busy || !amount || destination.trim().length < 3}
            onPress={async () => {
              try {
                setBusy(true);
                const r = await sellerApi.requestPayout({ amount: Number(amount), destination_ref: destination.trim() });
                Alert.alert('Versement', r?.message ?? 'Demande envoyée.');
                setAmount(''); setDestination(''); load();
              } catch (e: any) { Alert.alert('Versement', e.message); }
              finally { setBusy(false); }
            }}
          >
            <Text style={s.btnText}>{busy ? 'Envoi…' : 'Demander un versement'}</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={<Text style={s.empty}>Aucun versement.</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => item.id && navigation.navigate('WithdrawalDetails', { withdrawalId: String(item.id) })}>
          <Card style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.label ?? item.reference ?? 'Versement'}</Text>
              <Text style={s.muted}>{item.status ?? '—'}</Text>
            </View>
            <Text style={s.amount}>{item.amount == null ? '—' : `${Number(item.amount).toLocaleString()} FCFA`}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3] },
  header: { gap: spacing[3], marginBottom: spacing[3] },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  balance: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.gold },
  muted: { color: colors.gray2, fontFamily: fonts.body },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], backgroundColor: colors.dark3, color: colors.textPrimary, fontFamily: fonts.body },
  btn: { backgroundColor: colors.gold, padding: spacing[4], borderRadius: radius.full, alignItems: 'center' },
  btnText: { color: colors.dark, fontFamily: fonts.bodyBold },
  card: { padding: spacing[4], flexDirection: 'row', gap: spacing[3] },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  amount: { fontFamily: fonts.bodyBold, color: colors.gold },
  empty: { textAlign: 'center', padding: spacing[10], color: colors.textMuted, fontFamily: fonts.body },
});
