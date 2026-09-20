import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  sellerChatApi,
  ChatConversation,
  ChatMessage,
} from '../../features/seller/sellerApi';
import { useAuth } from '../../features/auth/AuthProvider';
import { EmptyState, Skeleton } from '../../design/components';
import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

function formatConversationDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  });
}

function formatMessageTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitial(name?: string | null) {
  const value = (name ?? '').trim();
  return value ? value.charAt(0).toUpperCase() : 'V';
}

function ConversationSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <Skeleton width={48} height={48} radius={radius.full} />
          <View style={styles.skeletonCopy}>
            <Skeleton width="48%" height={14} radius={radius.sm} />
            <Skeleton width="82%" height={12} radius={radius.sm} />
          </View>
          <Skeleton width={42} height={12} radius={radius.sm} />
        </View>
      ))}
    </View>
  );
}

function ConversationRow({
  item,
  onPress,
}: {
  item: ChatConversation;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const name = item.other_user?.name ?? 'Vendeur';

  return (
    <Animated.View style={[styles.conversationAnimated, { transform: [{ scale }] }]}>
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
        style={styles.conversationRow}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitial(name)}</Text>
        </View>

        <View style={styles.conversationCopy}>
          <View style={styles.rowTop}>
            <Text
              numberOfLines={1}
              style={[
                styles.conversationName,
                item.unread_count > 0 && styles.conversationNameUnread,
              ]}
            >
              {name}
            </Text>
            <Text style={styles.conversationDate}>
              {formatConversationDate(item.last_message_at)}
            </Text>
          </View>

          <View style={styles.rowBottom}>
            <Text
              numberOfLines={1}
              style={[
                styles.preview,
                item.unread_count > 0 && styles.previewUnread,
              ]}
            >
              {item.last_message_preview ?? 'Aucun message pour le moment'}
            </Text>

            {item.unread_count > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function MessageBubble({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}) {
  return (
    <View style={[styles.messageWrap, mine ? styles.messageWrapMine : styles.messageWrapTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={mine ? styles.messageMine : styles.messageTheirs}>
          {message.content}
        </Text>
        <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>
          {formatMessageTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

export function BuyerMessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const entrance = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const loadConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const result = await sellerChatApi.conversations();
      setConversations(Array.isArray(result) ? result : []);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger vos conversations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    setError('');

    try {
      const result = await sellerChatApi.messages(conversationId);
      setMessages(Array.isArray(result) ? result : []);
      await sellerChatApi.markRead(conversationId).catch(() => undefined);

      setConversations((current) =>
        current.map((conversation) =>
          String(conversation.id) === String(conversationId)
            ? { ...conversation, unread_count: 0 }
            : conversation,
        ),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les messages.');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    if (!selected) return;
    const conversationId = String(selected.id);
    loadMessages(conversationId);

    const timer = setInterval(() => {
      sellerChatApi
        .messages(conversationId)
        .then((result) => setMessages(Array.isArray(result) ? result : []))
        .catch(() => undefined);
    }, 10000);

    return () => clearInterval(timer);
  }, [selected, loadMessages]);

  const filteredConversations = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return conversations;

    return conversations.filter((item) => {
      const name = item.other_user?.name ?? '';
      const preview = item.last_message_preview ?? '';
      return `${name} ${preview}`.toLowerCase().includes(value);
    });
  }, [conversations, query]);

  const totalUnread = useMemo(
    () =>
      conversations.reduce(
        (total, item) => total + Math.max(0, item.unread_count ?? 0),
        0,
      ),
    [conversations],
  );

  async function sendMessage() {
    const value = text.trim();
    if (!selected || !value || sending) return;

    const conversationId = String(selected.id);
    setSending(true);
    setError('');
    setText('');

    try {
      const sent = await sellerChatApi.send(conversationId, value);
      setMessages((current) => [...current, sent]);

      setConversations((current) =>
        current.map((conversation) =>
          String(conversation.id) === conversationId
            ? {
                ...conversation,
                last_message_preview: sent.content,
                last_message_at:
                  sent.created_at ?? conversation.last_message_at,
                unread_count: 0,
              }
            : conversation,
        ),
      );

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (e: any) {
      setText(value);
      setError(e?.message ?? 'Le message n’a pas pu être envoyé.');
    } finally {
      setSending(false);
    }
  }

  if (selected) {
    const selectedName = selected.other_user?.name ?? 'Vendeur';

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.chatScreen}>
          <View style={styles.chatHeader}>
            <Pressable
              onPress={() => {
                setSelected(null);
                setMessages([]);
                setText('');
                setError('');
              }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Retour aux conversations"
            >
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>

            <View style={styles.chatAvatar}>
              <Text style={styles.chatAvatarText}>{getInitial(selectedName)}</Text>
            </View>

            <View style={styles.chatHeaderCopy}>
              <Text numberOfLines={1} style={styles.chatTitle}>
                {selectedName}
              </Text>
              <Text style={styles.chatSubtitle}>Conversation LIVI</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}

          {messagesLoading ? (
            <View style={styles.chatLoading}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.chatLoadingText}>Chargement des messages…</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item, index) => String(item.id ?? index)}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <View style={styles.emptyChatIcon}>
                    <Text style={styles.emptyChatIconText}>•</Text>
                  </View>
                  <Text style={styles.emptyChatTitle}>Commencez la conversation</Text>
                  <Text style={styles.emptyChatText}>Posez votre question au vendeur.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  mine={String(item.sender_id) === String(user?.id)}
                />
              )}
            />
          )}

          <View style={styles.composerShell}>
            <View style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Écrire un message…"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                multiline
                maxLength={2000}
                editable={!sending}
                textAlignVertical="center"
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={sendMessage}
              />
              <Pressable
                onPress={sendMessage}
                disabled={!text.trim() || sending}
                style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Envoyer le message"
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.dark} />
                ) : (
                  <Text style={styles.sendIcon}>↑</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const headerTranslate = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[styles.header, { opacity: entrance, transform: [{ translateY: headerTranslate }] }]}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.eyebrow}>LIVI</Text>
            <Text style={styles.title}>Messages</Text>
          </View>

          {totalUnread > 0 ? (
            <View style={styles.totalUnread}>
              <Text style={styles.totalUnreadNumber}>
                {totalUnread > 99 ? '99+' : totalUnread}
              </Text>
              <Text style={styles.totalUnreadLabel}>
                non lu{totalUnread > 1 ? 's' : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.inboxStatus}>
              <View style={styles.inboxStatusDot} />
              <Text style={styles.inboxStatusText}>Boîte à jour</Text>
            </View>
          )}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher une conversation"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </Animated.View>

      {error ? (
        <View style={styles.errorCard}>
          <View style={styles.errorCopy}>
            <Text style={styles.errorTitle}>Messagerie indisponible</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Pressable onPress={() => loadConversations()} style={styles.retryButton}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <ConversationSkeleton />
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadConversations(true)}
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            filteredConversations.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>Vos conversations</Text>
                <Text style={styles.listCount}>
                  {filteredConversations.length} conversation
                  {filteredConversations.length > 1 ? 's' : ''}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            query.trim() ? (
              <View style={styles.emptyWrapper}>
                <EmptyState
                  icon="·"
                  title="Aucun résultat"
                  description={`Aucune conversation ne correspond à « ${query.trim()} ».`}
                  actionLabel="Effacer la recherche"
                  onAction={() => setQuery('')}
                />
              </View>
            ) : (
              <View style={styles.emptyWrapper}>
                <EmptyState
                  icon="·"
                  title="Aucune conversation"
                  description="Vos échanges avec les vendeurs apparaîtront ici."
                />
              </View>
            )
          }
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              onPress={() => {
                setSelected(item);
                setMessages([]);
                setError('');
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.dark },
  header: { paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[4], gap: spacing[4] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing[3] },
  titleCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.8, color: colors.gold, marginBottom: 2 },
  title: { fontFamily: fonts.brand, fontSize: fontSize['3xl'], lineHeight: 38, color: colors.textPrimary },
  totalUnread: { minWidth: 72, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.xl, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.goldBorder, alignItems: 'center' },
  totalUnreadNumber: { fontFamily: fonts.brandSemibold, fontSize: fontSize.md, color: colors.gold, lineHeight: 20 },
  totalUnreadLabel: { marginTop: 1, fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.textMuted },
  inboxStatus: { minHeight: 34, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.dark3, gap: spacing[2] },
  inboxStatusDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.green },
  inboxStatusText: { fontFamily: fonts.bodySemibold, fontSize: 9, color: colors.textSecondary },
  search: { minHeight: 50, paddingHorizontal: spacing[4], borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.dark3, color: colors.textPrimary, fontFamily: fonts.body, fontSize: fontSize.sm },
  errorCard: { marginHorizontal: spacing[5], marginBottom: spacing[2], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1, borderColor: colors.redBorder, backgroundColor: colors.redDim, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  errorCopy: { flex: 1, gap: spacing[1] },
  errorTitle: { fontFamily: fonts.bodySemibold, fontSize: fontSize.sm, color: colors.textPrimary },
  errorText: { fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 17, color: colors.textMuted },
  retryButton: { minHeight: 36, paddingHorizontal: spacing[3], borderRadius: radius.full, backgroundColor: colors.dark3, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodyBold, fontSize: fontSize.xs, color: colors.gold },
  listContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
  listHeader: { paddingTop: spacing[1], paddingBottom: spacing[3], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing[3] },
  listTitle: { fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, color: colors.textPrimary },
  listCount: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.textMuted },
  conversationAnimated: { marginBottom: spacing[2] },
  conversationRow: { minHeight: 78, padding: spacing[3], borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.dark3, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.goldBorder, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.brandSemibold, fontSize: fontSize.md, color: colors.gold },
  conversationCopy: { flex: 1, minWidth: 0, gap: spacing[2] },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  conversationName: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: fontSize.base, color: colors.textSecondary },
  conversationNameUnread: { color: colors.textPrimary },
  conversationDate: { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  preview: { flex: 1, fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 18, color: colors.textMuted },
  previewUnread: { color: colors.textSecondary, fontFamily: fonts.bodyMedium },
  unreadBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: radius.full, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  unreadBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.dark },
  skeletonList: { paddingHorizontal: spacing[5], paddingTop: spacing[2], gap: spacing[2] },
  skeletonRow: { minHeight: 78, padding: spacing[3], borderRadius: radius.xl, backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  skeletonCopy: { flex: 1, gap: spacing[2] },
  emptyWrapper: { flex: 1, minHeight: 360, alignItems: 'center', justifyContent: 'center' },
  chatScreen: { flex: 1, backgroundColor: colors.dark },
  chatHeader: { minHeight: 76, paddingHorizontal: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.dark2, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  backButton: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  backIcon: { marginTop: -3, fontFamily: fonts.body, fontSize: 30, lineHeight: 30, color: colors.textPrimary },
  chatAvatar: { width: 42, height: 42, borderRadius: radius.full, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.goldBorder, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText: { fontFamily: fonts.brandSemibold, fontSize: fontSize.base, color: colors.gold },
  chatHeaderCopy: { flex: 1, minWidth: 0 },
  chatTitle: { fontFamily: fonts.brandSemibold, fontSize: fontSize.base, color: colors.textPrimary },
  chatSubtitle: { marginTop: 2, fontFamily: fonts.body, fontSize: 9, color: colors.textMuted },
  inlineError: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], backgroundColor: colors.redDim, borderBottomWidth: 1, borderBottomColor: colors.redBorder },
  inlineErrorText: { fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 17, color: colors.textSecondary },
  chatLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  chatLoadingText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.textMuted },
  messagesContent: { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[4], gap: spacing[2], flexGrow: 1 },
  emptyChat: { flex: 1, minHeight: 420, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[8] },
  emptyChatIcon: { width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.goldBorder, alignItems: 'center', justifyContent: 'center' },
  emptyChatIconText: { fontFamily: fonts.brandSemibold, fontSize: fontSize.xl, color: colors.gold },
  emptyChatTitle: { marginTop: spacing[4], fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, color: colors.textPrimary, textAlign: 'center' },
  emptyChatText: { marginTop: spacing[2], fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  messageWrap: { width: '100%', marginBottom: spacing[1] },
  messageWrapMine: { alignItems: 'flex-end' },
  messageWrapTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.xl },
  bubbleMine: { backgroundColor: colors.gold, borderBottomRightRadius: radius.sm },
  bubbleTheirs: { backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: radius.sm },
  messageMine: { fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.dark },
  messageTheirs: { fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.textPrimary },
  messageTime: { marginTop: spacing[2], fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, textAlign: 'right' },
  messageTimeMine: { color: 'rgba(8,15,26,0.62)' },
  composerShell: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: Platform.OS === 'ios' ? spacing[4] : spacing[3], borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.dark2 },
  composer: { minHeight: 54, paddingLeft: spacing[4], paddingRight: spacing[2], borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.dark3, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  input: { flex: 1, maxHeight: 120, paddingVertical: spacing[3], paddingRight: spacing[2], color: colors.textPrimary, fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 19 },
  sendButton: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.42 },
  sendIcon: { marginTop: -2, fontFamily: fonts.bodyBold, fontSize: fontSize.lg, color: colors.dark },
});
