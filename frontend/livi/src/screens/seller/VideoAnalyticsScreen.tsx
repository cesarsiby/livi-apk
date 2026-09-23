import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { liveApi } from '../../features/live/liveApi';
import {
  Card,
  EmptyState,
  SectionHeader,
  Skeleton,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

function humanizeKey(key: string) {
  const value = key.replace(/_/g, ' ').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : key;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value.toLocaleString('fr-FR')
      : String(value);
  }

  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('fr-FR');
    }
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function isMetricEntry(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function VideoAnalyticsScreen({ route }: any) {
  const videoId = String(route?.params?.videoId ?? '');

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!videoId) {
      setLoading(false);
      setError('Vidéo introuvable.');
      return;
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      const result = await liveApi.videoAnalytics(videoId);
      setData(
        result && typeof result === 'object' && !Array.isArray(result)
          ? result
          : null,
      );
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les analytics vidéo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(
    () => Object.entries(data ?? {}),
    [data],
  );

  const numericEntries = useMemo(
    () => entries.filter(([, value]) => isMetricEntry(value)),
    [entries],
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={120} height={14} radius={radius.pill} />
        <Skeleton width={250} height={34} radius={radius.md} />
        <Skeleton width="100%" height={72} radius={radius.lg} />
        <View style={styles.metricLoading}>
          <Skeleton width="48%" height={105} radius={radius.lg} />
          <Skeleton width="48%" height={105} radius={radius.lg} />
          <Skeleton width="48%" height={105} radius={radius.lg} />
          <Skeleton width="48%" height={105} radius={radius.lg} />
        </View>
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
        <Text style={styles.eyebrow}>PERFORMANCE VIDÉO</Text>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>
          Consultez les indicateurs et valeurs réellement retournés pour cette
          vidéo.
        </Text>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorDot} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!error && !data ? (
        <EmptyState
          icon="◌"
          title="Aucune donnée"
          description="Le service analytics n’a retourné aucune donnée exploitable pour cette vidéo."
        />
      ) : null}

      {data ? (
        <>
          {numericEntries.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Indicateurs"
                subtitle="Les valeurs numériques retournées par le service sont mises en avant."
              />

              <View style={styles.metricGrid}>
                {numericEntries.map(([key, value]) => (
                  <Card key={key} style={styles.metricCard}>
                    <Text style={styles.metricLabel} numberOfLines={2}>
                      {humanizeKey(key)}
                    </Text>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {formatValue(value)}
                    </Text>
                  </Card>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader
              title="Données reçues"
              subtitle="Aucune interprétation métier supplémentaire n’est appliquée aux champs inconnus."
            />

            {entries.length === 0 ? (
              <EmptyState
                icon="◌"
                title="Réponse vide"
                description="Le service a répondu sans champ analytique exploitable."
              />
            ) : (
              <Card style={styles.dataCard}>
                {entries.map(([key, value], index) => (
                  <View key={key} style={styles.dataRow}>
                    <Text style={styles.dataKey} numberOfLines={3}>
                      {humanizeKey(key)}
                    </Text>
                    <Text style={styles.dataValue} numberOfLines={6}>
                      {formatValue(value)}
                    </Text>
                    {index < entries.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </View>
                ))}
              </Card>
            )}
          </View>

          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>Vidéo analysée</Text>
            <Text style={styles.infoText} numberOfLines={2}>
              {videoId}
            </Text>
          </Card>
        </>
      ) : null}

      <Text style={styles.footer}>
        Données fournies directement par le service analytics vidéo Livi.
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
  metricLoading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
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
    borderColor: 'rgba(255,94,94,0.25)',
    backgroundColor: 'rgba(255,94,94,0.07)',
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
  section: {
    gap: spacing[3],
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  metricCard: {
    width: '48%',
    minHeight: 104,
    padding: spacing[4],
    justifyContent: 'space-between',
    gap: spacing[3],
    backgroundColor: 'rgba(201,151,28,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(201,151,28,0.19)',
  },
  metricLabel: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  metricValue: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
  },
  dataCard: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  dataRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
    paddingVertical: spacing[3],
  },
  dataKey: {
    width: '38%',
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  dataValue: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    lineHeight: 18,
    textAlign: 'right',
  },
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  infoCard: {
    padding: spacing[4],
    gap: spacing[1],
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  infoTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  infoText: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
  },
  footer: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing[3],
  },
});
