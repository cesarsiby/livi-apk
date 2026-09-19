import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { socialApi, FeedItem } from '../../features/social/socialApi';
import { VideoPlayer } from '../../design/components';
import { resolveMediaUrl } from '../../services/api/media';
import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

type FeedCardProps = {
  item: FeedItem;
  height: number;
  index: number;
  commenting: boolean;
  comment: string;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onFollow: () => void;
  onSubmitComment: () => void;
  onChangeComment: (value: string) => void;
  onOpenProduct: () => void;
  onOpenLive: () => void;
};

function FeedCard({
  item,
  height,
  commenting,
  comment,
  onLike,
  onComment,
  onShare,
  onFollow,
  onSubmitComment,
  onChangeComment,
  onOpenProduct,
  onOpenLive,
}: FeedCardProps) {
  const actionScale = useRef(new Animated.Value(1)).current;

  const pulse = () => {
    Animated.sequence([
      Animated.spring(actionScale, {
        toValue: 1.08,
        useNativeDriver: true,
        friction: 5,
        tension: 120,
      }),
      Animated.spring(actionScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 100,
      }),
    ]).start();
  };

  const handleLike = () => {
    pulse();
    onLike();
  };

  const mediaUrl = resolveMediaUrl(
    item.video_url || item.thumbnail_url || item.poster_url,
  );

  const hasVideo = Boolean(item.video_url);
  const hasImage = Boolean(item.thumbnail_url || item.poster_url);

  return (
    <View style={[styles.card, { height }]}>
      <View style={styles.media}>
        {hasVideo && mediaUrl ? (
          <VideoPlayer
            uri={mediaUrl}
            style={StyleSheet.absoluteFill}
            loop
            autoPlay={false}
          />
        ) : hasImage && mediaUrl ? (
          <Image
            source={{ uri: mediaUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaPlaceholderMark}>L</Text>
            <Text style={styles.mediaPlaceholderText}>
              Contenu Livi
            </Text>
          </View>
        )}

        <View style={styles.mediaShade} />

        <View style={styles.topOverlay}>
          <Pressable
            style={styles.livePill}
            onPress={onOpenLive}
          >
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE</Text>
          </Pressable>

          <View style={styles.topRight}>
            {item.vendor_id ? (
              <Pressable
                style={styles.followButton}
                onPress={onFollow}
              >
                <Text style={styles.followButtonText}>
                  {item.following ? 'Suivi' : 'Suivre'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.bottomOverlay}>
          <View style={styles.contentColumn}>
            <View style={styles.authorRow}>
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>
                  {(item.vendor_name || 'V').slice(0, 1).toUpperCase()}
                </Text>
              </View>

              <Text style={styles.vendorName} numberOfLines={1}>
                {item.vendor_name || 'Vendeur'}
              </Text>
            </View>

            <Text style={styles.title} numberOfLines={2}>
              {item.title || 'Découvrez ce contenu sur Livi'}
            </Text>

            {item.description ? (
              <Text
                style={styles.description}
                numberOfLines={3}
              >
                {item.description}
              </Text>
            ) : null}

            {item.product_id ? (
              <Pressable
                style={styles.productChip}
                onPress={onOpenProduct}
              >
                <View style={styles.productChipIcon}>
                  <Text style={styles.productChipIconText}>↗</Text>
                </View>

                <View style={styles.productChipTextWrap}>
                  <Text
                    style={styles.productChipName}
                    numberOfLines={1}
                  >
                    {item.product_name || 'Voir le produit'}
                  </Text>

                  {item.product_price != null ? (
                    <Text style={styles.productChipPrice}>
                      {item.product_price.toLocaleString('fr-FR')} FCFA
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.productChipArrow}>›</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sideActions}>
            <Animated.View style={{ transform: [{ scale: actionScale }] }}>
              <Pressable
                style={styles.actionButton}
                onPress={handleLike}
              >
                <View
                  style={[
                    styles.actionIconCircle,
                    item.liked && styles.actionIconCircleLiked,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionIcon,
                      item.liked && styles.actionIconLiked,
                    ]}
                  >
                    {item.liked ? '♥' : '♡'}
                  </Text>
                </View>

                <Text style={styles.actionCount}>
                  {item.likes_count || 0}
                </Text>
              </Pressable>
            </Animated.View>

            <Pressable
              style={styles.actionButton}
              onPress={onComment}
            >
              <View style={styles.actionIconCircle}>
                <Text style={styles.actionIcon}>◌</Text>
              </View>

              <Text style={styles.actionCount}>
                {item.comments_count || 0}
              </Text>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={onShare}
            >
              <View style={styles.actionIconCircle}>
                <Text style={styles.actionIcon}>↗</Text>
              </View>

              <Text style={styles.actionCount}>
                {item.shares_count || 0}
              </Text>
            </Pressable>
          </View>
        </View>

        {commenting ? (
          <View style={styles.commentComposer}>
            <TextInput
              value={comment}
              onChangeText={onChangeComment}
              placeholder="Écrire un commentaire…"
              placeholderTextColor={colors.textMuted}
              style={styles.commentInput}
              returnKeyType="send"
              onSubmitEditing={onSubmitComment}
            />

            <Pressable
              style={[
                styles.commentSend,
                !comment.trim() && styles.commentSendDisabled,
              ]}
              onPress={onSubmitComment}
              disabled={!comment.trim()}
            >
              <Text style={styles.commentSendText}>→</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function FeedSkeleton({ height }: { height: number }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          height,
          opacity,
        },
      ]}
    >
      <View style={styles.skeletonTop} />
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonChip} />
    </Animated.View>
  );
}

export function FeedScreen({ navigation }: any) {
  const { height: windowHeight } = useWindowDimensions();

  const feedHeight = Math.max(
    560,
    windowHeight - 80,
  );

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [commenting, setCommenting] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);

      try {
        setError('');

        const data = await socialApi.feed({
          limit: 20,
        });

        const normalized = Array.isArray(data)
          ? data
          : (data as any)?.items ?? [];

        setItems(normalized);
      } catch (e: any) {
        setError(
          e?.message ?? 'Impossible de charger le feed.',
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
  }, [load]);

  const updateItem = useCallback(
    (
      id: string,
      updater: (item: FeedItem) => FeedItem,
    ) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id ? updater(item) : item,
        ),
      );
    },
    [],
  );

  const toggleLike = useCallback(
    async (item: FeedItem) => {
      try {
        if (item.liked) {
          await socialApi.unlike(
            item.type || 'video',
            item.id,
          );
        } else {
          await socialApi.like(
            item.type || 'video',
            item.id,
          );
        }

        updateItem(item.id, (current) => ({
          ...current,
          liked: !current.liked,
          likes_count: Math.max(
            0,
            (current.likes_count || 0) +
              (current.liked ? -1 : 1),
          ),
        }));
      } catch (e: any) {
        Alert.alert(
          'Action non effectuée',
          e?.message ??
            "Impossible de modifier votre réaction pour le moment.",
        );
      }
    },
    [updateItem],
  );

  const toggleFollow = useCallback(
    async (item: FeedItem) => {
      if (!item.vendor_id) return;

      try {
        if (item.following) {
          await socialApi.unfollow(item.vendor_id);
        } else {
          await socialApi.follow(item.vendor_id);
        }

        setItems((current) =>
          current.map((entry) => ({
            ...entry,
            following:
              entry.vendor_id === item.vendor_id
                ? !item.following
                : entry.following,
          })),
        );
      } catch (e: any) {
        Alert.alert(
          'Action non effectuée',
          e?.message ??
            "Impossible de modifier l'abonnement pour le moment.",
        );
      }
    },
    [],
  );

  const openComments = useCallback((id: string) => {
    setCommenting((current) =>
      current === id ? null : id,
    );
    setComment('');
  }, []);

  const submitComment = useCallback(
    async (item: FeedItem) => {
      const text = comment.trim();

      if (!text) return;

      try {
        await socialApi.comment(
          item.type || 'video',
          item.id,
          text,
        );

        setComment('');
        setCommenting(null);

        updateItem(item.id, (current) => ({
          ...current,
          comments_count:
            (current.comments_count || 0) + 1,
        }));
      } catch (e: any) {
        Alert.alert(
          'Commentaire',
          e?.message ??
            "Impossible d'envoyer le commentaire.",
        );
      }
    },
    [comment, updateItem],
  );

  const shareItem = useCallback(
    async (item: FeedItem) => {
      try {
        await socialApi.share(
          item.type || 'video',
          item.id,
        );

        await Share.share({
          message:
            item.title ||
            item.product_name ||
            'Découvrez ce contenu sur Livi.',
        });

        updateItem(item.id, (current) => ({
          ...current,
          shares_count:
            (current.shares_count || 0) + 1,
        }));
      } catch {
        // L'annulation du partage natif n'est pas une erreur à afficher.
      }
    },
    [updateItem],
  );

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>LIVI</Text>
          <Text style={styles.headerTitle}>Découvrir</Text>
        </View>

        <Pressable
          style={styles.headerLiveButton}
          onPress={() => navigation.navigate('LiveShops')}
        >
          <View style={styles.headerLiveDot} />
          <Text style={styles.headerLiveText}>
            Lives
          </Text>
        </Pressable>
      </View>
    ),
    [navigation],
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        {header}
        <FeedSkeleton height={feedHeight} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        {header}

        <View style={styles.errorState}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>

          <Text style={styles.errorTitle}>
            Le feed n’est pas disponible
          </Text>

          <Text style={styles.errorMessage}>
            {error}
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={() => load()}
          >
            <Text style={styles.retryButtonText}>
              Réessayer
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        {header}

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>L</Text>
          </View>

          <Text style={styles.emptyTitle}>
            Rien à découvrir pour le moment
          </Text>

          <Text style={styles.emptyMessage}>
            Les nouveaux contenus et lives apparaîtront
            ici dès qu’ils seront disponibles.
          </Text>

          <Pressable
            style={styles.emptyButton}
            onPress={() => load()}
          >
            <Text style={styles.emptyButtonText}>
              Actualiser
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <FeedCard
            item={item}
            height={feedHeight}
            index={index}
            commenting={commenting === item.id}
            comment={comment}
            onLike={() => toggleLike(item)}
            onComment={() => openComments(item.id)}
            onShare={() => shareItem(item)}
            onFollow={() => toggleFollow(item)}
            onSubmitComment={() =>
              submitComment(item)
            }
            onChangeComment={setComment}
            onOpenProduct={() =>
              item.product_id &&
              navigation.navigate('Product', {
                productId: item.product_id,
              })
            }
            onOpenLive={() =>
              navigation.navigate('LiveShops')
            }
          />
        )}
        pagingEnabled
        snapToInterval={feedHeight}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        bounces
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  header: {
    minHeight: 72,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dark,
  },

  headerEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.gold,
  },

  headerTitle: {
    marginTop: 1,
    fontFamily: fonts.brand,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
  },

  headerLiveButton: {
    height: 38,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.dark3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  headerLiveDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.red,
  },

  headerLiveText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  card: {
    width: '100%',
    backgroundColor: colors.dark,
  },

  media: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.dark2,
    position: 'relative',
  },

  mediaShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,15,26,0.22)',
  },

  mediaPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark2,
  },

  mediaPlaceholderMark: {
    fontFamily: fonts.brand,
    fontSize: 64,
    color: colors.gold,
  },

  mediaPlaceholderText: {
    marginTop: spacing[2],
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  topOverlay: {
    position: 'absolute',
    top: spacing[4],
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  topRight: {
    alignItems: 'flex-end',
  },

  livePill: {
    height: 32,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,15,26,0.76)',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.red,
  },

  livePillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textPrimary,
  },

  followButton: {
    minHeight: 34,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    justifyContent: 'center',
  },

  followButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.dark,
  },

  bottomOverlay: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[4],
    bottom: spacing[5],
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[4],
  },

  contentColumn: {
    flex: 1,
  },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },

  authorAvatar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  authorAvatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  vendorName: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  title: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    lineHeight: 25,
    color: colors.textPrimary,
  },

  description: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.gray2,
  },

  productChip: {
    marginTop: spacing[3],
    minHeight: 60,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(8,15,26,0.84)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  productChipIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldDim,
  },

  productChipIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  productChipTextWrap: {
    flex: 1,
  },

  productChipName: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  productChipPrice: {
    marginTop: 2,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  productChipArrow: {
    fontFamily: fonts.body,
    fontSize: fontSize.xl,
    color: colors.textMuted,
  },

  sideActions: {
    width: 52,
    alignItems: 'center',
    gap: spacing[4],
    paddingBottom: 2,
  },

  actionButton: {
    alignItems: 'center',
  },

  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,15,26,0.74)',
    borderWidth: 1,
    borderColor: colors.border,
  },

  actionIconCircleLiked: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  actionIcon: {
    fontFamily: fonts.bodySemibold,
    fontSize: 21,
    color: colors.textPrimary,
  },

  actionIconLiked: {
    color: colors.gold,
  },

  actionCount: {
    marginTop: 4,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.textPrimary,
  },

  commentComposer: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[3],
    minHeight: 56,
    paddingLeft: spacing[4],
    paddingRight: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  commentInput: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  commentSend: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  commentSendDisabled: {
    opacity: 0.45,
  },

  commentSendText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.dark,
  },

  skeleton: {
    margin: spacing[3],
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.dark3,
    padding: spacing[5],
    justifyContent: 'flex-end',
  },

  skeletonTop: {
    width: 54,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
  },

  skeletonTitle: {
    width: '78%',
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.dark4,
    marginTop: 'auto',
  },

  skeletonLine: {
    width: '92%',
    height: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.dark4,
    marginTop: spacing[2],
  },

  skeletonChip: {
    width: '66%',
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    marginTop: spacing[3],
  },

  errorState: {
    flex: 1,
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },

  errorIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xl,
    color: colors.red,
  },

  errorTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  errorMessage: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: spacing[5],
    minHeight: 46,
    paddingHorizontal: spacing[6],
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  emptyState: {
    flex: 1,
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyIconText: {
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    color: colors.gold,
  },

  emptyTitle: {
    marginTop: spacing[5],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    textAlign: 'center',
    color: colors.textPrimary,
  },

  emptyMessage: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textMuted,
  },

  emptyButton: {
    marginTop: spacing[5],
    minHeight: 44,
    paddingHorizontal: spacing[5],
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },
});
