import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  CameraView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';

import {
  transporterApi,
  Mission,
} from '../../features/transporter/transporterApi';

import { getCurrentLocation } from '../../services/device/location';

import {
  Button,
  CountdownTimer,
  Money,
  RatingPrompt,
  Skeleton,
  StatusBadge,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

type QRTarget =
  | 'pickup'
  | 'deliver'
  | null;

function Step({
  number,
  title,
  text,
  active,
  completed,
}: {
  number: number;
  title: string;
  text: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <View
      style={[
        styles.step,
        active && styles.stepActive,
      ]}
    >
      <View
        style={[
          styles.stepNumber,
          (active || completed) &&
            styles.stepNumberActive,
        ]}
      >
        {completed ? (
          <Text
            style={styles.stepCheck}
          >
            ✓
          </Text>
        ) : (
          <Text
            style={[
              styles.stepNumberText,
              active &&
                styles.stepNumberTextActive,
            ]}
          >
            {number}
          </Text>
        )}
      </View>

      <View style={styles.stepContent}>
        <Text
          style={[
            styles.stepTitle,
            active &&
              styles.stepTitleActive,
          ]}
        >
          {title}
        </Text>

        <Text style={styles.stepText}>
          {text}
        </Text>
      </View>
    </View>
  );
}

function AddressCard({
  title,
  name,
  address,
  city,
  phone,
  neighborhood,
  landmarkType,
  landmarkDescription,
}: {
  title: string;
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  neighborhood?: string;
  landmarkType?: string;
  landmarkDescription?: string;
}) {
  return (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressIcon}>
          <Text style={styles.addressIconText}>
            {title === 'Collecte'
              ? '↑'
              : '↓'}
          </Text>
        </View>

        <View style={styles.addressIdentity}>
          <Text
            style={styles.addressTitle}
          >
            {title}
          </Text>

          {name ? (
            <Text style={styles.addressName}>
              {name}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.addressBody}>
        <Text style={styles.addressText}>
          {[
            address,
            neighborhood,
            city,
          ]
            .filter(Boolean)
            .join(', ') ||
            'Adresse non renseignée'}
        </Text>

        {phone ? (
          <Text style={styles.addressPhone}>
            {phone}
          </Text>
        ) : null}

        {landmarkDescription ? (
          <View style={styles.landmark}>
            <Text style={styles.landmarkLabel}>
              REPÈRE
            </Text>

            <Text
              style={styles.landmarkText}
            >
              {landmarkType
                ? `${landmarkType} · `
                : ''}
              {landmarkDescription}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ProofCard({
  title,
  description,
  value,
  onChange,
  placeholder,
  actionLabel,
  scanLabel,
  onAction,
  onScan,
  busy,
  disabled,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  actionLabel: string;
  scanLabel: string;
  onAction: () => void;
  onScan: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <View style={styles.proofCard}>
      <View style={styles.proofHeader}>
        <View style={styles.proofIcon}>
          <Text style={styles.proofIconText}>
            QR
          </Text>
        </View>

        <View style={styles.proofIdentity}>
          <Text style={styles.proofTitle}>
            {title}
          </Text>

          <Text style={styles.proofDescription}>
            {description}
          </Text>
        </View>
      </View>

      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={8}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.pinInput}
      />

      <Button
        title={
          busy
            ? 'Validation…'
            : actionLabel
        }
        disabled={busy || disabled}
        loading={busy}
        onPress={onAction}
        fullWidth
      />

      <Button
        title={scanLabel}
        variant="outline"
        disabled={busy}
        onPress={onScan}
        fullWidth
      />
    </View>
  );
}

function Scanner({
  onScanned,
  onCancel,
}: {
  onScanned: (value: string) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] =
    useCameraPermissions();

  if (!permission) {
    return (
      <View style={styles.scannerCenter}>
        <Text style={styles.scannerText}>
          Préparation de la caméra…
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.scannerCenter}>
        <Text style={styles.scannerTitle}>
          Scanner un QR Livi
        </Text>

        <Text style={styles.scannerText}>
          La caméra est nécessaire pour
          lire la preuve de remise.
        </Text>

        <Button
          title="Autoriser la caméra"
          onPress={requestPermission}
          fullWidth
        />

        <Button
          title="Annuler"
          variant="ghost"
          onPress={onCancel}
          fullWidth
        />
      </View>
    );
  }

  return (
    <View style={styles.scanner}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={({
          data,
        }) => {
          if (data) {
            onScanned(data);
          }
        }}
      />

      <View
        pointerEvents="none"
        style={styles.scannerOverlay}
      >
        <View style={styles.scannerFrame} />

        <Text style={styles.scannerHint}>
          Placez le QR Livi dans le cadre
        </Text>
      </View>

      <Pressable
        style={styles.scannerCancel}
        onPress={onCancel}
      >
        <Text style={styles.scannerCancelText}>
          Fermer
        </Text>
      </Pressable>
    </View>
  );
}

export function MissionDetailsScreen({
  route,
  navigation,
}: any) {
  const id = String(
    route?.params?.missionId ?? '',
  );

  const [mission, setMission] =
    useState<Mission | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [pickupPin, setPickupPin] =
    useState('');

  const [deliveryPin, setDeliveryPin] =
    useState('');

  const [qrTarget, setQrTarget] =
    useState<QRTarget>(null);

  const [error, setError] =
    useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const data =
          await transporterApi.mission(
            id,
          );

        setMission(data);
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger la mission.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const status = String(
    mission?.status ?? '',
  ).toLowerCase();

  const isOffer =
    Boolean(
      mission &&
        !mission.transporter_id &&
        mission.offered_to,
    );

  const canPickup =
    status === 'assigned';

  const canArrive =
    status === 'in_transit';

  const canDeliver =
    status === 'in_transit' ||
    status === 'arrived';

  const isDone =
    status === 'delivered' ||
    status === 'completed';

  const stepIndex =
    isOffer
      ? 0
      : status === 'assigned'
        ? 1
        : status === 'in_transit'
          ? 2
          : status === 'arrived'
            ? 3
            : status === 'delivered'
              ? 4
              : 0;

  async function execute(
    type:
      | 'accept'
      | 'reject'
      | 'pickup'
      | 'arrive'
      | 'deliver',
    qrToken?: string,
  ) {
    if (!mission) return;

    try {
      setBusy(true);
      setError('');

      switch (type) {
        case 'accept':
          await transporterApi.acceptMission(
            mission.id,
          );
          break;

        case 'reject':
          await transporterApi.rejectMission(
            mission.id,
          );
          break;

        case 'pickup':
          await transporterApi.pickup(
            mission.id,
            qrToken
              ? {
                  qr_token: qrToken,
                }
              : {
                  pin: pickupPin.trim(),
                },
          );
          break;

        case 'arrive': {
          const location =
            await getCurrentLocation();

          await transporterApi.arrive(
            mission.id,
            location,
          );
          break;
        }

        case 'deliver':
          await transporterApi.deliver(
            mission.id,
            qrToken
              ? {
                  qr_token: qrToken,
                }
              : {
                  pin:
                    deliveryPin.trim(),
                },
          );
          break;
      }

      setPickupPin('');
      setDeliveryPin('');

      await load(true);
    } catch (e: any) {
      setError(
        e?.message ??
          'Action refusée par le serveur.',
      );
    } finally {
      setBusy(false);
    }
  }

  const onScanned =
    async (data: string) => {
      const target = qrTarget;

      setQrTarget(null);

      if (target === 'pickup') {
        await execute(
          'pickup',
          data,
        );
      }

      if (target === 'deliver') {
        await execute(
          'deliver',
          data,
        );
      }
    };

  if (qrTarget) {
    return (
      <Scanner
        onScanned={(data) =>
          void onScanned(data)
        }
        onCancel={() =>
          setQrTarget(null)
        }
      />
    );
  }

  if (loading) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.loadingContainer
        }
      >
        <Skeleton
          height={46}
          radius={radius.lg}
        />

        <Skeleton
          height={210}
          radius={radius['2xl']}
        />

        <Skeleton
          height={190}
          radius={radius.xl}
        />

        <Skeleton
          height={220}
          radius={radius.xl}
        />
      </ScrollView>
    );
  }

  if (!mission) {
    return (
      <View style={styles.errorState}>
        <Text style={styles.errorStateTitle}>
          Mission indisponible
        </Text>

        <Text style={styles.errorStateText}>
          {error ||
            'Impossible de récupérer cette mission.'}
        </Text>

        <Button
          title="Réessayer"
          onPress={() =>
            void load()
          }
          fullWidth
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.container
      }
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            load(true)
          }
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>
            MISSION
          </Text>

          <Text
            numberOfLines={1}
            style={styles.title}
          >
            {(mission as any)
              .tracking_code ??
              mission.reference ??
              `#${String(
                mission.id,
              ).slice(0, 8)}`}
          </Text>
        </View>

        <StatusBadge
          domain="delivery"
          status={mission.status}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      {isOffer &&
      mission.offer_expires_at ? (
        <View style={styles.offerCard}>
          <View style={styles.offerCopy}>
            <Text style={styles.offerEyebrow}>
              PROPOSITION POUR VOUS
            </Text>

            <Text style={styles.offerTitle}>
              Une nouvelle livraison vous est
              proposée.
            </Text>

            <Text style={styles.offerText}>
              Répondez avant l’expiration du
              minuteur.
            </Text>
          </View>

          <CountdownTimer
            expiresAt={
              mission.offer_expires_at
            }
            onExpire={() =>
              void load()
            }
          />

          <View style={styles.offerActions}>
            <Button
              title="Refuser"
              variant="red"
              disabled={busy}
              onPress={() =>
                void execute(
                  'reject',
                )
              }
              style={styles.offerButton}
            />

            <Button
              title="Accepter"
              variant="green"
              disabled={busy}
              loading={busy}
              onPress={() =>
                void execute(
                  'accept',
                )
              }
              style={styles.offerButton}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.amountCard}>
        <View>
          <Text style={styles.amountLabel}>
            FRAIS DE LIVRAISON
          </Text>

          {mission.shipping_fee != null ? (
            <Money
              amount={
                mission.shipping_fee
              }
              currency="FCFA"
              size="xl"
              color={colors.gold}
            />
          ) : (
            <Text
              style={
                styles.amountUnavailable
              }
            >
              Non renseignés
            </Text>
          )}
        </View>

        <View style={styles.assignmentBadge}>
          <Text
            style={
              styles.assignmentBadgeText
            }
          >
            {mission.transporter_id
              ? 'ASSIGNÉE'
              : 'PROPOSITION'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Parcours
          </Text>

          <Text style={styles.sectionSubtitle}>
            Étape actuelle : {stepIndex + 1}/5
          </Text>
        </View>

        <View style={styles.stepsCard}>
          <Step
            number={1}
            title="Proposition"
            text="La mission vous est proposée."
            active={stepIndex === 0}
            completed={stepIndex > 0}
          />

          <Step
            number={2}
            title="Prise en charge"
            text="Validez la remise du colis par le vendeur."
            active={stepIndex === 1}
            completed={stepIndex > 1}
          />

          <Step
            number={3}
            title="Acheminement"
            text="Déclarez votre arrivée lorsque vous atteignez la destination."
            active={stepIndex === 2}
            completed={stepIndex > 2}
          />

          <Step
            number={4}
            title="Arrivée"
            text="Le colis est prêt pour la remise au client."
            active={stepIndex === 3}
            completed={stepIndex > 3}
          />

          <Step
            number={5}
            title="Remise"
            text="Validez le QR ou PIN du client."
            active={stepIndex === 4}
            completed={isDone}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Trajet
          </Text>

          <Text style={styles.sectionSubtitle}>
            Les informations utiles pour la livraison.
          </Text>
        </View>

        <AddressCard
          title="Collecte"
          name={
            mission.pickup_shop_name
          }
          address={
            mission.pickup_address
          }
          city={
            mission.pickup_city
          }
          phone={
            mission.pickup_phone
          }
        />

        <AddressCard
          title="Livraison"
          name={
            mission.delivery_recipient_name
          }
          address={
            mission.delivery_address_line
          }
          city={
            mission.delivery_city
          }
          phone={
            mission.delivery_phone
          }
          neighborhood={
            mission.delivery_neighborhood
          }
          landmarkType={
            mission.delivery_landmark_type
          }
          landmarkDescription={
            mission.delivery_landmark_description
          }
        />
      </View>

      {canPickup ? (
        <View style={styles.section}>
          <ProofCard
            title="Prise en charge du colis"
            description="Utilisez le PIN ou le QR fourni par le vendeur."
            value={pickupPin}
            onChange={setPickupPin}
            placeholder="PIN vendeur"
            actionLabel="Valider la prise en charge"
            scanLabel="Scanner le QR vendeur"
            onAction={() =>
              void execute(
                'pickup',
              )
            }
            onScan={() =>
              setQrTarget(
                'pickup',
              )
            }
            busy={busy}
            disabled={
              !pickupPin.trim()
            }
          />
        </View>
      ) : null}

      {canArrive ? (
        <View style={styles.section}>
          <View style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>
                ↓
              </Text>
            </View>

            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>
                Vous êtes arrivé ?
              </Text>

              <Text
                style={
                  styles.actionSubtitle
                }
              >
                Cette action enregistre votre arrivée
                avec votre position actuelle.
              </Text>
            </View>

            <Button
              title={
                busy
                  ? 'Envoi…'
                  : 'Je suis arrivé'
              }
              disabled={busy}
              loading={busy}
              onPress={() =>
                void execute(
                  'arrive',
                )
              }
            />
          </View>
        </View>
      ) : null}

      {canDeliver ? (
        <View style={styles.section}>
          <ProofCard
            title="Remise à l’acheteur"
            description="Utilisez le PIN ou le QR de la commande."
            value={deliveryPin}
            onChange={setDeliveryPin}
            placeholder="PIN acheteur"
            actionLabel="Confirmer la remise"
            scanLabel="Scanner le QR acheteur"
            onAction={() =>
              void execute(
                'deliver',
              )
            }
            onScan={() =>
              setQrTarget(
                'deliver',
              )
            }
            busy={busy}
            disabled={
              !deliveryPin.trim()
            }
          />
        </View>
      ) : null}

      {isDone ? (
        <View style={styles.completedCard}>
          <View style={styles.completedIcon}>
            <Text
              style={
                styles.completedIconText
              }
            >
              ✓
            </Text>
          </View>

          <Text style={styles.completedTitle}>
            Livraison terminée
          </Text>

          <Text style={styles.completedText}>
            La remise a été enregistrée dans le parcours
            de la mission.
          </Text>
        </View>
      ) : null}

      {isDone &&
      mission.order_id ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Votre évaluation
            </Text>

            <Text style={styles.sectionSubtitle}>
              Donnez votre retour sur les participants de la
              livraison.
            </Text>
          </View>

          {mission.buyer_id ? (
            <RatingPrompt
              orderId={
                mission.order_id
              }
              ratedId={
                mission.buyer_id
              }
              ratedLabel="l’acheteur"
            />
          ) : null}

          {mission.vendor_id ? (
            <RatingPrompt
              orderId={
                mission.order_id
              }
              ratedId={
                mission.vendor_id
              }
              ratedLabel="le vendeur"
            />
          ) : null}
        </View>
      ) : null}

      <Pressable
        style={styles.refreshButton}
        onPress={() =>
          void load(true)
        }
      >
        <Text style={styles.refreshText}>
          Actualiser la mission
        </Text>
      </Pressable>

      <Pressable
        style={styles.backButton}
        onPress={() =>
          navigation.goBack()
        }
      >
        <Text style={styles.backButtonText}>
          Retour aux missions
        </Text>
      </Pressable>
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
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  loadingContainer: {
    padding: spacing[5],
    gap: spacing[4],
    backgroundColor: colors.dark,
  },

  errorState: {
    flex: 1,
    padding: spacing[6],
    justifyContent: 'center',
    backgroundColor: colors.dark,
  },

  errorStateTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    textAlign: 'center',
    color: colors.textPrimary,
  },

  errorStateText: {
    marginVertical: spacing[3],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textMuted,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  headerCopy: {
    flex: 1,
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
  },

  title: {
    marginTop: 2,
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
  },

  errorBox: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  offerCard: {
    marginTop: spacing[5],
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  offerCopy: {
    marginBottom: spacing[4],
  },

  offerEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.gold,
  },

  offerTitle: {
    marginTop: 3,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  offerText: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  offerActions: {
    marginTop: spacing[4],
    flexDirection: 'row',
    gap: spacing[3],
  },

  offerButton: {
    flex: 1,
  },

  amountCard: {
    marginTop: spacing[5],
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  amountLabel: {
    marginBottom: spacing[2],
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.3,
    color: colors.textMuted,
  },

  amountUnavailable: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  assignmentBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  assignmentBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.gold,
  },

  section: {
    marginTop: spacing[6],
  },

  sectionHeader: {
    marginBottom: spacing[3],
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  stepsCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  step: {
    minHeight: 72,
    flexDirection: 'row',
    gap: spacing[3],
  },

  stepActive: {
    opacity: 1,
  },

  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepNumberActive: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  stepNumberText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  stepNumberTextActive: {
    color: colors.gold,
  },

  stepCheck: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.gold,
  },

  stepContent: {
    flex: 1,
    paddingBottom: spacing[4],
  },

  stepTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  stepTitleActive: {
    color: colors.textPrimary,
  },

  stepText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  addressCard: {
    marginBottom: spacing[3],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  addressIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  addressIdentity: {
    flex: 1,
  },

  addressTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  addressName: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  addressBody: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  addressText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },

  addressPhone: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  landmark: {
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
  },

  landmarkLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
  },

  landmarkText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  proofCard: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  proofHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },

  proofIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  proofIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.gold,
  },

  proofIdentity: {
    flex: 1,
  },

  proofTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  proofDescription: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  pinInput: {
    minHeight: 58,
    marginBottom: spacing[3],
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.dark4,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xl,
    letterSpacing: 4,
  },

  actionCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  actionContent: {
    flex: 1,
  },

  actionTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  actionSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  completedCard: {
    marginTop: spacing[6],
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
  },

  completedIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  completedIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.dark,
  },

  completedTitle: {
    marginTop: spacing[4],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  completedText: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.textMuted,
  },

  refreshButton: {
    marginTop: spacing[6],
    minHeight: 46,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  refreshText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  backButton: {
    minHeight: 46,
    marginTop: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  scanner: {
    flex: 1,
    backgroundColor: '#000',
  },

  scannerOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scannerFrame: {
    width: 250,
    height: 250,
    borderRadius: radius.xl,
    borderWidth: 3,
    borderColor: colors.gold,
  },

  scannerHint: {
    marginTop: spacing[6],
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.white,
  },

  scannerCancel: {
    position: 'absolute',
    top: 55,
    right: spacing[5],
    minHeight: 42,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,15,26,0.75)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scannerCancelText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.white,
  },

  scannerCenter: {
    flex: 1,
    padding: spacing[6],
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.dark,
  },

  scannerTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  scannerText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
