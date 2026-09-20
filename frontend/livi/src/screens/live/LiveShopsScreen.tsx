import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  liveApi,
  LiveShop,
} from '../../features/live/liveApi';

import {
  EmptyState,
  Skeleton,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
  shadow,
} from '../../design/theme';

function LiveCard({
  item,
  onPress,
}: {
  item: LiveShop;
  onPress: () => void;
}) {
  const scale = useRef(
    new Animated.Value(1),
  ).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.985,
      useNativeDriver: true,
      friction: 8,
      tension: 95,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 95,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.card}
      >
        <View style={styles.media}>
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.mediaFallback}>
              <Text style={styles.mediaFallbackMark}>
                L
              </Text>
            </View>
          )}

          <View style={styles.mediaShade} />

          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>
              LIVE
            </Text>
          </View>

          <View style={styles.viewerPill}>
            <Text style={styles.viewerText}>
              {Number(item.viewer_count ?? 0).toLocaleString(
                'fr-FR',
              )}{' '}
              spectateur
              {Number(item.viewer_count ?? 0) > 1
                ? 's'
                : ''}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text
            numberOfLines={2}
            style={styles.title}
          >
            {item.title || 'Live Shopping'}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.vendorBadge}>
              <Text style={styles.vendorBadgeText}>
                {(item.vendor_name || 'V')
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <Text
              numberOfLines={1}
              style={styles.vendorName}
            >
              {item.vendor_name || 'Vendeur'}
            </Text>

            <Text style={styles.openIcon}>
              ›
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function LiveSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <Skeleton
        width="100%"
        height={220}
        radius={radius.xl}
      />
      <Skeleton
        width="72%"
        height={16}
        radius={radius.sm}
      />
      <Skeleton
        width="44%"
        height={13}
        radius={radius.sm}
      />
    </View>
  );
}

export function LiveShopsScreen({
  navigation,
}: any) {
  const [items, setItems] = useState<
    LiveShop[]
  >([]);
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
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const result =
          await liveApi.active();

        setItems(
          Array.isArray(result)
            ? result
            : [],
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger les lives.',
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

  const headerTranslate =
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [12, 0],
    });

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.header,
          {
            opacity: entrance,
            transform: [
              {
                translateY: headerTranslate,
              },
            ],
          },
        ]}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.eyebrow}>
              LIVI
            </Text>
            <Text style={styles.title}>
              Live Shopping
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countNumber}>
              {items.length}
            </Text>
            <Text style={styles.countLabel}>
              en direct
            </Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          Découvrez les lives actuellement
          disponibles.
        </Text>
      </Animated.View>

      {error ? (
        <View style={styles.errorCard}>
          <View style={styles.errorCopy}>
            <Text style={styles.errorTitle}>
              Lives indisponibles
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

      {loading ? (
        <FlatList
          data={[0, 1, 2]}
          keyExtractor={(item) => String(item)}
          contentContainerStyle={
            styles.listContent
          }
          renderItem={() => <LiveSkeleton />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) =>
            String(item.id)
          }
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            items.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>
                  Maintenant
                </Text>
                <View
                  style={styles.liveIndicator}
                >
                  <View
                    style={styles.liveIndicatorDot}
                  />
                  <Text
                    style={
                      styles.liveIndicatorText
                    }
                  >
                    En direct
                  </Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <EmptyState
                icon="·"
                title="Aucun live actif"
                description="Les lives disponibles apparaîtront ici dès qu’ils seront diffusés."
              />
            </View>
          }
          renderItem={({ item }) => (
            <LiveCard
              item={item}
              onPress={() =>
                navigation.navigate(
                  'LiveShop',
                  {
                    liveId: item.id,
                  },
                )
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  titleCopy: {
    flex: 1,
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.gold,
    marginBottom: 2,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  countBadge: {
    minWidth: 72,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
  },

  countNumber: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
    color: colors.gold,
    lineHeight: 20,
  },

  countLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    color: colors.textMuted,
  },

  errorCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
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
    gap: spacing[1],
  },

  errorTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  errorText: {
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
    justifyContent: 'center',
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  listContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[12],
  },

  listHeader: {
    paddingBottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  listTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  liveIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.red,
  },

  liveIndicatorText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.textSecondary,
  },

  cardOuter: {
    marginBottom: spacing[4],
  },

  card: {
    overflow: 'hidden',
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },

  media: {
    height: 220,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.dark2,
  },

  mediaFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark2,
  },

  mediaFallbackMark: {
    fontFamily: fonts.brand,
    fontSize: 48,
    color: colors.gold,
  },

  mediaShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,15,26,0.18)',
  },

  livePill: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    minHeight: 30,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },

  livePillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.white,
    letterSpacing: 0.8,
  },

  viewerPill: {
    position: 'absolute',
    right: spacing[3],
    top: spacing[3],
    minHeight: 30,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,15,26,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewerText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.white,
  },

  cardBody: {
    padding: spacing[4],
    gap: spacing[3],
  },

  title: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    lineHeight: 23,
    color: colors.textPrimary,
  },

  metaRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  vendorBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  vendorBadgeText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  vendorName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  openIcon: {
    fontFamily: fonts.body,
    fontSize: 28,
    lineHeight: 28,
    color: colors.gold,
  },

  skeletonCard: {
    marginBottom: spacing[4],
    gap: spacing[3],
  },

  emptyWrapper: {
    flex: 1,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
