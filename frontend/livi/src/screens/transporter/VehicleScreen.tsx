import React, {
  useCallback,
  useState,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  transporterApi,
} from '../../features/transporter/transporterApi';

import {
  Button,
  Skeleton,
  TextField,
  StatusBadge,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

export function VehicleScreen({
  navigation,
}: any) {
  const [type, setType] =
    useState('');

  const [plate, setPlate] =
    useState('');

  const [kycStatus, setKycStatus] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const load = useCallback(
    async () => {
      setLoading(true);
      setMessage('');

      try {
        const profile =
          await transporterApi.profile();

        setType(
          profile.vehicle_type ?? '',
        );

        setPlate(
          profile.vehicle_plate ?? '',
        );

        setKycStatus(
          profile.kyc_status ?? null,
        );
      } catch (e: any) {
        setMessage(
          e?.message ??
            'Impossible de charger les informations du véhicule.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    setSaving(true);
    setMessage('');

    try {
      await transporterApi.updateVehicle({
        vehicle_type:
          type.trim(),
        vehicle_plate:
          plate.trim(),
      });

      setMessage(
        'Informations du véhicule enregistrées.',
      );
    } catch (e: any) {
      setMessage(
        e?.message ??
          "Impossible d'enregistrer les informations.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.loading
        }
      >
        <Skeleton
          height={150}
          radius={radius['2xl']}
        />

        <Skeleton
          height={180}
          radius={radius.xl}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.container
      }
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          PROFIL TRANSPORTEUR
        </Text>

        <Text style={styles.title}>
          Mon véhicule
        </Text>

        <Text style={styles.subtitle}>
          Conservez les informations utilisées pour votre
          activité de livraison à jour.
        </Text>
      </View>

      <View style={styles.identityCard}>
        <View style={styles.vehicleIcon}>
          <Text style={styles.vehicleIconText}>
            +
          </Text>
        </View>

        <View style={styles.identityContent}>
          <Text style={styles.identityTitle}>
            Véhicule déclaré
          </Text>

          <Text style={styles.identityValue}>
            {type ||
              'Type de véhicule non renseigné'}
          </Text>

          <Text style={styles.identityPlate}>
            {plate ||
              'Plaque non renseignée'}
          </Text>
        </View>

        {kycStatus ? (
          <StatusBadge
            domain="kyc"
            status={kycStatus}
          />
        ) : null}
      </View>

      {message ? (
        <View
          style={[
            styles.messageBox,
            message.includes(
              'enregistrées',
            ) &&
              styles.successBox,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              message.includes(
                'enregistrées',
              ) &&
                styles.successText,
            ]}
          >
            {message}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Informations
          </Text>

          <Text style={styles.sectionSubtitle}>
            Seules les informations prises en charge par
            le contrat transporteur sont affichées.
          </Text>
        </View>

        <View style={styles.formCard}>
          <TextField
            label="Type de véhicule"
            value={type}
            onChangeText={setType}
            placeholder="Moto, tricycle, camionnette…"
          />

          <TextField
            label="Plaque d'immatriculation"
            value={plate}
            onChangeText={setPlate}
            placeholder="Plaque d'immatriculation"
            autoCapitalize="characters"
          />

          <Button
            title={
              saving
                ? 'Enregistrement…'
                : 'Enregistrer'
            }
            onPress={() =>
              void save()
            }
            disabled={saving}
            loading={saving}
            fullWidth
          />
        </View>
      </View>

      <View style={styles.kycCard}>
        <View style={styles.kycIcon}>
          <Text style={styles.kycIconText}>
            ID
          </Text>
        </View>

        <View style={styles.kycContent}>
          <Text style={styles.kycTitle}>
            Documents du véhicule
          </Text>

          <Text style={styles.kycText}>
            La vérification documentaire passe par votre
            dossier KYC transporteur.
          </Text>
        </View>
      </View>

      <Button
        title="Ouvrir la vérification KYC"
        variant="outline"
        onPress={() =>
          navigation.navigate('KYC')
        }
        fullWidth
      />

      <Text style={styles.footer}>
        Aucune information de marque ou de modèle n’est
        enregistrée ici si elle n’est pas prise en charge
        par le backend Livi.
      </Text>
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

  loading: {
    padding: spacing[5],
    gap: spacing[4],
    backgroundColor: colors.dark,
  },

  header: {
    marginBottom: spacing[5],
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
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
  },

  identityCard: {
    minHeight: 112,
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  vehicleIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.xl,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  vehicleIconText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.gold,
  },

  identityContent: {
    flex: 1,
  },

  identityTitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  identityValue: {
    marginTop: 2,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  identityPlate: {
    marginTop: 2,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  messageBox: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  successBox: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  messageText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  successText: {
    color: colors.gold2,
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

  formCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  kycCard: {
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  kycIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  kycIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.gold,
  },

  kycContent: {
    flex: 1,
  },

  kycTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  kycText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  footer: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[2],
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
