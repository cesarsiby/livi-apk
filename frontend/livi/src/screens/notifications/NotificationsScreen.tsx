import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNotifications } from '../../features/notifications/NotificationsProvider';
import type { NotificationItem } from '../../features/notifications/types';
import { Card, EmptyState, Skeleton } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function NotificationsScreen({ navigation }: any) {
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead } = useNotifications();

  const open = async (item: NotificationItem) => {
    if (!item.read_at) await markRead(item.id);
    const data = item.data ?? {};
    const route = typeof data.deepLink === 'string' ? data.deepLink : undefined;
    if (route) {
      const [name, rawParams] = route.split('?');
      const params = rawParams ? Object.fromEntries(rawParams.split('&').filter(Boolean).map(pair => { const [key, value = ''] = pair.split('='); return [decodeURIComponent(key), decodeURIComponent(value)]; })) : undefined;
      navigation.navigate(name, params);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{unreadCount} non lue(s)</Text>
        </View>
        {unreadCount > 0 && <Pressable onPress={() => void markAllRead()}><Text style={styles.action}>Tout lire</Text></Pressable>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading && notifications.length === 0 ? (
        <View style={{ gap: spacing[2] }}>
          <Skeleton height={78} radius={radius.lg} />
          <Skeleton height={78} radius={radius.lg} />
          <Skeleton height={78} radius={radius.lg} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.gold} />}
          ListEmptyComponent={<EmptyState icon="🔔" title="Aucune notification" description="Vos commandes, paiements et livraisons vous tiendront informé ici." />}
          renderItem={({ item }) => (
            <Pressable onPress={() => void open(item)}>
              <Card style={[styles.card, !item.read_at && styles.unread]}>
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {!item.read_at && <View style={styles.dot} />}
                </View>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString('fr-FR')}</Text>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing[4], backgroundColor: colors.dark },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] },
  title: { fontSize: fontSize['2xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  subtitle: { marginTop: 4, color: colors.gray, fontFamily: fonts.body, fontSize: fontSize.sm },
  action: { fontFamily: fonts.bodySemibold, color: colors.gold },
  card: { padding: spacing[4], marginBottom: spacing[2] },
  unread: { borderColor: colors.goldBorder, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: fontSize.base, fontFamily: fonts.bodySemibold, color: colors.textPrimary, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.full, marginLeft: spacing[2], backgroundColor: colors.gold },
  body: { marginTop: spacing[2], lineHeight: 20, color: colors.gray2, fontFamily: fonts.body },
  date: { marginTop: spacing[2], fontSize: fontSize.xs, color: colors.textMuted, fontFamily: fonts.body },
  empty: { textAlign: 'center', padding: spacing[8], color: colors.textMuted, fontFamily: fonts.body },
  error: { marginBottom: spacing[2], color: colors.red, fontFamily: fonts.body },
});
