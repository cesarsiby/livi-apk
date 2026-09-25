import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ordersApi, DeliveryProof } from '../../features/orders/ordersApi';
import { Button, Card, ProofDisplay, Skeleton } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function BuyerQRValidationScreen({ route, navigation }: any) {
  const orderId = route?.params?.orderId ? String(route.params.orderId) : '';
  const [busy, setBusy] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofUnavailable, setProofUnavailable] = useState(false);
  const [myProof, setMyProof] = useState<DeliveryProof | null>(null);

  const loadMyProof = useCallback(async () => {
    if (!orderId) return;
    setProofLoading(true);
    setProofUnavailable(false);
    try {
      const proof = await ordersApi.deliveryProof(orderId);
      setMyProof(proof);
    } catch {
      setMyProof(null);
      setProofUnavailable(true);
    } finally {
      setProofLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void loadMyProof(); }, [loadMyProof]);

  async function confirmReceipt() {
    if (!orderId) {
      Alert.alert('Commande requise', 'Cette validation doit être liée à une commande LIVI.');
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>COMMANDE LIVI</Text>
      <Text style={styles.title}>Confirmer la réception</Text>
      <Text style={styles.subtitle}>
        Présentez le QR ou le PIN au transporteur pour valider la remise physique. Après la remise, confirmez simplement la réception dans LIVI.
      </Text>

      <Card>
        <Text style={styles.label}>Commande</Text>
        <Text style={styles.orderId}>{orderId || 'Non sélectionnée'}</Text>
      </Card>

      {proofLoading ? <Skeleton height={320} radius={radius['2xl']} /> : null}
      {!proofLoading && myProof ? (
        <ProofDisplay
          title="Votre code de livraison"
          helperText="Ce QR/PIN sert au transporteur pour valider la remise physique. Il ne doit pas être réutilisé par l’acheteur."
          pin={myProof.pin}
          qrPayload={myProof.qr_payload}
          expiresAt={myProof.expires_at}
        />
      ) : null}
      {!proofLoading && !myProof && proofUnavailable ? (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingTitle}>Code pas encore disponible</Text>
          <Text style={styles.waitingText}>Le code apparaît lorsque l’expédition atteint l’étape où il est nécessaire.</Text>
          <Pressable onPress={() => void loadMyProof}><Text style={styles.refresh}>Actualiser</Text></Pressable>
        </View>
      ) : null}

      <View style={styles.notice}>
        <Text style={styles.noticeText}>Le QR/PIN est une preuve de remise à usage unique. La confirmation de réception est une action authentifiée séparée.</Text>
      </View>

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
  eyebrow: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: fontSize.xs, letterSpacing: 1.5 },
  title: { color: colors.textPrimary, fontFamily: fonts.brand, fontSize: fontSize['3xl'], lineHeight: 38 },
  subtitle: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 20 },
  label: { color: colors.textMuted, fontFamily: fonts.bodyBold, fontSize: fontSize.xs, textTransform: 'uppercase' },
  orderId: { color: colors.textPrimary, fontFamily: fonts.bodySemibold, fontSize: fontSize.base, marginTop: spacing[2] },
  waitingCard: { padding: spacing[5], borderRadius: radius['2xl'], backgroundColor: colors.dark2, borderWidth: 1, borderColor: colors.border, gap: spacing[3] },
  waitingTitle: { color: colors.textPrimary, fontFamily: fonts.brandSemibold, fontSize: fontSize.lg },
  waitingText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 19 },
  refresh: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  notice: { padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border },
  noticeText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 18 },
});
