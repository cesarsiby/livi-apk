import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';

import { sellerKycApi, type KycDocument } from '../../features/seller/sellerKycApi';
import { uploadFile } from '../../services/api/upload';
import {
  Card,
  EmptyState,
  SectionHeader,
  Skeleton,
  StatusBadge,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

const STEP_IDS = ['identity', 'business', 'address'] as const;

type StepId = (typeof STEP_IDS)[number];

const STEP_META: Record<StepId, { label: string; description: string }> = {
  identity: {
    label: "Pièce d'identité",
    description: 'Document utilisé pour vérifier votre identité.',
  },
  business: {
    label: 'Document entreprise',
    description: 'Document demandé pour la vérification de votre activité.',
  },
  address: {
    label: "Justificatif d'adresse",
    description: 'Document utilisé pour vérifier votre adresse.',
  },
};

function summarizeStatus(documents: KycDocument[]): {
  status: string;
  helper: string;
} {
  if (documents.some((doc) => doc.status === 'rejected')) {
    return {
      status: 'rejected',
      helper: 'Au moins un document doit être corrigé puis soumis à nouveau.',
    };
  }

  const approved = new Set(
    documents
      .filter((doc) => doc.status === 'approved')
      .map((doc) => doc.document_type),
  );

  if (STEP_IDS.every((id) => approved.has(id))) {
    return {
      status: 'approved',
      helper: 'Les documents attendus sont validés par le service de vérification.',
    };
  }

  if (documents.length > 0) {
    return {
      status: 'pending',
      helper: 'Certains documents sont encore en cours de vérification.',
    };
  }

  return {
    status: 'pending',
    helper: 'Aucun document n’a encore été soumis.',
  };
}

function getLatestByType(
  documents: KycDocument[],
  type: StepId,
): KycDocument | undefined {
  return documents.find((document) => document.document_type === type);
}

export function SellerKYCScreen() {
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<StepId | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      setDocuments((await sellerKycApi.status()) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger votre vérification KYC.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const overall = useMemo(
    () => summarizeStatus(documents),
    [documents],
  );

  const approvedCount = useMemo(
    () =>
      STEP_IDS.filter(
        (id) => getLatestByType(documents, id)?.status === 'approved',
      ).length,
    [documents],
  );

  const submitDocument = useCallback(
    async (step: StepId) => {
      setBusy(step);
      setError('');

      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true,
        });

        if (result.canceled) return;

        const file = result.assets?.[0];
        if (!file?.uri) {
          setError('Le fichier sélectionné est introuvable.');
          return;
        }

        await uploadFile('/users/me/kyc', file.uri, 'document', {
          step,
        });

        await load();
      } catch (e: any) {
        setError(e?.message ?? 'La soumission du document a échoué.');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={120} height={14} radius={radius.pill} />
        <Skeleton width={240} height={34} radius={radius.md} />
        <Skeleton width="92%" height={44} radius={radius.md} />
        <Skeleton width="100%" height={118} radius={radius.lg} />
        <Skeleton width="100%" height={94} radius={radius.lg} />
        <Skeleton width="100%" height={94} radius={radius.lg} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>VÉRIFICATION VENDEUR</Text>
        <Text style={styles.title}>Votre vérification KYC</Text>
        <Text style={styles.subtitle}>
          Déposez les documents demandés et suivez leur statut directement
          depuis Livi.
        </Text>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorMark}>
            <Text style={styles.errorMarkText}>!</Text>
          </View>
          <View style={styles.errorBody}>
            <Text style={styles.errorTitle}>Action à vérifier</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Pressable onPress={() => setError('')} hitSlop={10}>
            <Text style={styles.dismiss}>Fermer</Text>
          </Pressable>
        </Card>
      ) : null}

      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>Statut global</Text>
            <Text style={styles.summaryCount}>
              {approvedCount}/{STEP_IDS.length} documents validés
            </Text>
          </View>

          <StatusBadge domain="kyc" status={overall.status} />
        </View>

        <Text style={styles.summaryHelper}>{overall.helper}</Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(approvedCount / STEP_IDS.length) * 100}%`,
              },
            ]}
          />
        </View>
      </Card>

      <View style={styles.documentsSection}>
        <SectionHeader
          title="Documents demandés"
          subtitle="Le statut affiché correspond au dernier document trouvé pour chaque étape."
        />

        <View style={styles.steps}>
          {STEP_IDS.map((id, index) => {
            const meta = STEP_META[id];
            const document = getLatestByType(documents, id);
            const status = document?.status ?? 'pending';
            const canSubmit = status !== 'approved';

            return (
              <Card key={id} style={styles.documentCard}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>

                  <View style={styles.stepTitleWrap}>
                    <Text style={styles.stepTitle}>{meta.label}</Text>
                    <Text style={styles.stepDescription}>{meta.description}</Text>
                  </View>
                </View>

                <View style={styles.documentMeta}>
                  <StatusBadge domain="kyc" status={status} />

                  {document?.rejection_reason ? (
                    <View style={styles.rejectionBox}>
                      <Text style={styles.rejectionLabel}>Motif de correction</Text>
                      <Text style={styles.rejectionText}>
                        {document.rejection_reason}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    disabled={busy === id || !canSubmit}
                    onPress={() => submitDocument(id)}
                    style={({ pressed }) => [
                      styles.submitButton,
                      !canSubmit ? styles.submitDisabled : null,
                      busy === id ? styles.submitBusy : null,
                      pressed && canSubmit ? styles.submitPressed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.submitText,
                        !canSubmit ? styles.submitTextDisabled : null,
                      ]}
                    >
                      {busy === id
                        ? 'Soumission…'
                        : status === 'rejected'
                          ? 'Soumettre à nouveau'
                          : status === 'approved'
                            ? 'Document validé'
                            : 'Soumettre'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      </View>

      {documents.length === 0 ? (
        <EmptyState
          icon="◎"
          title="Commencez votre vérification"
          description="Sélectionnez un document pour chaque étape lorsque vous êtes prêt à les transmettre."
        />
      ) : null}

      <Text style={styles.footerNote}>
        Les statuts et motifs de correction sont retournés par le service KYC.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: spacing[5],
    gap: spacing[4],
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[5],
  },
  header: {
    gap: spacing[2],
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
  },
  subtitle: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    maxWidth: 370,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.3)',
    backgroundColor: 'rgba(255, 94, 94, 0.07)',
  },
  errorMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 94, 94, 0.14)',
  },
  errorMarkText: {
    color: colors.red,
    fontFamily: fonts.bodyBold,
  },
  errorBody: {
    flex: 1,
    gap: spacing[1],
  },
  errorTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  errorText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  dismiss: {
    color: colors.gold2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  summaryCard: {
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(201, 151, 28, 0.075)',
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.28)',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  summaryText: {
    flex: 1,
    gap: spacing[1],
  },
  summaryLabel: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryCount: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize.xl,
  },
  summaryHelper: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  documentsSection: {
    gap: spacing[3],
  },
  steps: {
    gap: spacing[3],
  },
  documentCard: {
    gap: spacing[4],
    padding: spacing[4],
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  stepNumber: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNumberText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: fontSize.sm,
  },
  stepTitleWrap: {
    flex: 1,
    gap: spacing[1],
  },
  stepTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  stepDescription: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  documentMeta: {
    gap: spacing[3],
  },
  rejectionBox: {
    gap: spacing[1],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 94, 94, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.2)',
  },
  rejectionLabel: {
    color: colors.red,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  rejectionText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  submitButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    backgroundColor: colors.gold,
  },
  submitDisabled: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitBusy: {
    opacity: 0.7,
  },
  submitPressed: {
    transform: [{ scale: 0.985 }],
  },
  submitText: {
    color: colors.dark,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
  },
  submitTextDisabled: {
    color: colors.gray3,
  },
  footerNote: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing[3],
  },
});
