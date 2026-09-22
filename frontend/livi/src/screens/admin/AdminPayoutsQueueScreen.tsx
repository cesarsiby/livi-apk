import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { adminApi } from '../../features/admin/adminApi';
import {
  Button,
  Card,
  EmptyState,
  Money,
  SectionHeader,
  Skeleton,
  StatusBadge,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

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

export function AdminPayoutsQueueScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [providers, setProviders] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      setItems((await adminApi.payoutsPending()) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger la file de retraits.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const queueCount = items.length;

  const updateField = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
      id: string,
      value: string,
    ) => {
      setter((current) => ({ ...current, [id]: value }));
    },
    [],
  );

  const act = useCallback(
    async (id: string, action: 'processing' | 'fail' | 'complete') => {
      const provider = (providers[id] ?? '').trim();
      const providerReference = (refs[id] ?? '').trim();
      const note = (notes[id] ?? '').trim();

      if (action === 'complete' && (!provider || !providerReference)) {
        setError(
          'Pour compléter le retrait, renseignez le prestataire et la référence partenaire.',
        );
        return;
      }

      if (action === 'fail' && !note) {
        setError('Indiquez le motif de l’échec avant de marquer le retrait en échec.');
        return;
      }

      setBusyId(id);
      setError('');

      try {
        if (action === 'processing') {
          await adminApi.payoutMarkProcessing(id);
        } else if (action === 'fail') {
          await adminApi.payoutFail(id, note);
        } else {
          await adminApi.payoutComplete(id, provider, providerReference);
        }

        await load(true);
      } catch (e: any) {
        setError(e?.message ?? 'Action impossible.');
      } finally {
        setBusyId(null);
      }
    },
    [load, notes, providers, refs],
  );

  const headerText = useMemo(() => {
    if (queueCount === 0) return 'Aucun retrait en attente';
    return `${queueCount} retrait${queueCount > 1 ? 's' : ''} à traiter`;
  }, [queueCount]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={110} height={14} radius={radius.pill} />
        <Skeleton width={250} height={34} radius={radius.md} />
        <Skeleton width="100%" height={52} radius={radius.md} />
        <Skeleton width="100%" height={310} radius={radius.lg} />
        <Skeleton width="100%" height={310} radius={radius.lg} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item?.id ?? index)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          queueCount === 0 ? styles.emptyContent : null,
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
            <Text style={styles.eyebrow}>OPÉRATIONS FINANCIÈRES</Text>
            <Text style={styles.title}>File de retraits</Text>
            <Text style={styles.subtitle}>
              Traitez les demandes en attente et enregistrez le résultat du
              versement partenaire.
            </Text>

            <Card style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Text style={styles.summaryIconText}>₣</Text>
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryTitle}>{headerText}</Text>
                <Text style={styles.summaryText}>
                  Les actions disponibles correspondent directement aux opérations du backend.
                </Text>
              </View>
            </Card>

            {error ? (
              <Card style={styles.errorCard}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            ) : null}

            {queueCount > 0 ? (
              <SectionHeader
                title="Demandes en attente"
                subtitle="Chaque carte représente un retrait retourné par le service d’administration."
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="✓"
            title="File vide"
            description="Aucun retrait en attente n’a été retourné par le service financier."
          />
        }
        renderItem={({ item }) => {
          const id = String(item?.id ?? '');
          const isBusy = busyId === id;

          return (
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.identity}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item?.phone ?? item?.email ?? item?.user_id ?? 'U')
                        .toString()
                        .trim()
                        .slice(0, 1)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.identityCopy}>
                    <Text style={styles.user} numberOfLines={1}>
                      {item?.phone ?? item?.email ?? item?.user_id ?? 'Utilisateur'}
                    </Text>
                    <Text style={styles.requestId} numberOfLines={1}>
                      {id}
                    </Text>
                  </View>
                </View>

                {item?.role ? (
                  <Text style={styles.role}>{String(item.role)}</Text>
                ) : null}
              </View>

              <View style={styles.amountRow}>
                <View style={styles.amountCopy}>
                  <Text style={styles.amountLabel}>Montant</Text>
                  <Money
                    amount={item?.net_amount ?? item?.amount}
                    currency="XOF"
                    size="xl"
                    style={styles.amount}
                  />
                </View>

                <View style={styles.amountMeta}>
                  <Text style={styles.metaLabel}>Statut</Text>
                  <StatusBadge
                    domain="payout"
                    status={item?.status ?? 'pending'}
                  />
                </View>
              </View>

              <View style={styles.details}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Destination</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {item?.destination_ref ?? '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Demandé le</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(item?.created_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formTitle}>Informations de traitement</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Prestataire</Text>
                  <TextInput
                    value={providers[id] ?? ''}
                    onChangeText={(value) => updateField(setProviders, id, value)}
                    placeholder="Prestataire"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    autoCapitalize="words"
                    editable={!isBusy}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Référence partenaire</Text>
                  <TextInput
                    value={refs[id] ?? ''}
                    onChangeText={(value) => updateField(setRefs, id, value)}
                    placeholder="Référence de transaction partenaire"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    autoCapitalize="none"
                    editable={!isBusy}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Motif d’échec</Text>
                  <TextInput
                    value={notes[id] ?? ''}
                    onChangeText={(value) => updateField(setNotes, id, value)}
                    placeholder="Motif si le retrait échoue"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, styles.textArea]}
                    multiline
                    textAlignVertical="top"
                    editable={!isBusy}
                  />
                </View>
              </View>

              <View style={styles.actions}>
                <Button
                  title={isBusy ? 'Traitement…' : 'Marquer en cours'}
                  variant="secondary"
                  size="sm"
                  disabled={isBusy}
                  loading={isBusy}
                  onPress={() => act(id, 'processing')}
                  style={styles.actionButton}
                />
                <Button
                  title={isBusy ? 'Traitement…' : 'Compléter'}
                  variant="green"
                  size="sm"
                  disabled={isBusy}
                  loading={isBusy}
                  onPress={() => act(id, 'complete')}
                  style={styles.actionButton}
                />
                <Button
                  title={isBusy ? 'Traitement…' : 'Échec'}
                  variant="red"
                  size="sm"
                  disabled={isBusy}
                  loading={isBusy}
                  onPress={() => act(id, 'fail')}
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
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.13)',
  },
  summaryIconText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 21,
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
    lineHeight: 18,
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
  card: {
    padding: spacing[4],
    gap: spacing[4],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  identity: {
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
  user: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  requestId: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  role: {
    color: colors.gray3,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  amountCopy: {
    flex: 1,
    gap: spacing[1],
  },
  amountLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  amount: {
    color: colors.gold2,
    fontFamily: fonts.brandSemibold,
  },
  amountMeta: {
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  metaLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  details: {
    gap: spacing[2],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[4],
  },
  detailLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  detailValue: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  formSection: {
    gap: spacing[3],
  },
  formTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
  },
  fieldGroup: {
    gap: spacing[2],
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },
  textArea: {
    minHeight: 88,
    paddingTop: spacing[3],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
  },
});
