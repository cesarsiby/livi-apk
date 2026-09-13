import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { sellerApi, DeliveryProof } from '../../features/seller/sellerApi';
import { Screen, ProofDisplay, Button } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

// See RAPPORT_AUDIT_QR_PIN.md, points G/L.2/N.3 — until now there was no
// screen where the Seller could see the seller_pickup code they need to
// hand the Transporter. Backed by GET /orders/:id/pickup-proof.
export function SellerPickupProofScreen({ route }: any) {
  const orderId = String(route.params.orderId);
  const [proof, setProof] = useState<DeliveryProof | null>(null);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setNotReady(false);
    setError(null);
    sellerApi.pickupProof(orderId)
      .then(setProof)
      .catch((e: any) => {
        // 409 here specifically means "no transporter assigned yet" (see
        // getActiveProof / PROOF_UNAVAILABLE) — worth its own calm message
        // rather than a generic error.
        if (e?.status === 409) setNotReady(true);
        else setError(e?.message ?? 'Impossible de récupérer le code.');
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen centered>
      {loading ? (
        <ActivityIndicator color={colors.gold} />
      ) : proof ? (
        <ProofDisplay
          title="Code de remise au transporteur"
          helperText="Montrez ce QR ou communiquez ce code au transporteur lorsqu'il vient récupérer le colis."
          pin={proof.pin}
          qrPayload={proof.qr_payload}
          expiresAt={proof.expires_at}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.message} maxFontSizeMultiplier={1.6}>
            {notReady
              ? "Le code sera disponible dès qu'un transporteur aura accepté cette mission."
              : (error ?? 'Impossible de récupérer le code.')}
          </Text>
          <Button title="Actualiser" variant="secondary" onPress={load} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing[4], paddingHorizontal: spacing[4] },
  message: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    color: colors.gray2,
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
});
