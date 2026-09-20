import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { liveApi } from '../../features/live/liveApi';

import {
  EmptyState,
  Skeleton,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  shadow,
  spacing,
} from '../../design/theme';

export function CreatorToolsScreen({
  navigation,
}: any) {
  const [subscriptions, setSubscriptions] =
    useState<any[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState('');

  const entrance = useRef(
    new Animated.Value(0),
  ).current;

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const result =
          await liveApi.vendorSubscriptions();

        setSubscriptions(
          Array.isArray(result)
            ? result
            : [],
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger vos abonnements.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    load();

    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [load, entrance]);

  const translateY =
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [12, 0],
    });

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton
          width="38%"
          height={13}
          radius={radius.sm}
        />
        <Skeleton
          width="72%"
          height={34}
          radius={radius.md}
        />
        <Skeleton
          width="100%"
          height={120}
          radius={radius['2xl']}
        />
        <Skeleton
          width="100%"
          height={110}
          radius={radius.xl}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
      >
        <Animated.View
          style={{
            opacity: entrance,
            transform: [
              { translateY },
            ],
          }}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>
              ESPACE CRÉATEUR
            </Text>

            <Text style={styles.title}>
              Creator Tools
            </Text>

            <Text style={styles.subtitle}>
              Un espace dédié aux fonctionnalités
              de contenu de votre activité vendeur.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <View style={styles.errorCopy}>
                <Text style={styles.errorTitle}>
                  Données indisponibles
                </Text>
                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>

              <Pressable
                onPress={() => load()}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>
                  Réessayer
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Text style={styles.heroIconText}>
                  L
                </Text>
              </View>

              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  CRÉATEUR
                </Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>
              Votre audience LIVI
            </Text>

            <Text style={styles.heroSubtitle}>
              Nombre d’abonnements renvoyés
              actuellement par votre espace
              créateur.
            </Text>

            <View style={styles.audienceRow}>
              <View style={styles.audienceValueWrap}>
                <Text style={styles.audienceValue}>
                  {subscriptions.length.toLocaleString(
                    'fr-FR',
                  )}
                </Text>

                <Text style={styles.audienceLabel}>
                  abonné
                  {subscriptions.length > 1
                    ? 's'
                    : ''}
                </Text>
              </View>

              <View style={styles.audienceDivider} />

              <View style={styles.audienceHint}>
                <Text style={styles.audienceHintTitle}>
                  Donnée serveur
                </Text>

                <Text style={styles.audienceHintText}>
                  Cette valeur est issue de votre
                  endpoint d’abonnements vendeur.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>
                Outils créateur
              </Text>

              <Text style={styles.sectionSubtitle}>
                Accès rapide aux fonctionnalités
                contenu déjà disponibles dans LIVI.
              </Text>
            </View>
          </View>

          <View style={styles.toolList}>
            <ToolCard
              title="Vidéos"
              description="Gérez les vidéos que vous publiez pour votre activité."
              actionLabel="Ouvrir"
              onPress={() =>
                navigation.navigate(
                  'VideoManager',
                )
              }
            />

            <ToolCard
              title="Importer une vidéo"
              description="Ajoutez une nouvelle vidéo depuis votre appareil."
              actionLabel="Créer"
              onPress={() =>
                navigation.navigate(
                  'VideoUpload',
                )
              }
            />

            <ToolCard
              title="Analytics vidéo"
              description="Consultez les statistiques disponibles pour vos contenus."
              actionLabel="Consulter"
              onPress={() =>
                navigation.navigate(
                  'VideoAnalytics',
                )
              }
            />

            <ToolCard
              title="Live"
              description="Accédez aux outils de diffusion live vendeur."
              actionLabel="Ouvrir"
              onPress={() =>
                navigation.navigate(
                  'LiveDashboard',
                )
              }
            />
          </View>

          <View style={styles.footerCard}>
            <View style={styles.footerIcon}>
              <Text style={styles.footerIconText}>
                i
              </Text>
            </View>

            <Text style={styles.footerText}>
              Les fonctionnalités affichées ici
              correspondent aux écrans déjà
              enregistrés dans la navigation vendeur.
              Aucune métrique ou capacité supplémentaire
              n’est déduite localement.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ToolCard({
  title,
  description,
  actionLabel,
  onPress,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
}) {
  const scale = useRef(
    new Animated.Value(1),
  ).current;

  return (
    <Animated.View
      style={[
        styles.toolAnimated,
        {
          transform: [
            { scale },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.985,
            useNativeDriver: true,
            friction: 8,
            tension: 95,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 95,
          }).start()
        }
        style={styles.toolCard}
      >
        <View style={styles.toolIcon}>
          <Text style={styles.toolIconText}>
            +
          </Text>
        </View>

        <View style={styles.toolCopy}>
          <Text style={styles.toolTitle}>
            {title}
          </Text>

          <Text style={styles.toolDescription}>
            {description}
          </Text>
        </View>

        <View style={styles.toolAction}>
          <Text style={styles.toolActionText}>
            {actionLabel}
          </Text>
          <Text style={styles.toolArrow}>
            ›
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
  },

  loadingScreen: {
    flex: 1,
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
    letterSpacing: 1.8,
    color: colors.gold,
  },

  title: {
    marginTop: 2,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  errorCard: {
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

  errorCopy: {
    flex: 1,
  },

  errorTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  errorText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  retryButton: {
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  heroCard: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    ...shadow.md,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroIconText: {
    fontFamily: fonts.brand,
    fontSize: fontSize.xl,
    color: colors.gold,
  },

  livePill: {
    minHeight: 30,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },

  liveText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },

  heroTitle: {
    marginTop: spacing[5],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  heroSubtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  audienceRow: {
    marginTop: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
  },

  audienceValueWrap: {
    minWidth: 118,
  },

  audienceValue: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.gold,
  },

  audienceLabel: {
    marginTop: 2,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  audienceDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: spacing[4],
    backgroundColor: colors.goldBorder,
  },

  audienceHint: {
    flex: 1,
  },

  audienceHintTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  audienceHintText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 15,
    color: colors.textMuted,
  },

  sectionHeader: {
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },

  sectionCopy: {
    gap: 2,
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
  },

  toolList: {
    gap: spacing[3],
  },

  toolAnimated: {
    width: '100%',
  },

  toolCard: {
    minHeight: 88,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  toolIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  toolIconText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  toolCopy: {
    flex: 1,
    minWidth: 0,
  },

  toolTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  toolDescription: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
  },

  toolAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 1,
  },

  toolActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.gold,
  },

  toolArrow: {
    fontFamily: fonts.body,
    fontSize: 23,
    lineHeight: 23,
    color: colors.gold,
  },

  footerCard: {
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing[3],
  },

  footerIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footerIconText: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },

  footerText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
