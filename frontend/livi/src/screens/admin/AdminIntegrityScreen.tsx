import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { adminApi } from '../../features/admin/adminApi';
import {
  Badge,
  Button,
  Card,
  SectionHeader,
  Skeleton,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

type IntegrityData = {
  ok: boolean;
  ledger_unbalanced: any[];
  escrow_inconsistencies: any[];
};

function stringifyRow(row: any) {
  try {
    return JSON.stringify(row, null, 2);
  } catch {
    return String(row);
  }
}

export function AdminIntegrityScreen() {
  const [data, setData] = useState<IntegrityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      setData(await adminApi.getIntegrity());
    } catch (e: any) {
      setError(
        e?.message ?? "Impossible de lancer le contrôle d'intégrité.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ledgerCount = data?.ledger_unbalanced?.length ?? 0;
  const escrowCount = data?.escrow_inconsistencies?.length ?? 0;
  const issueCount = ledgerCount + escrowCount;

  const summaryLabel = useMemo(() => {
    if (!data) return 'Contrôle en cours';
    if (data.ok) return 'Aucune anomalie retournée';
    return `${issueCount} anomalie${issueCount > 1 ? 's' : ''} retournée${issueCount > 1 ? 's' : ''}`;
  }, [data, issueCount]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={105} height={14} radius={radius.pill} />
        <Skeleton width={220} height={34} radius={radius.md} />
        <Skeleton width="100%" height={132} radius={radius.lg} />
        <Skeleton width={180} height={22} radius={radius.md} />
        <Skeleton width="100%" height={92} radius={radius.lg} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorScreen}>
        <Card style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
          <Text style={styles.errorTitle}>Contrôle indisponible</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Réessayer" onPress={() => load()} fullWidth />
        </Card>
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
        <Text style={styles.eyebrow}>CONTRÔLE PLATEFORME</Text>
        <Text style={styles.title}>Intégrité comptable</Text>
        <Text style={styles.subtitle}>
          Vérifiez l’état retourné par le contrôle d’intégrité du grand livre
          et de l’escrow.
        </Text>
      </View>

      <Card
        style={[
          styles.statusCard,
          data?.ok ? styles.statusOk : styles.statusAlert,
        ]}
      >
        <View style={styles.statusTop}>
          <View style={styles.statusIcon}>
            <Text style={styles.statusIconText}>{data?.ok ? '✓' : '!'}</Text>
          </View>

          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>
              {data?.ok ? 'Contrôle conforme' : 'Anomalies à examiner'}
            </Text>
            <Text style={styles.statusText}>{summaryLabel}</Text>
          </View>

          <Badge
            label={data?.ok ? 'OK' : 'À examiner'}
            variant={data?.ok ? 'green' : 'red'}
          />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{ledgerCount}</Text>
            <Text style={styles.metricLabel}>Grand livre</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{escrowCount}</Text>
            <Text style={styles.metricLabel}>Escrow</Text>
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader
          title="Grand livre déséquilibré"
          subtitle={`${ledgerCount} élément${ledgerCount > 1 ? 's' : ''} retourné${ledgerCount > 1 ? 's' : ''} par le contrôle.`}
        />

        {ledgerCount === 0 ? (
          <Card style={styles.cleanCard}>
            <View style={styles.cleanIcon}>
              <Text style={styles.cleanIconText}>✓</Text>
            </View>
            <View style={styles.cleanCopy}>
              <Text style={styles.cleanTitle}>Rien à signaler</Text>
              <Text style={styles.cleanText}>
                Aucun déséquilibre du grand livre n’a été retourné.
              </Text>
            </View>
          </Card>
        ) : (
          <View style={styles.issueList}>
            {data?.ledger_unbalanced.map((row, index) => (
              <Card key={`ledger-${index}`} style={styles.issueCard}>
                <View style={styles.issueHeader}>
                  <Text style={styles.issueIndex}>
                    ÉLÉMENT {String(index + 1).padStart(2, '0')}
                  </Text>
                </View>
                <Text style={styles.rawData}>{stringifyRow(row)}</Text>
              </Card>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Incohérences escrow"
          subtitle={`${escrowCount} élément${escrowCount > 1 ? 's' : ''} retourné${escrowCount > 1 ? 's' : ''} par le contrôle.`}
        />

        {escrowCount === 0 ? (
          <Card style={styles.cleanCard}>
            <View style={styles.cleanIcon}>
              <Text style={styles.cleanIconText}>✓</Text>
            </View>
            <View style={styles.cleanCopy}>
              <Text style={styles.cleanTitle}>Rien à signaler</Text>
              <Text style={styles.cleanText}>
                Aucune incohérence escrow n’a été retournée.
              </Text>
            </View>
          </Card>
        ) : (
          <View style={styles.issueList}>
            {data?.escrow_inconsistencies.map((row, index) => (
              <Card key={`escrow-${index}`} style={styles.issueCard}>
                <View style={styles.issueHeader}>
                  <Text style={styles.issueIndex}>
                    ÉLÉMENT {String(index + 1).padStart(2, '0')}
                  </Text>
                </View>
                <Text style={styles.rawData}>{stringifyRow(row)}</Text>
              </Card>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.footerNote}>
        Les détails ci-dessus reprennent les données retournées par le service
        d’intégrité sans leur attribuer de signification supplémentaire.
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
  errorScreen: {
    flex: 1,
    backgroundColor: colors.dark,
    justifyContent: 'center',
    padding: spacing[5],
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
  statusCard: {
    padding: spacing[5],
    borderWidth: 1,
    borderRadius: radius.lg,
    gap: spacing[5],
  },
  statusOk: {
    borderColor: 'rgba(61, 196, 126, 0.3)',
    backgroundColor: 'rgba(61, 196, 126, 0.065)',
  },
  statusAlert: {
    borderColor: 'rgba(255, 94, 94, 0.3)',
    backgroundColor: 'rgba(255, 94, 94, 0.065)',
  },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusIconText: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: 22,
  },
  statusCopy: {
    flex: 1,
    gap: spacing[1],
  },
  statusTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  statusText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
  },
  metricDivider: {
    width: 1,
    height: 38,
    backgroundColor: colors.border,
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
  },
  metricLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  section: {
    gap: spacing[3],
  },
  cleanCard: {
    minHeight: 82,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  cleanIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61, 196, 126, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(61, 196, 126, 0.2)',
  },
  cleanIconText: {
    color: colors.green,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
  },
  cleanCopy: {
    flex: 1,
    gap: spacing[1],
  },
  cleanTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  cleanText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  issueList: {
    gap: spacing[3],
  },
  issueCard: {
    padding: spacing[4],
    gap: spacing[3],
  },
  issueHeader: {
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  issueIndex: {
    color: colors.red,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
  },
  rawData: {
    color: colors.gray2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  footerNote: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing[3],
  },
  errorCard: {
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.28)',
    backgroundColor: 'rgba(255, 94, 94, 0.07)',
  },
  errorIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 94, 94, 0.12)',
  },
  errorIconText: {
    color: colors.red,
    fontFamily: fonts.brand,
    fontSize: 26,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  errorText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
});
