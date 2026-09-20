import React, { useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNotifications } from '../../features/notifications/NotificationsProvider';
import type { NotificationItem } from '../../features/notifications/types';

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
} from '../../design/theme';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString(
      'fr-FR',
      {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  } catch {
    return '';
  }
}

function getTypeIcon(type: string) {
  switch (type.toUpperCase()) {
    case 'ORDER':
      return '□';

    case 'PAYMENT':
      return '₣';

    case 'ESCROW':
      return '✓';

    case 'DELIVERY':
      return '→';

    case 'WITHDRAWAL':
      return '↗';

    case 'DISPUTE':
      return '!';

    case 'SECURITY':
      return '◈';

    default:
      return '·';
  }
}

function NotificationCard({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const unread = !item.read_at;
  const scale = useRef(1);

  const pressIn = () => {
    scale.current = 0.985;
  };

  const pressOut = () => {
    scale.current = 1;
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[
        styles.notificationCard,
        unread &&
          styles.notificationCardUnread,
      ]}
    >
      <View
        style={[
          styles.notificationIcon,
          unread &&
            styles.notificationIconUnread,
        ]}
      >
        <Text
          style={[
            styles.notificationIconText,
            unread &&
              styles.notificationIconTextUnread,
          ]}
        >
          {getTypeIcon(item.type)}
        </Text>
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationTop}>
          <Text
            numberOfLines={2}
            style={[
              styles.notificationTitle,
              unread &&
                styles.notificationTitleUnread,
            ]}
          >
            {item.title}
          </Text>

          {unread ? (
            <View style={styles.unreadDot} />
          ) : null}
        </View>

        <Text
          numberOfLines={3}
          style={styles.notificationBody}
        >
          {item.body}
        </Text>

        <Text style={styles.notificationDate}>
          {formatDate(item.created_at)}
        </Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function LoadingList() {
  return (
    <View style={styles.loadingList}>
      <Skeleton
        height={92}
        radius={radius.xl}
      />
      <Skeleton
        height={92}
        radius={radius.xl}
      />
      <Skeleton
        height={92}
        radius={radius.xl}
      />
    </View>
  );
}

export function NotificationsScreen({
  navigation,
}: any) {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  const parseDeepLink = useCallback(
    (deepLink: string) => {
      try {
        const [name, rawParams] =
          deepLink.split('?');

        if (!name) return null;

        const params = rawParams
          ? Object.fromEntries(
              rawParams
                .split('&')
                .filter(Boolean)
                .map((pair) => {
                  const [
                    key,
                    value = '',
                  ] = pair.split('=');

                  return [
                    decodeURIComponent(key),
                    decodeURIComponent(value),
                  ];
                }),
            )
          : undefined;

        return {
          name,
          params,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  const open = useCallback(
    async (item: NotificationItem) => {
      if (!item.read_at) {
        try {
          await markRead(item.id);
        } catch {
          // Une erreur de lecture ne doit pas empêcher l'ouverture du lien.
        }
      }

      const data = item.data ?? {};
      const rawDeepLink =
        typeof data.deepLink === 'string'
          ? data.deepLink
          : undefined;

      if (!rawDeepLink) return;

      const destination =
        parseDeepLink(rawDeepLink);

      if (!destination) return;

      navigation.navigate(
        destination.name,
        destination.params,
      );
    },
    [markRead, navigation, parseDeepLink],
  );

  const headerSubtitle = useMemo(() => {
    if (loading && notifications.length === 0) {
      return 'Chargement…';
    }

    if (unreadCount === 0) {
      return 'Tout est à jour';
    }

    return `${unreadCount} non lue${
      unreadCount > 1 ? 's' : ''
    }`;
  }, [
    loading,
    notifications.length,
    unreadCount,
  ]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>
            CENTRE D’INFORMATION
          </Text>

          <Text style={styles.title}>
            Notifications
          </Text>

          <Text style={styles.subtitle}>
            {headerSubtitle}
          </Text>
        </View>

        {unreadCount > 0 ? (
          <Pressable
            style={styles.readAllButton}
            onPress={() =>
              void markAllRead()
            }
          >
            <Text style={styles.readAllText}>
              Tout lire
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={() => void refresh()}
          >
            <Text style={styles.retryText}>
              Réessayer
            </Text>
          </Pressable>
        </View>
      ) : null}

      {loading && notifications.length === 0 ? (
        <LoadingList />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.list,
            notifications.length === 0 &&
              styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={
                loading &&
                notifications.length > 0
              }
              onRefresh={refresh}
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            notifications.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderTitle}>
                  Activité récente
                </Text>

                <Text style={styles.listHeaderSubtitle}>
                  Commandes, paiements, livraisons et
                  sécurité.
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="·"
              title="Aucune notification"
              description="Les informations importantes concernant vos commandes et votre compte apparaîtront ici."
            />
          }
          ItemSeparatorComponent={() => (
            <View
              style={{ height: spacing[3] }}
            />
          )}
          renderItem={({ item }) => (
            <NotificationCard
              item={item}
              onPress={() => void open(item)}
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
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  headerCopy: {
    flex: 1,
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
  },

  title: {
    marginTop: 2,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  readAllButton: {
    minHeight: 40,
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    justifyContent: 'center',
  },

  readAllText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  errorBox: {
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

  errorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  loadingList: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },

  list: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[12],
  },

  emptyList: {
    flexGrow: 1,
  },

  listHeader: {
    paddingBottom: spacing[3],
  },

  listHeaderTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  listHeaderSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  notificationCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },

  notificationCardUnread: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.dark3,
  },

  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationIconUnread: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  notificationIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.textMuted,
  },

  notificationIconTextUnread: {
    color: colors.gold,
  },

  notificationContent: {
    flex: 1,
  },

  notificationTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },

  notificationTitle: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.gray2,
  },

  notificationTitleUnread: {
    color: colors.textPrimary,
  },

  unreadDot: {
    width: 7,
    height: 7,
    marginTop: 5,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  notificationBody: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },

  notificationDate: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  chevron: {
    fontFamily: fonts.body,
    fontSize: fontSize['2xl'],
    color: colors.textMuted,
    marginTop: spacing[2],
  },
});
