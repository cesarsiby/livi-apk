import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { ordersApi } from '../../features/orders/ordersApi';
import { Button, Card } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function BuyerQRValidationScreen({ route, navigation }: any) {
  const orderId = route?.params?.orderId ? String(route.params.orderId) : '';
  const [busy, setBusy] = useState(false);

  async function confirmReceipt() {
    if (!orderId) {
      Alert.alert('Commande requise', 'Cette confirmation doit être liée à une commande LIVI.');
      return;
    }

    setBusy(true);
    try {
      await ordersApi.confirmReceipt(orderId, {});
      Alert.alert('Réception confirmée', 'La réception de la commande est confirmée.', [
        { text: 'Voir la commande', onPress: () => navigation.navigate('OrderDetails', { orderId }) },
      ]);
    } catch (e: any) {
      Alert.alert('Confirmation refusée', e?.message ?? 'La confirmation a été refusée par le serveur.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>COMMANDE LIVI</Text>
      <Text style={styles.title}>Confirmer la réception</Text>
      <Text style={styles.subtitle}>
        La remise physique est validée séparément par le transporteur. Après avoir reçu le colis,
        confirmez simplement sa réception dans LIVI.
      </Text>

      <Card>
        <Text style={styles.label}>Commande</Text>
        <Text style={styles.orderId}>{orderId || 'Non sélectionnée'}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Important</Text>
        <Text style={styles.body}>
          Le QR/PIN de remise est une preuve à usage unique destinée au transporteur. L’acheteur
          ne doit pas réutiliser cette preuve pour confirmer la réception.
        </Text>
      </Card>

      <Button
        title={busy ? 'Confirmation…' : 'Je confirme la réception'}
        onPress={() => void confirmReceipt()}
        disabled={busy || !orderId}
        loading={busy}
        fullWidth
        size="lg"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
  },
  orderId: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    marginTop: spacing[2],
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    marginBottom: spacing[2],
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
});
