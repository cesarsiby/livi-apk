import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  liveApi,
  LiveShop,
} from '../../features/live/liveApi';

import {
  Button,
  VideoPlayer,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  shadow,
  spacing,
} from '../../design/theme';

export function LiveShopScreen({
  route,
  navigation,
}: any) {
  const liveId = String(
    route?.params?.liveId ?? '',
  );

  const [item, setItem] =
    useState<LiveShop | null>(null);

  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState('');

  const entrance = useRef(
    new Animated.Value(0),
  ).current;

  const load = useCallback(
    async (isRefresh = false) => {
      if (!liveId) {
        setError('Live introuvable.');
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const result =
          await liveApi.get(liveId);

        setItem(result);
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger le live.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [liveId],
  );

  useEffect(() => {
    load();

    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();

    const timer = setInterval(() => {
      load(true);
    }, 30000);

    return () => clearInterval(timer);
  }, [load, entrance]);

  const translateY =
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [12, 0],
    });

  if (loading && !item) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="small"
          color={colors.gold}
        />
        <Text style={styles.centerText}>
          Chargement du live…
        </Text>
      </View>
    );
  }

  if (error && !item) {
    return (
      <View style={styles.center}>
        <View style={styles.errorMark}>
          <Text style={styles.errorMarkText}>
            !
          </Text>
        </View>

        <Text style={styles.errorTitle}>
          Live indisponible
        </Text>

        <Text style={styles.errorText}>
          {error}
        </Text>

        <Button
          title="Réessayer"
          onPress={() => load()}
          size="md"
        />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>
          Live indisponible.
        </Text>
      </View>
    );
  }

  const streamUrl =
    item.stream_url ?? '';
  const thumbnail =
    item.thumbnail_url ?? '';

  const title =
    item.title || 'Live Shopping';

  const vendor =
    item.vendor_name || 'Vendeur';

  const viewers = Number(
    item.viewer_count ?? 0,
  );

  const canOpenStream =
    Boolean(streamUrl);

  const shareLive = async () => {
    try {
      await Share.share({
        message: `${title} — ${vendor}`,
      });
    } catch {
      // Annulation ou indisponibilité du partage :
      // aucune mutation métier à effectuer.
    }
  };

  return (
    <ScrollView
      style={styles.screen}
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
        <View style={styles.topBar}>
          <Pressable
            onPress={() =>
              navigation?.goBack?.()
            }
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Text style={styles.backIcon}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.topLivePill}>
            <View style={styles.liveDot} />
            <Text style={styles.topLiveText}>
              EN DIRECT
            </Text>
          </View>

          <Pressable
            onPress={shareLive}
            style={styles.shareButton}
            accessibilityRole="button"
            accessibilityLabel="Partager le live"
          >
            <Text style={styles.shareIcon}>
              ↗
            </Text>
          </Pressable>
        </View>

        <View style={styles.playerCard}>
          {canOpenStream ? (
            <VideoPlayer
              uri={streamUrl}
              style={styles.player}
              autoPlay={false}
              loop
            />
          ) : thumbnail ? (
            <Image
              source={{ uri: thumbnail }}
              style={styles.player}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.playerFallback}>
              <Text
                style={
                  styles.playerFallbackMark
                }
              >
                L
              </Text>

              <Text
                style={
                  styles.playerFallbackText
                }
              >
                Flux vidéo indisponible
              </Text>
            </View>
          )}

          <View style={styles.playerOverlay}>
            <View style={styles.playerLiveBadge}>
              <View style={styles.liveDot} />
              <Text
                style={
                  styles.playerLiveBadgeText
                }
              >
                LIVE
              </Text>
            </View>

            <View style={styles.viewerPill}>
              <Text style={styles.viewerPillText}>
                {viewers.toLocaleString(
                  'fr-FR',
                )}{' '}
                spectateur
                {viewers > 1
                  ? 's'
                  : ''}
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <Text
              style={
                styles.inlineErrorText
              }
            >
              {error}
            </Text>

            <Pressable
              onPress={() => load()}
            >
              <Text
                style={styles.retryText}
              >
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={styles.vendorRow}>
            <View style={styles.vendorAvatar}>
              <Text
                style={
                  styles.vendorAvatarText
                }
              >
                {vendor
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View
              style={
                styles.vendorCopy
              }
            >
              <Text
                style={styles.vendorName}
                numberOfLines={1}
              >
                {vendor}
              </Text>

              <Text
                style={styles.vendorMeta}
              >
                Live Shopping
              </Text>
            </View>

            <View
              style={
                styles.viewerInline
              }
            >
              <View
                style={
                  styles.viewerInlineDot
                }
              />
              <Text
                style={
                  styles.viewerInlineText
                }
              >
                {viewers.toLocaleString(
                  'fr-FR',
                )}
              </Text>
            </View>
          </View>

          <Text
            style={styles.title}
            numberOfLines={3}
          >
            {title}
          </Text>

          <View style={styles.divider} />

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Text
                style={
                  styles.infoIconText
                }
              >
                •
              </Text>
            </View>

            <View
              style={
                styles.infoCopy
              }
            >
              <Text
                style={styles.infoTitle}
              >
                Vous regardez un live
              </Text>

              <Text
                style={styles.infoText}
              >
                Le contenu affiché
                correspond aux informations
                actuellement fournies par
                LIVI.
              </Text>
            </View>
          </View>

          {canOpenStream ? (
            <Button
              title="Ouvrir le flux vidéo"
              onPress={() => {
                // Le VideoPlayer natif reste le lecteur
                // principal lorsque stream_url existe.
                // Aucun nouvel endpoint n'est appelé ici.
              }}
              fullWidth
              size="lg"
            />
          ) : null}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingBottom: spacing[12],
  },

  center: {
    flex: 1,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },

  centerText: {
    marginTop: spacing[3],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },

  errorMark: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorMarkText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.red,
  },

  errorTitle: {
    marginTop: spacing[4],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  errorText: {
    marginTop: spacing[2],
    marginBottom: spacing[5],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },

  topBar: {
    minHeight: 68,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backIcon: {
    marginTop: -3,
    fontFamily: fonts.body,
    fontSize: 30,
    lineHeight: 30,
    color: colors.textPrimary,
  },

  topLivePill: {
    minHeight: 32,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  topLiveText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.red,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.red,
  },

  shareButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareIcon: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },

  playerCard: {
    marginHorizontal: spacing[4],
    height: 420,
    overflow: 'hidden',
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },

  player: {
    width: '100%',
    height: '100%',
  },

  playerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark2,
    paddingHorizontal: spacing[8],
  },

  playerFallbackMark: {
    fontFamily: fonts.brand,
    fontSize: 54,
    color: colors.gold,
  },

  playerFallbackText: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },

  playerOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: spacing[3],
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'flex-start',
    pointerEvents: 'none',
  },

  playerLiveBadge: {
    minHeight: 30,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },

  playerLiveBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.white,
    letterSpacing: 0.8,
  },

  viewerPill: {
    minHeight: 30,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor:
      'rgba(8,15,26,0.76)',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewerPillText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.white,
  },

  inlineError: {
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  inlineErrorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[4],
  },

  vendorRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  vendorAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  vendorAvatarText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  vendorCopy: {
    flex: 1,
    minWidth: 0,
  },

  vendorName: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  vendorMeta: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },

  viewerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  viewerInlineDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.red,
  },

  viewerInlineText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    lineHeight: 30,
    color: colors.textPrimary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  infoCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing[3],
  },

  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoIconText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  infoCopy: {
    flex: 1,
    gap: spacing[1],
  },

  infoTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  infoText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
