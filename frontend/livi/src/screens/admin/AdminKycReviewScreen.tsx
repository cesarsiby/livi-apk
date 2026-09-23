import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { adminApi } from '../../features/admin/adminApi';
import { useAuth } from '../../features/auth/AuthProvider';
import { ENV } from '../../config/env';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionHeader,
  Skeleton,
  StatusBadge,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

type KycDoc = {
  id: string;
  user_id: string;
  document_type: string;
  status: string;
  created_at: string;
  user_name?: string;
  user_phone?: string;
};

const DOCUMENT_LABELS: Record<string, string> = {
  identity: "Pièce d'identité",
  business: 'Document entreprise',
  address: "Justificatif d'adresse",
};

function documentLabel(type: string) {
  return DOCUMENT_LABELS[type] ?? type.replace(/_/g, ' ');
}

function formatDate(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminKycReviewScreen() {
  const { session } = useAuth();

  const [items, setItems] = useState<KycDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const [previews, setPreviews] = useState<
    Record<string, string | 'unavailable'>
  >({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      setItems((await adminApi.kycPending()) ?? []);
    } catch (e: any) {
      setError(
        e?.message ?? 'Impossible de charger les vérifications KYC en attente.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPreview = useCallback(
    async (docId: string) => {
      if (previews[docId] || !session?.accessToken) {
        if (!session?.accessToken) {
          setError('Session administrateur indisponible pour consulter ce document.');
        }
        return;
      }

      setPreviewLoading(docId);
      setError('');

      try {
        const access = await adminApi.kycDocumentAccessToken(docId);

        const response = await fetch(
          `${ENV.API_BASE_URL}/kyc/documents/${encodeURIComponent(
            docId,
          )}/download?token=${encodeURIComponent(access.token)}`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error('download_failed');
        }

        const blob = await response.blob();

        const dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('read_failed'));
          reader.readAsDataURL(blob);
        });

        setPreviews((current) => ({
          ...current,
          [docId]: dataUri,
        }));
      } catch {
        setPreviews((current) => ({
          ...current,
          [docId]: 'unavailable',
        }));
      } finally {
        setPreviewLoading(null);
      }
    },
    [previews, session?.accessToken],
  );

  const review = useCallback(
    async (id: string, status: 'approved' | 'rejected') => {
      const reason = (reasons[id] ?? '').trim();

      if (status === 'rejected' && !reason) {
        setError('Indiquez un motif avant de rejeter un document.');
        return;
      }

      setBusyId(id);
      setError('');

      try {
        await adminApi.kycReview(
          id,
          status,
          status === 'rejected' ? reason : undefined,
        );

        setItems((current) => current.filter((item) => item.id !== id));

        setReasons((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      } catch (e: any) {
        setError(e?.message ?? 'La décision KYC n’a pas pu être enregistrée.');
      } finally {
        setBusyId(null);
      }
    },
    [reasons],
  );

  const pendingCount = items.length;
  const isEmpty = !loading && pendingCount === 0;

  const headerSummary = useMemo(() => {
    if (pendingCount === 0) return 'Aucun dossier en attente';
    return `${pendingCount} document${pendingCount > 1 ? 's' : ''} à examiner`;
  }, [pendingCount]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={115} height={14} radius={radius.pill} />
        <Skeleton width={290} height={34} radius={radius.md} />
        <Skeleton width="100%" height={50} radius={radius.md} />
        <Skeleton width="100%" height={285} radius={radius.lg} />
        <Skeleton width="100%" height={285} radius={radius.lg} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          isEmpty ? styles.emptyContent : null,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>CONTRÔLE ADMINISTRATEUR</Text>
            <Text style={styles.title}>Revue KYC</Text>
            <Text style={styles.subtitle}>
              Consultez les documents avant de valider ou de demander une
              correction.
            </Text>

            <Card style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Text style={styles.summaryIconText}>✓</Text>
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryTitle}>{headerSummary}</Text>
                <Text style={styles.summaryText}>
                  Les décisions appliquées ici sont transmises au service KYC.
                </Text>
              </View>
            </Card>

            {error ? (
              <Card style={styles.errorCard}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            ) : null}

            {pendingCount > 0 ? (
              <SectionHeader
                title="Documents à examiner"
                subtitle="Chaque carte correspond à un document actuellement retourné par le backend."
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="✓"
            title="Aucun document en attente"
            description="Il n’y a actuellement aucun document KYC retourné par la file d’attente."
          />
        }
        renderItem={({ item }) => {
          const preview = previews[item.id];
          const isBusy = busyId === item.id;
          const isPreviewBusy = previewLoading === item.id;

          return (
            <Card style={styles.documentCard}>
              <View style={styles.cardTop}>
                <View style={styles.identityBlock}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.user_name ?? item.user_phone ?? 'U')
                        .trim()
                        .slice(0, 1)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.identityCopy}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {item.user_name ?? 'Utilisateur'}
                    </Text>
                    <Text style={styles.userMeta} numberOfLines={1}>
                      {item.user_phone ?? item.user_id}
                    </Text>
                  </View>
                </View>

                <Badge
                  label={documentLabel(item.document_type)}
                  variant="blue"
                />
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Soumis</Text>
                <Text style={styles.metaValue}>
                  {formatDate(item.created_at)}
                </Text>
              </View>

              <View style={styles.statusRow}>
                <StatusBadge domain="kyc" status={item.status} />
              </View>

              {preview && preview !== 'unavailable' ? (
                <View style={styles.previewWrap}>
                  <Image
                    source={{ uri: preview }}
                    style={styles.preview}
                    resizeMode="contain"
                    onError={() =>
                      setPreviews((current) => ({
                        ...current,
                        [item.id]: 'unavailable',
                      }))
                    }
                  />
                </View>
              ) : preview === 'unavailable' ? (
                <Card style={styles.previewUnavailable}>
                  <Text style={styles.previewUnavailableTitle}>
                    Aperçu indisponible
                  </Text>
                  <Text style={styles.previewUnavailableText}>
                    Le fichier ne peut pas être prévisualisé ici. Le document
                    reste traité via le flux sécurisé prévu par le backend.
                  </Text>
                </Card>
              ) : (
                <Button
                  title={isPreviewBusy ? 'Chargement du document…' : 'Voir le document'}
                  onPress={() => loadPreview(item.id)}
                  disabled={isPreviewBusy || !session?.accessToken}
                  loading={isPreviewBusy}
                  variant="outline"
                  fullWidth
                />
              )}

              <View style={styles.reviewSection}>
                <Text style={styles.fieldLabel}>Motif de rejet</Text>
                <Text style={styles.fieldHint}>
                  Requis uniquement pour une décision « Rejeter ».
                </Text>

                <TextInput
                  value={reasons[item.id] ?? ''}
                  onChangeText={(value) =>
                    setReasons((current) => ({
                      ...current,
                      [item.id]: value,
                    }))
                  }
                  placeholder="Expliquez la correction attendue…"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  multiline
                  textAlignVertical="top"
                  editable={!isBusy}
                  maxLength={500}
                />
              </View>

              <View style={styles.actions}>
                <Button
                  title={isBusy ? 'Traitement…' : 'Approuver'}
                  variant="green"
                  size="sm"
                  disabled={isBusy}
                  loading={isBusy}
                  onPress={() => review(item.id, 'approved')}
                  style={styles.actionButton}
                />
                <Button
                  title={isBusy ? 'Traitement…' : 'Rejeter'}
                  variant="red"
                  size="sm"
                  disabled={isBusy}
                  loading={isBusy}
                  onPress={() => review(item.id, 'rejected')}
                  style={styles.actionButton}
                />
              </View>
            </Card>
          );
        }}
      />
    </View>
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
    gap: spacing[4],
  },
  emptyContent: {
    flexGrow: 1,
  },
  header: {
    gap: spacing[3],
    marginBottom: spacing[1],
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
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.25)',
    backgroundColor: 'rgba(201, 151, 28, 0.06)',
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.14)',
  },
  summaryIconText: {
    color: colors.gold2,
    fontFamily: fonts.bodyBold,
    fontSize: 19,
  },
  summaryCopy: {
    flex: 1,
    gap: spacing[1],
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  summaryText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.25)',
    backgroundColor: 'rgba(255, 94, 94, 0.07)',
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: colors.red,
  },
  errorText: {
    flex: 1,
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  documentCard: {
    padding: spacing[4],
    gap: spacing[4],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  identityBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: fontSize.md,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  userName: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  userMeta: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingTop: spacing[1],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  metaValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.gray2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  statusRow: {
    alignItems: 'flex-start',
  },
  previewWrap: {
    width: '100%',
    minHeight: 230,
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: {
    width: '100%',
    height: 220,
  },
  previewUnavailable: {
    padding: spacing[4],
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[1],
  },
  previewUnavailableTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  previewUnavailableText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  reviewSection: {
    gap: spacing[2],
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  fieldHint: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  actionButton: {
    flex: 1,
  },
});
