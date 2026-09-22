import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { adminApi } from '../../features/admin/adminApi';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionHeader,
  Skeleton,
} from '../../design/components';
import { formatMoney } from '../../design/components/Money';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

const CASE_STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  executed: 'Exécuté',
};

const CASE_STATUS_VARIANT: Record<
  string,
  'gold' | 'green' | 'red' | 'gray'
> = {
  open: 'gold',
  approved: 'green',
  rejected: 'red',
  executed: 'green',
};

function statusLabel(status?: string) {
  if (!status) return '—';
  return (
    CASE_STATUS_LABEL[status] ??
    status.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase())
  );
}

function formatDate(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateRange(start?: string, end?: string) {
  return `${formatDate(start)} → ${formatDate(end)}`;
}

export function AdminReconciliationScreen() {
  const [runs, setRuns] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [expandedRun, setExpandedRun] = useState<{
    run: any;
    items: any[];
  } | null>(null);

  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      const [reconciliationRuns, correctionCases] = await Promise.all([
        adminApi.reconciliationRuns(),
        adminApi.correctionCases(),
      ]);

      setRuns(reconciliationRuns ?? []);
      setCases(correctionCases ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger la réconciliation.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCases = useMemo(
    () => cases.filter((item) => item?.status === 'open').length,
    [cases],
  );

  const toggleRun = useCallback(
    async (run: any) => {
      if (!run?.id) return;

      if (expandedRun?.run?.id === run.id) {
        setExpandedRun(null);
        return;
      }

      setExpandingId(String(run.id));
      setError('');

      try {
        setExpandedRun(await adminApi.reconciliationRun(String(run.id)));
      } catch (e: any) {
        setError(e?.message ?? 'Impossible de charger ce cycle de réconciliation.');
      } finally {
        setExpandingId(null);
      }
    },
    [expandedRun?.run?.id],
  );

  const act = useCallback(
    async (id: string, action: 'approve' | 'reject' | 'execute') => {
      const reason = (reasons[id] ?? '').trim();

      if ((action === 'approve' || action === 'reject') && !reason) {
        setError('Ajoutez une note avant de traiter ce dossier.');
        return;
      }

      setBusyId(id);
      setError('');

      try {
        if (action === 'approve') {
          await adminApi.approveCorrection(id, reason);
        } else if (action === 'reject') {
          await adminApi.rejectCorrection(id, reason);
        } else {
          await adminApi.executeCompensation(id);
        }

        await load(true);
      } catch (e: any) {
        setError(e?.message ?? 'Action impossible.');
      } finally {
        setBusyId(null);
      }
    },
    [load, reasons],
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={120} height={14} radius={radius.pill} />
        <Skeleton width={250} height={34} radius={radius.md} />
        <Skeleton width="100%" height={90} radius={radius.lg} />
        <Skeleton width="100%" height={160} radius={radius.lg} />
        <Skeleton width="100%" height={160} radius={radius.lg} />
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
        <Text style={styles.eyebrow}>CONTRÔLE FINANCIER</Text>
        <Text style={styles.title}>Réconciliation</Text>
        <Text style={styles.subtitle}>
          Suivez les cycles de rapprochement partenaire et traitez les dossiers
          de correction retournés par le service financier.
        </Text>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorDot} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Card style={styles.summaryCard}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryLabel}>État de la file</Text>
          <Text style={styles.summaryTitle}>
            {openCases} dossier{openCases > 1 ? 's' : ''} ouvert
            {openCases > 1 ? 's' : ''}
          </Text>
          <Text style={styles.summaryText}>
            {runs.length} cycle{runs.length > 1 ? 's' : ''} et {cases.length}{' '}
            dossier{cases.length > 1 ? 's' : ''} de correction retournés.
          </Text>
        </View>

        <View style={styles.summaryMark}>
          <Text style={styles.summaryMarkText}>↔</Text>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader
          title="Cycles de réconciliation"
          subtitle="Touchez un cycle pour afficher les éléments qu’il contient."
        />

        {runs.length === 0 ? (
          <EmptyState
            icon="↔"
            title="Aucun cycle"
            description="Aucun cycle de réconciliation n’a été retourné."
          />
        ) : (
          <View style={styles.list}>
            {runs.map((run, index) => {
              const id = String(run?.id ?? index);
              const expanded = expandedRun?.run?.id === run?.id;
              const expanding = expandingId === String(run?.id);

              return (
                <Pressable
                  key={id}
                  onPress={() => toggleRun(run)}
                  style={({ pressed }) => [
                    styles.pressable,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Card style={styles.runCard}>
                    <View style={styles.runTop}>
                      <View style={styles.runCopy}>
                        <Text style={styles.runProvider} numberOfLines={1}>
                          {run?.provider ?? 'Partenaire'}
                        </Text>
                        <Text style={styles.runDates}>
                          {formatDateRange(
                            run?.period_start,
                            run?.period_end,
                          )}
                        </Text>
                      </View>

                      <Badge
                        label={statusLabel(run?.status)}
                        variant={run?.status === 'completed' ? 'green' : 'gold'}
                      />
                    </View>

                    <View style={styles.expandRow}>
                      <Text style={styles.expandText}>
                        {expanding
                          ? 'Chargement…'
                          : expanded
                            ? 'Masquer les détails'
                            : 'Afficher les détails'}
                      </Text>
                      <Text style={styles.expandIcon}>
                        {expanded ? '⌃' : '⌄'}
                      </Text>
                    </View>

                    {expanded ? (
                      <View style={styles.subList}>
                        {expandedRun?.items?.length === 0 ? (
                          <Text style={styles.muted}>Aucun écart.</Text>
                        ) : (
                          expandedRun?.items?.map((item: any, itemIndex: number) => (
                            <View
                              key={String(item?.id ?? itemIndex)}
                              style={styles.subItem}
                            >
                              <Text style={styles.subTitle}>
                                {item?.discrepancy_type ??
                                  'Écart de réconciliation'}
                              </Text>

                              <Text style={styles.subReference}>
                                Référence :{' '}
                                {item?.payment_reference ??
                                  item?.external_event_id ??
                                  '—'}
                              </Text>

                              <View style={styles.amountRow}>
                                <View style={styles.amountBox}>
                                  <Text style={styles.amountLabel}>LIVI</Text>
                                  <Text style={styles.amountValue}>
                                    {item?.expected_amount != null
                                      ? formatMoney(
                                          item.expected_amount,
                                          item?.currency ?? 'XOF',
                                        )
                                      : '—'}
                                  </Text>
                                </View>

                                <View style={styles.amountBox}>
                                  <Text style={styles.amountLabel}>
                                    Partenaire
                                  </Text>
                                  <Text style={styles.amountValue}>
                                    {item?.provider_amount != null
                                      ? formatMoney(
                                          item.provider_amount,
                                          item?.currency ?? 'XOF',
                                        )
                                      : '—'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Dossiers de correction"
          subtitle="Les actions proposées dépendent du statut actuellement retourné."
        />

        {cases.length === 0 ? (
          <EmptyState
            icon="✓"
            title="Aucun dossier"
            description="Aucun dossier de correction n’a été retourné."
          />
        ) : (
          <View style={styles.list}>
            {cases.map((item, index) => {
              const id = String(item?.id ?? index);
              const status = String(item?.status ?? '');
              const busy = busyId === id;

              return (
                <Card key={id} style={styles.caseCard}>
                  <View style={styles.caseTop}>
                    <View style={styles.caseCopy}>
                      <Text style={styles.caseType}>
                        {item?.case_type ?? 'Dossier de correction'}
                      </Text>
                      <Text style={styles.caseId}>{id}</Text>
                    </View>

                    <Badge
                      label={statusLabel(status)}
                      variant={CASE_STATUS_VARIANT[status] ?? 'gray'}
                    />
                  </View>

                  <Text style={styles.reason}>
                    {item?.reason ?? 'Aucun motif retourné.'}
                  </Text>

                  {item?.proposed_amount != null ? (
                    <View style={styles.proposed}>
                      <Text style={styles.proposedLabel}>
                        Montant proposé
                      </Text>
                      <Text style={styles.proposedValue}>
                        {formatMoney(item.proposed_amount, 'XOF')}
                      </Text>
                    </View>
                  ) : null}

                  {status === 'open' ? (
                    <View style={styles.caseActions}>
                      <View style={styles.noteGroup}>
                        <Text style={styles.fieldLabel}>Note</Text>
                        <TextInput
                          value={reasons[id] ?? ''}
                          onChangeText={(value) =>
                            setReasons((current) => ({
                              ...current,
                              [id]: value,
                            }))
                          }
                          placeholder="Note d’approbation ou de rejet"
                          placeholderTextColor={colors.textMuted}
                          style={styles.input}
                          multiline
                          textAlignVertical="top"
                          editable={!busy}
                        />
                      </View>

                      <View style={styles.actionRow}>
                        <Button
                          title={busy ? 'Traitement…' : 'Approuver'}
                          variant="green"
                          size="sm"
                          disabled={busy}
                          loading={busy}
                          onPress={() => act(id, 'approve')}
                          style={styles.actionButton}
                        />
                        <Button
                          title={busy ? 'Traitement…' : 'Rejeter'}
                          variant="red"
                          size="sm"
                          disabled={busy}
                          loading={busy}
                          onPress={() => act(id, 'reject')}
                          style={styles.actionButton}
                        />
                      </View>
                    </View>
                  ) : null}

                  {status === 'approved' ? (
                    <Button
                      title={busy ? 'Exécution…' : 'Exécuter la compensation client'}
                      variant="blue"
                      size="sm"
                      disabled={busy}
                      loading={busy}
                      onPress={() => act(id, 'execute')}
                      fullWidth
                    />
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </View>

      <Text style={styles.footerNote}>
        Les valeurs affichées proviennent directement des services de
        réconciliation et de correction.
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
    gap: spacing[6],
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
  summaryCard: {
    minHeight: 100,
    padding: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.27)',
    backgroundColor: 'rgba(201, 151, 28, 0.065)',
  },
  summaryMain: {
    flex: 1,
    gap: spacing[1],
  },
  summaryLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize.xl,
  },
  summaryText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  summaryMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.14)',
  },
  summaryMarkText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 24,
  },
  section: {
    gap: spacing[3],
  },
  list: {
    gap: spacing[3],
  },
  pressable: {
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.994 }],
  },
  runCard: {
    padding: spacing[4],
    gap: spacing[3],
  },
  runTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  runCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  runProvider: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  runDates: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expandText: {
    color: colors.gold2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  expandIcon: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 22,
    lineHeight: 18,
  },
  subList: {
    gap: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subItem: {
    gap: spacing[1],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  subTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  subReference: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  amountRow: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingTop: spacing[2],
  },
  amountBox: {
    flex: 1,
    gap: spacing[1],
  },
  amountLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  amountValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  caseCard: {
    padding: spacing[4],
    gap: spacing[4],
  },
  caseTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  caseCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  caseType: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
  },
  caseId: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  reason: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  proposed: {
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(201, 151, 28, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.16)',
    gap: spacing[1],
  },
  proposedLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  proposedValue: {
    color: colors.gold2,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  caseActions: {
    gap: spacing[3],
  },
  noteGroup: {
    gap: spacing[2],
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  input: {
    minHeight: 92,
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  actionButton: {
    flex: 1,
  },
  muted: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
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
