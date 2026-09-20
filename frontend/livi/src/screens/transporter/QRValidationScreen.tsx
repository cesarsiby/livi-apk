import React, { useState } from 'react';
import {
  ActivityIndicator,
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

import { transporterApi } from '../../features/transporter/transporterApi';

import {
  Button,
  Card,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

const ERROR_LABELS: Record<
  string,
  string
> = {
  QR_INVALID:
    'Ce code ne correspond pas à un QR LIVI valide.',
  PROOF_NOT_FOUND:
    'Aucune preuve LIVI ne correspond à ce code.',
  PROOF_UNAVAILABLE:
    'Ce code est expiré ou a déjà été utilisé.',
  FORBIDDEN:
    "Cette preuve ne correspond pas à l'une de vos missions.",
};

type ScanResult = {
  proof_id: string;
  shipment_id: string;
  proof_type: string;
  order_id: string;
  order_status?: string;
  shipment_status?: string;
};

type ScannerState =
  | 'idle'
  | 'processing'
  | 'success'
  | 'error';

function getProofLabel(
  proofType?: string,
) {
  switch (proofType) {
    case 'seller_pickup':
      return 'Remise vendeur identifiée';

    case 'buyer_delivery':
      return 'Livraison identifiée';

    default:
      return 'Preuve LIVI identifiée';
  }
}

export function QRValidationScreen({
  navigation,
}: any) {
  const [
    permission,
    requestPermission,
  ] = useCameraPermissions();

  const [scanning, setScanning] =
    useState(false);

  const [code, setCode] = useState('');

  const [status, setStatus] =
    useState<ScannerState>('idle');

  const [result, setResult] =
    useState<ScanResult | null>(null);

  const [errorMessage, setErrorMessage] =
    useState('');

  async function validate(value: string) {
    const normalized = value.trim();

    if (
      !normalized ||
      status === 'processing'
    ) {
      return;
    }

    setStatus('processing');
    setScanning(false);
    setErrorMessage('');

    try {
      const response =
        await transporterApi.scanQR(
          normalized,
        );

      setResult(response as ScanResult);
      setStatus('success');
    } catch (e: any) {
      const backendCode =
        e?.details?.error?.code;

      setErrorMessage(
        ERROR_LABELS[backendCode] ??
          e?.message ??
          'Le code n’a pas pu être vérifié.',
      );

      setStatus('error');
    }
  }

  function reset() {
    setStatus('idle');
    setResult(null);
    setErrorMessage('');
    setCode('');
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
          onBarcodeScanned={({ data }) =>
            validate(data)
          }
        />

        <View style={styles.cameraOverlay}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerEyebrow}>
              LIVI SCANNER
            </Text>

            <Text style={styles.scannerTitle}>
              Placez le QR dans le cadre
            </Text>
          </View>

          <View style={styles.frame}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
          </View>

          <Text style={styles.scannerHint}>
            Le code sera transmis au serveur pour
            identification.
          </Text>

          <Pressable
            onPress={() => setScanning(false)}
            style={styles.cancelScan}
          >
            <Text style={styles.cancelScanText}>
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
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          TRANSPORTEUR LIVI
        </Text>

        <Text style={styles.title}>
          Scanner une preuve
        </Text>

        <Text style={styles.subtitle}>
          Identifiez un QR ou un code transmis à votre mission.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoDot} />

        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>
            Vérification serveur
          </Text>

          <Text style={styles.infoText}>
            Le téléphone n’accepte jamais une preuve seul. Le backend
            LIVI décide si le code peut être utilisé.
          </Text>
        </View>
      </View>

      {status === 'processing' ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator
            color={colors.gold}
            size="small"
          />

          <Text style={styles.stateTitle}>
            Vérification en cours
          </Text>

          <Text style={styles.stateText}>
            Nous interrogeons le serveur LIVI.
          </Text>
        </Card>
      ) : null}

      {status === 'success' &&
      result ? (
        <Card style={styles.stateCard}>
          <View style={styles.successMark}>
            <Text style={styles.successMarkText}>
              ✓
            </Text>
          </View>

          <Text style={styles.stateTitle}>
            {getProofLabel(
              result.proof_type,
            )}
          </Text>

          <Text style={styles.stateText}>
            Commande #{String(result.order_id).slice(
              0,
              8,
            )}
          </Text>

          <Text style={styles.missionHint}>
            Ouvrez ensuite la mission pour exécuter
            la prise en charge ou la livraison.
          </Text>

          <Button
            title="Ouvrir la mission"
            onPress={() =>
              navigation.navigate(
                'MissionDetails',
                {
                  missionId:
                    result.shipment_id,
                },
              )
            }
            fullWidth
            size="lg"
          />

          <Pressable
            onPress={reset}
            style={styles.secondaryLink}
          >
            <Text style={styles.secondaryLinkText}>
              Scanner un autre code
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {status === 'error' ? (
        <Card
          style={[
            styles.stateCard,
            styles.errorState,
          ]}
        >
          <View style={styles.errorMark}>
            <Text style={styles.errorMarkText}>
              !
            </Text>
          </View>

          <Text style={styles.stateTitle}>
            Code non accepté
          </Text>

          <Text style={styles.stateText}>
            {errorMessage}
          </Text>

          <Pressable
            onPress={reset}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>
              Réessayer
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {status === 'idle' ? (
        <>
          <View style={styles.scannerActions}>
            {!permission?.granted ? (
              <Button
                title="Autoriser la caméra"
                onPress={
                  requestPermission
                }
                fullWidth
                size="lg"
              />
            ) : (
              <Button
                title="Scanner un QR"
                onPress={() =>
                  setScanning(true)
                }
                fullWidth
                size="lg"
              />
            )}
          </View>

          <View style={styles.manualSection}>
            <View style={styles.manualDivider}>
              <View
                style={styles.line}
              />

              <Text
                style={styles.orText}
              >
                OU
              </Text>

              <View
                style={styles.line}
              />
            </View>

            <Text style={styles.manualTitle}>
              Saisie manuelle
            </Text>

            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Token QR ou code PIN"
              placeholderTextColor={
                colors.textMuted
              }
              style={styles.input}
            />

            <Button
              title="Vérifier le code"
              onPress={() =>
                validate(code)
              }
              disabled={!code.trim()}
              variant="outline"
              fullWidth
            />
          </View>
        </>
      ) : null}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[8],
    paddingBottom: spacing[8],
  },

  scannerHeader: {
    alignItems: 'center',
    gap: spacing[1],
  },

  scannerEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
    color: colors.gold,
  },

  scannerTitle: {
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
    left: 0,
    top: 0,
    width: 38,
    height: 38,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: colors.gold,
    borderTopLeftRadius: radius.lg,
  },

  cornerTopRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 38,
    height: 38,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderColor: colors.gold,
    borderTopRightRadius: radius.lg,
  },

  cornerBottomLeft: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 38,
    height: 38,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderColor: colors.gold,
    borderBottomLeftRadius: radius.lg,
  },

  cornerBottomRight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 38,
    height: 38,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: colors.gold,
    borderBottomRightRadius: radius.lg,
  },

  scannerHint: {
    maxWidth: 330,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.white,
    textAlign: 'center',
    opacity: 0.86,
  },

  cancelScan: {
    minHeight: 46,
    paddingHorizontal: spacing[5],
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.white,
    borderRadius: radius.full,
  },

  cancelScanText: {
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

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  infoDot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },

  infoCopy: {
    flex: 1,
    gap: spacing[1],
  },

  infoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  infoText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  stateCard: {
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
  },

  successMark: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.greenBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  successMarkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    color: colors.textPrimary,
  },

  errorMark: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorMarkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    color: colors.textPrimary,
  },

  stateTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  stateText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  missionHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },

  errorState: {
    borderColor: colors.redBorder,
  },

  secondaryLink: {
    paddingVertical: spacing[2],
  },

  secondaryLinkText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  retryButton: {
    paddingVertical: spacing[2],
  },

  retryButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  scannerActions: {
    gap: spacing[3],
  },

  manualSection: {
    gap: spacing[3],
  },

  manualDivider: {
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

  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },
});
