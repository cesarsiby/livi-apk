import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { liveApi, type LiveShop } from '../../features/live/liveApi';
import { Button, Card, Screen, SectionHeader, StatusBadge } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function LiveDashboardScreen() {
  const [live, setLive] = useState<LiveShop | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const clearError = () => {
    if (error) setError('');
  };

  const start = useCallback(async () => {
    setBusy(true);
    clearError();

    try {
      const created = await liveApi.startLive({});
      setLive(created ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Le démarrage du live a échoué.');
    } finally {
      setBusy(false);
    }
  }, [error]);

  const end = useCallback(async () => {
    if (!live?.id) return;

    setBusy(true);
    clearError();

    try {
      await liveApi.endLive(live.id);
      setLive(null);
    } catch (e: any) {
      setError(e?.message ?? 'La fermeture du live a échoué.');
    } finally {
      setBusy(false);
    }
  }, [error, live?.id]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    clearError();

    try {
      /*
       * The seller start endpoint is the source of truth for the live
       * created by this screen. We deliberately do not infer ownership
       * from /live/active, so no unrelated live can be shown here.
       */
      if (!live?.id) {
        setLive(null);
      } else {
        const current = await liveApi.get(live.id);
        setLive(current ?? null);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Actualisation impossible.');
    } finally {
      setRefreshing(false);
    }
  }, [error, live?.id]);

  const title = live?.title?.trim() || 'Votre session en direct';
  const viewerCount =
    typeof live?.viewer_count === 'number' ? live.viewer_count : null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.gold}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <View style={styles.liveDot} />
            <Text style={styles.kicker}>LIVI LIVE</Text>
          </View>
          <Text style={styles.title}>Pilotez votre direct</Text>
          <Text style={styles.subtitle}>
            Lancez une session, surveillez son état et fermez-la lorsque la
            présentation est terminée.
          </Text>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Une action n’a pas abouti</Text>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {live ? (
          <>
            <Card style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.heroBadge}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.heroBadgeText}>EN DIRECT</Text>
                </View>

                <StatusBadge
                  domain="generic"
                  status={live.status ?? 'active'}
                />
              </View>

              <Text style={styles.liveTitle}>{title}</Text>

              <View style={styles.metaGrid}>
                <View style={styles.metaBlock}>
                  <Text style={styles.metaLabel}>Identifiant</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {live.id}
                  </Text>
                </View>

                {viewerCount !== null ? (
                  <View style={styles.metaBlock}>
                    <Text style={styles.metaLabel}>Spectateurs</Text>
                    <Text style={styles.metaValue}>
                      {viewerCount.toLocaleString('fr-FR')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>

            <SectionHeader title="Contrôle de session" />

            <Card padded>
              <Text style={styles.sectionTitle}>Votre live est actif</Text>
              <Text style={styles.sectionText}>
                Gardez cet écran comme point de contrôle pendant votre session.
                L’état affiché provient directement du live retourné par
                l’API.
              </Text>

              <Button
                title="Terminer le live"
                onPress={end}
                disabled={busy}
                loading={busy}
                variant="red"
                fullWidth
                size="lg"
              />
            </Card>
          </>
        ) : (
          <>
            <Card style={styles.emptyHero}>
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>◎</Text>
              </View>

              <Text style={styles.emptyTitle}>Aucun live en cours</Text>
              <Text style={styles.emptyText}>
                Préparez votre présentation puis ouvrez votre session en un
                seul geste.
              </Text>

              <Button
                title={busy ? 'Démarrage…' : 'Démarrer un live'}
                onPress={start}
                disabled={busy}
                loading={busy}
                fullWidth
                size="lg"
              />
            </Card>

            <SectionHeader title="Avant de démarrer" />

            <View style={styles.steps}>
              <Card style={styles.stepCard}>
                <Text style={styles.stepNumber}>01</Text>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>Préparez votre présentation</Text>
                  <Text style={styles.stepText}>
                    Gardez vos produits et votre scénario à portée de main.
                  </Text>
                </View>
              </Card>

              <Card style={styles.stepCard}>
                <Text style={styles.stepNumber}>02</Text>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>Lancez le direct</Text>
                  <Text style={styles.stepText}>
                    Le live créé par Livi devient immédiatement votre session
                    courante.
                  </Text>
                </View>
              </Card>

              <Card style={styles.stepCard}>
                <Text style={styles.stepNumber}>03</Text>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>Fermez proprement la session</Text>
                  <Text style={styles.stepText}>
                    Utilisez le bouton de fin lorsque votre présentation est
                    terminée.
                  </Text>
                </View>
              </Card>
            </View>
          </>
        )}

        <View style={styles.footer}>
          {refreshing ? <ActivityIndicator size="small" color={colors.gold} /> : null}
          <Text style={styles.footerText}>
            L’écran reste volontairement centré sur les informations réellement
            retournées par le backend.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[8],
    gap: spacing[5],
  },
  header: {
    gap: spacing[2],
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  kicker: {
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 34,
  },
  subtitle: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.35)',
    backgroundColor: 'rgba(255, 94, 94, 0.08)',
  },
  errorTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
    marginBottom: spacing[1],
  },
  errorText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  heroCard: {
    padding: spacing[5],
    gap: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.35)',
    backgroundColor: 'rgba(201, 151, 28, 0.08)',
    borderRadius: radius.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(201, 151, 28, 0.15)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold2,
  },
  heroBadgeText: {
    color: colors.gold2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
  },
  liveTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    lineHeight: 28,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
    paddingTop: spacing[2],
  },
  metaBlock: {
    flex: 1,
    minWidth: 130,
    gap: spacing[1],
  },
  metaLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  metaValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: spacing[1],
  },
  sectionText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  emptyHero: {
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.25)',
  },
  icon: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 30,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    textAlign: 'center',
  },
  emptyText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: spacing[2],
  },
  steps: {
    gap: spacing[3],
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
    padding: spacing[4],
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  stepNumber: {
    color: colors.gold,
    fontFamily: fonts.brand,
    fontSize: fontSize.lg,
    minWidth: 28,
  },
  stepBody: {
    flex: 1,
    gap: spacing[1],
  },
  stepTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  stepText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  footer: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  footerText: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 340,
  },
});
