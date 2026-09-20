import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import {
  ordersApi,
  DeliveryProof,
} from '../../features/orders/ordersApi';

import {
  Button,
  ProofDisplay,
  Skeleton,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

export function BuyerQRValidationScreen({
  route,
  navigation,
}: any) {
  const orderId = route.params?.orderId
    ? String(route.params.orderId)
    : '';

  const [
    permission,
    requestPermission,
  ] = useCameraPermissions();

  const [scanning, setScanning] =
    useState(false);

  const [pin, setPin] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [myProof, setMyProof] =
    useState<DeliveryProof | null>(null);

  const [proofLoading, setProofLoading] =
    useState(false);

  const [proofUnavailable, setProofUnavailable] =
    useState(false);

  const loadMyProof = useCallback(
    async () => {
      if (!orderId) {
        setMyProof(null);
        return;
      }

      setProofLoading(true);
      setProofUnavailable(false);

      try {
        const proof =
          await ordersApi.deliveryProof(
            orderId,
          );

        setMyProof(proof);
      } catch {
        // The backend currently returns no proof before a transporter
        // has accepted the mission. The empty state is therefore intentional.
        setMyProof(null);
        setProofUnavailable(true);
      } finally {
        setProofLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    loadMyProof();
  }, [loadMyProof]);

  async function submit(
    payload: {
      pin?: string;
      qr_token?: string;
    },
  ) {
    if (!orderId) {
      Alert.alert(
        'Commande requise',
        'Cette validation doit être liée à une commande LIVI.',
      );
      return;
    }

    try {
      setBusy(true);

      await ordersApi.confirmReceipt(
        orderId,
        payload,
      );

      setPin('');
      setScanning(false);

      Alert.alert(
        'Réception confirmée',
        'Le backend LIVI a confirmé la réception de la commande.',
        [
          {
            text: 'Voir la commande',
            onPress: () =>
              navigation.navigate(
                'OrderDetails',
                { orderId },
              ),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert(
        'Validation refusée',
        e?.message ??
          'La confirmation a été refusée par le serveur.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    scanning &&
    permission?.granted
  ) {
    return (
      <View style={styles.cameraScreen}>
        <CameraView
          style={
            StyleSheet.absoluteFillObject
          }
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={({ data }) => {
            setScanning(false);
            submit({
              qr_token: data,
            });
          }}
        />

        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraEyebrow}>
              LIVI
            </Text>

            <Text style={styles.cameraTitle}>
              Scanner le QR de réception
            </Text>
          </View>

          <View style={styles.frame}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
          </View>

          <Text style={styles.cameraHint}>
            Cadrez le QR associé à cette commande.
          </Text>

          <Pressable
            onPress={() => setScanning(false)}
            disabled={busy}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>
              Annuler
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          COMMANDE LIVI
        </Text>

        <Text style={styles.title}>
          Confirmer la réception
        </Text>

        <Text style={styles.subtitle}>
          Présentez le code au transporteur ou utilisez-le pour confirmer
          la réception de la commande.
        </Text>
      </View>

      <View style={styles.orderCard}>
        <Text style={styles.orderLabel}>
          Commande
        </Text>

        <Text
          style={styles.orderId}
          numberOfLines={1}
        >
          {orderId || 'Non sélectionnée'}
        </Text>
      </View>

      {proofLoading ? (
        <View style={styles.proofLoading}>
          <Skeleton
            height={360}
            radius={radius['2xl']}
          />
        </View>
      ) : myProof ? (
        <ProofDisplay
          title="Votre code de livraison"
          helperText="Présentez ce QR ou communiquez le code à 6 chiffres au transporteur."
          pin={myProof.pin}
          qrPayload={myProof.qr_payload}
          expiresAt={myProof.expires_at}
        />
      ) : proofUnavailable ? (
        <View style={styles.waitingCard}>
          <View style={styles.waitingIcon}>
            <Text style={styles.waitingIconText}>
              …
            </Text>
          </View>

          <Text style={styles.waitingTitle}>
            Code pas encore disponible
          </Text>

          <Text style={styles.waitingText}>
            Le code de livraison apparaît lorsque la preuve correspondante
            est disponible côté serveur.
          </Text>

          <Pressable
            onPress={loadMyProof}
            style={styles.refreshLink}
          >
            <Text style={styles.refreshText}>
              Actualiser
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.secureCard}>
        <View style={styles.secureDot} />

        <Text style={styles.secureText}>
          Le QR et le PIN sont transmis au backend. Le mobile ne valide
          jamais la preuve localement.
        </Text>
      </View>

      {!permission?.granted ? (
        <Button
          title="Autoriser la caméra"
          onPress={requestPermission}
          disabled={busy || !orderId}
          fullWidth
          size="lg"
        />
      ) : (
        <Button
          title="Scanner le QR"
          onPress={() => setScanning(true)}
          disabled={busy || !orderId}
          fullWidth
          size="lg"
        />
      )}

      <View style={styles.manualSection}>
        <View style={styles.dividerRow}>
          <View style={styles.line} />

          <Text style={styles.orText}>
            OU
          </Text>

          <View style={styles.line} />
        </View>

        <Text style={styles.manualTitle}>
          Saisir le PIN
        </Text>

        <TextInput
          value={pin}
          onChangeText={setPin}
          editable={!busy}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="Code à 6 chiffres"
          placeholderTextColor={
            colors.textMuted
          }
          style={styles.pinInput}
        />

        <Button
          title={
            busy
              ? 'Confirmation…'
              : 'Confirmer la réception'
          }
          onPress={() =>
            submit({
              pin: pin.trim(),
            })
          }
          disabled={
            busy ||
            !orderId ||
            pin.trim().length === 0
          }
          loading={busy}
          fullWidth
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
    gap: spacing[4],
  },

  cameraScreen: {
    flex: 1,
    backgroundColor: '#000',
  },

  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[8],
    paddingBottom: spacing[8],
  },

  cameraHeader: {
    alignItems: 'center',
    gap: spacing[1],
  },

  cameraEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
    color: colors.gold,
  },

  cameraTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.white,
    textAlign: 'center',
  },

  frame: {
    width: 268,
    height: 268,
    position: 'relative',
  },

  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 38,
    height: 38,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: colors.gold,
    borderTopLeftRadius: radius.lg,
  },

  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 38,
    height: 38,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderColor: colors.gold,
    borderTopRightRadius: radius.lg,
  },

  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 38,
    height: 38,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderColor: colors.gold,
    borderBottomLeftRadius: radius.lg,
  },

  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 38,
    height: 38,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: colors.gold,
    borderBottomRightRadius: radius.lg,
  },

  cameraHint: {
    maxWidth: 320,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.white,
    textAlign: 'center',
  },

  cancelButton: {
    minHeight: 46,
    paddingHorizontal: spacing[5],
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.white,
  },

  cancelButtonText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.white,
  },

  header: {
    gap: spacing[1],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.6,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  orderCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[2],
  },

  orderLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  orderId: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  proofLoading: {
    gap: spacing[3],
  },

  waitingCard: {
    alignItems: 'center',
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },

  waitingIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  waitingIconText: {
    fontFamily: fonts.brandSemibold,
    fontSize: 28,
    color: colors.gold,
  },

  waitingTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  waitingText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  refreshLink: {
    paddingVertical: spacing[2],
  },

  refreshText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  secureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  secureDot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },

  secureText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  manualSection: {
    gap: spacing[3],
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  orText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textMuted,
  },

  manualTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  pinInput: {
    minHeight: 64,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize['2xl'],
    letterSpacing: 5,
    textAlign: 'center',
    color: colors.textPrimary,
  },
});
