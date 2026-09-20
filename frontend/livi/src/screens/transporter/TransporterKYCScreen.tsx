import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';

import {
  transporterKycApi,
  KycDocument,
} from '../../features/transporter/transporterKycApi';

import { uploadFile } from '../../services/api/upload';

import {
  EmptyState,
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

const STEP_IDS = [
  'identity',
  'permis',
  'assurance',
  'address',
  'other',
] as const;

const STEP_LABELS: Record<
  (typeof STEP_IDS)[number],
  string
> = {
  identity: "Pièce d'identité",
  permis: 'Permis de conduire',
  assurance: 'Assurance véhicule',
  address: 'Justificatif de domicile',
  other: 'Carte grise / document véhicule',
};

function overallStatus(
  documents: KycDocument[],
) {
  if (
    documents.some(
      (doc) =>
        doc.status === 'rejected',
    )
  ) {
    return 'rejected';
  }

  const approved =
    new Set(
      documents
        .filter(
          (doc) =>
            doc.status === 'approved',
        )
        .map(
          (doc) =>
            doc.document_type,
        ),
    );

  if (
    STEP_IDS.every((id) =>
      approved.has(id),
    )
  ) {
    return 'approved';
  }

  if (documents.length > 0) {
    return 'pending';
  }

  return 'not_submitted';
}

function statusLabel(
  value: string,
) {
  switch (value) {
    case 'approved':
      return 'Vérifié';

    case 'rejected':
      return 'À corriger';

    case 'pending':
      return 'En vérification';

    default:
      return 'Non soumis';
  }
}

function DocumentCard({
  id,
  label,
  document,
  busy,
  onUpload,
}: {
  id: string;
  label: string;
  document?: KycDocument;
  busy: boolean;
  onUpload: () => void;
}) {
  return (
    <View style={styles.documentCard}>
      <View style={styles.documentTop}>
        <View
          style={[
            styles.documentIcon,
            document?.status ===
              'approved' &&
              styles.documentIconApproved,
            document?.status ===
              'rejected' &&
              styles.documentIconRejected,
          ]}
        >
          <Text
            style={styles.documentIconText}
          >
            {document?.status ===
            'approved'
              ? '✓'
              : document?.status ===
                  'rejected'
                ? '!'
                : String(
                    STEP_IDS.indexOf(
                      id as any,
                    ) + 1,
                  )}
          </Text>
        </View>

        <View
          style={styles.documentContent}
        >
          <Text
            style={styles.documentTitle}
          >
            {label}
          </Text>

          <Text
            style={styles.documentStatusText}
          >
            {statusLabel(
              document?.status ??
                'not_submitted',
            )}
          </Text>

          {document?.rejection_reason ? (
            <Text
              style={styles.rejectionText}
            >
              {document.rejection_reason}
            </Text>
          ) : null}
        </View>

        <StatusBadge
          domain="kyc"
          status={
            document?.status ??
            'pending'
          }
        />
      </View>

      <Pressable
        style={styles.uploadButton}
        onPress={onUpload}
        disabled={busy}
      >
        <Text
          style={styles.uploadButtonText}
        >
          {busy
            ? 'Envoi…'
            : document?.status ===
                'rejected'
              ? 'Resoumettre'
              : document
                ? 'Remplacer'
                : 'Soumettre'}
        </Text>
      </Pressable>
    </View>
  );
}

export function TransporterKYCScreen() {
  const [documents, setDocuments] =
    useState<KycDocument[]>([]);

  const [kycLevel, setKycLevel] =
    useState<number | null>(null);

  const [verifiedAt, setVerifiedAt] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState<string | null>(null);

  const [error, setError] =
    useState('');

  const load = useCallback(
    async () => {
      setLoading(true);
      setError('');

      try {
        const [
          docs,
          me,
        ] = await Promise.all([
          transporterKycApi.status(),
          transporterKycApi.me(),
        ]);

        setDocuments(
          Array.isArray(docs)
            ? docs
            : [],
        );

        const role =
          me.role_details?.find(
            (entry) =>
              entry.role ===
              'transporter',
          );

        setKycLevel(
          role?.kyc_level ??
            null,
        );

        setVerifiedAt(
          role?.verified_at ??
            null,
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger votre KYC.',
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

  const currentStatus =
    overallStatus(documents);

  const approvedCount =
    documents.filter(
      (doc) =>
        doc.status ===
        'approved',
    ).length;

  const documentFor = (
    id: string,
  ) =>
    documents.find(
      (doc) =>
        doc.document_type ===
        id,
    );

  const submit = async (
    id: string,
  ) => {
    try {
      const picked =
        await DocumentPicker.getDocumentAsync(
          {
            type: [
              'image/*',
              'application/pdf',
            ],
            copyToCacheDirectory: true,
          },
        );

      if (picked.canceled) {
        return;
      }

      const file =
        picked.assets[0];

      setBusy(id);
      setError('');

      await uploadFile(
        '/users/me/kyc',
        file.uri,
        'document',
        {
          step: id,
        },
      );

      Alert.alert(
        'Document soumis',
        'Votre document a été transmis pour vérification.',
      );

      await load();
    } catch (e: any) {
      setError(
        e?.message ??
          'Impossible de soumettre ce document.',
      );
    } finally {
      setBusy(null);
    }
  };

  const statusText =
    statusLabel(currentStatus);

  const progress =
    `${approvedCount}/${STEP_IDS.length}`;

  if (loading) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.loading
        }
      >
        <Skeleton
          height={190}
          radius={radius['2xl']}
        />

        <Skeleton
          height={105}
          radius={radius.xl}
        />

        <Skeleton
          height={105}
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
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          VÉRIFICATION
        </Text>

        <Text style={styles.title}>
          KYC transporteur
        </Text>

        <Text style={styles.subtitle}>
          Suivez les documents nécessaires pour exercer
          votre activité sur Livi.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={() =>
              void load()
            }
          >
            <Text style={styles.retryText}>
              Réessayer
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>
              ID
            </Text>
          </View>

          <StatusBadge
            domain="kyc"
            status={
              currentStatus ===
              'not_submitted'
                ? 'pending'
                : currentStatus
            }
            label={statusText}
          />
        </View>

        <Text style={styles.heroTitle}>
          Dossier de vérification
        </Text>

        <Text style={styles.heroStatus}>
          {progress} documents approuvés
        </Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  (approvedCount /
                    STEP_IDS.length) *
                  100
                }%`,
              },
            ]}
          />
        </View>

        <View style={styles.heroMeta}>
          <Text style={styles.heroMetaText}>
            Niveau KYC :{' '}
            {kycLevel ?? '—'}
            {kycLevel != null
              ? '/3'
              : ''}
          </Text>

          <Text style={styles.heroMetaText}>
            {verifiedAt
              ? `Vérifié le ${new Date(
                  verifiedAt,
                ).toLocaleDateString(
                  'fr-FR',
                )}`
              : 'Vérification non finalisée'}
          </Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <View style={styles.infoIcon}>
          <Text style={styles.infoIconText}>
            ✓
          </Text>
        </View>

        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>
            Documents réels uniquement
          </Text>

          <Text style={styles.infoText}>
            Chaque fichier est transmis au service KYC.
            Le statut final est décidé côté serveur.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Documents demandés
          </Text>

          <Text style={styles.sectionSubtitle}>
            {approvedCount} sur{' '}
            {STEP_IDS.length} validé
            {approvedCount > 1
              ? 's'
              : ''}
          </Text>
        </View>

        <View style={styles.documentList}>
          {STEP_IDS.map((id) => (
            <DocumentCard
              key={id}
              id={id}
              label={STEP_LABELS[id]}
              document={
                documentFor(id)
              }
              busy={busy === id}
              onUpload={() =>
                void submit(id)
              }
            />
          ))}
        </View>
      </View>

      {documents.length === 0 ? (
        <View style={styles.emptyHint}>
          <EmptyState
            icon="ID"
            title="Dossier non soumis"
            description="Commencez par transmettre les documents requis pour faire vérifier votre profil transporteur."
          />
        </View>
      ) : null}

      <Text style={styles.footer}>
        Le niveau et le statut de votre KYC restent ceux
        retournés par le service Livi.
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

  errorBox: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  errorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  hero: {
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.gold,
  },

  heroTitle: {
    marginTop: spacing[5],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  heroStatus: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  progressTrack: {
    height: 8,
    marginTop: spacing[4],
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
  },

  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  heroMeta: {
    marginTop: spacing[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  heroMetaText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  infoBox: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    flexDirection: 'row',
    gap: spacing[3],
  },

  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoIconText: {
    fontFamily: fonts.bodyBold,
    color: colors.dark,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  infoText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
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
    color: colors.textMuted,
  },

  documentList: {
    gap: spacing[3],
  },

  documentCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  documentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  documentIconApproved: {
    backgroundColor: colors.greenDim,
    borderColor: colors.greenBorder,
  },

  documentIconRejected: {
    backgroundColor: colors.redDim,
    borderColor: colors.redBorder,
  },

  documentIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  documentContent: {
    flex: 1,
  },

  documentTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  documentStatusText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  rejectionText: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.red,
  },

  uploadButton: {
    minHeight: 42,
    marginTop: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  uploadButtonText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  emptyHint: {
    marginTop: spacing[5],
    minHeight: 260,
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
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
