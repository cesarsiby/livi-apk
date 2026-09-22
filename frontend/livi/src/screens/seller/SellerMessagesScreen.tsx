import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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

import { sellerChatApi, type ChatConversation, type ChatMessage } from '../../features/seller/sellerApi';
import { useAuth } from '../../features/auth/AuthProvider';
import {
  Card,
  EmptyState,
  SectionHeader,
  Skeleton,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

function formatMessageTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name?: string | null) {
  const clean = name?.trim();
  if (!clean) return 'CL';

  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CL';
}

export function SellerMessagesScreen() {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const loadConversations = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      setConversations((await sellerChatApi.conversations()) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger vos conversations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setMessagesLoading(true);

    try {
      const next = (await sellerChatApi.messages(conversationId)) ?? [];
      setMessages(next);
      await sellerChatApi.markRead(conversationId).catch(() => {});
    } catch (e: any) {
      if (!silent) {
        setError(e?.message ?? 'Impossible de charger les messages.');
      }
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      setMessages([]);
      return;
    }

    const id = String(selected.id);
    setError('');
    void loadMessages(id);

    const timer = setInterval(() => {
      void loadMessages(id, true);
    }, 10000);

    return () => clearInterval(timer);
  }, [loadMessages, selected?.id]);

  const openConversation = useCallback((conversation: ChatConversation) => {
    setError('');
    setText('');
    setSelected(conversation);
  }, []);

  const closeConversation = useCallback(() => {
    setSelected(null);
    setMessages([]);
    setText('');
    setError('');
  }, []);

  const sendMessage = useCallback(async () => {
    const content = text.trim();
    if (!selected?.id || !content || sending) return;

    setSending(true);
    setError('');
    setText('');

    try {
      const sent = await sellerChatApi.send(String(selected.id), content);
      setMessages((current) => [...current, sent]);

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selected.id
            ? {
                ...conversation,
                last_message_preview: sent?.content ?? content,
                last_message_at: sent?.created_at ?? conversation.last_message_at,
                unread_count: 0,
              }
            : conversation,
        ),
      );

      await sellerChatApi.markRead(String(selected.id)).catch(() => {});
    } catch (e: any) {
      setText(content);
      setError(e?.message ?? 'Impossible d’envoyer le message.');
    } finally {
      setSending(false);
    }
  }, [selected?.id, sending, text]);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime(),
      ),
    [messages],
  );

  if (!selected) {
    if (loading) {
      return (
        <View style={styles.loadingScreen}>
          <Skeleton width={125} height={14} radius={radius.pill} />
          <Skeleton width={250} height={34} radius={radius.md} />
          <Skeleton width="100%" height={82} radius={radius.lg} />
          <Skeleton width="100%" height={82} radius={radius.lg} />
          <Skeleton width="100%" height={82} radius={radius.lg} />
        </View>
      );
    }

    return (
      <View style={styles.screen}>
        <FlatList
          data={conversations}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={[
            styles.listContent,
            conversations.length === 0 ? styles.listEmpty : null,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadConversations(true)}
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.eyebrow}>RELATION CLIENT</Text>
              <Text style={styles.title}>Messages</Text>
              <Text style={styles.subtitle}>
                Répondez à vos clients depuis un seul espace.
              </Text>

              {error ? (
                <Card style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Information</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </Card>
              ) : null}

              {conversations.length > 0 ? (
                <SectionHeader
                  title="Conversations"
                  subtitle={`${conversations.length} conversation${conversations.length > 1 ? 's' : ''}`}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="✉"
              title="Aucune conversation"
              description="Les échanges avec vos clients apparaîtront ici."
            />
          }
          renderItem={({ item }) => {
            const otherName = item.other_user?.name ?? 'Client';
            const unread = Number(item.unread_count ?? 0);

            return (
              <Pressable
                onPress={() => openConversation(item)}
                style={({ pressed }) => [
                  styles.conversationPressable,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Card style={styles.conversationCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(otherName)}</Text>
                  </View>

                  <View style={styles.conversationMain}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.name} numberOfLines={1}>
                        {otherName}
                      </Text>
                      <Text style={styles.date}>
                        {formatMessageTime(item.last_message_at)}
                      </Text>
                    </View>

                    <Text
                      numberOfLines={2}
                      style={[
                        styles.preview,
                        unread > 0 ? styles.previewUnread : null,
                      ]}
                    >
                      {item.last_message_preview ?? 'Aucun message'}
                    </Text>
                  </View>

                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>
                        {unread > 99 ? '99+' : unread}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </Card>
              </Pressable>
            );
          }}
        />
      </View>
    );
  }

  const clientName = selected.other_user?.name ?? 'Client';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
    >
      <View style={styles.chatHeader}>
        <Pressable
          onPress={closeConversation}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backButton,
            pressed ? styles.pressedLight : null,
          ]}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        <View style={styles.chatAvatar}>
          <Text style={styles.chatAvatarText}>{initials(clientName)}</Text>
        </View>

        <View style={styles.chatHeaderMain}>
          <Text style={styles.chatName} numberOfLines={1}>
            {clientName}
          </Text>
          <Text style={styles.chatSubtitle}>Conversation client</Text>
        </View>
      </View>

      {error ? (
        <Card style={styles.chatError}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {messagesLoading ? (
        <View style={styles.messageLoading}>
          <Skeleton width="62%" height={55} radius={radius.lg} />
          <Skeleton width="48%" height={50} radius={radius.lg} />
          <Skeleton width="70%" height={62} radius={radius.lg} />
        </View>
      ) : (
        <FlatList
          data={sortedMessages}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={[
            styles.messagesContent,
            sortedMessages.length === 0 ? styles.messagesEmpty : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;

            return (
              <View
                style={[
                  styles.bubbleWrap,
                  mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs,
                ]}
              >
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={mine ? styles.mineText : styles.theirsText}>
                    {item.content}
                  </Text>
                  <Text style={[styles.time, mine ? styles.mineTime : null]}>
                    {formatMessageTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="◌"
              title="Nouvel échange"
              description="Écrivez votre premier message à ce client."
            />
          }
        />
      )}

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
          returnKeyType="default"
        />

        <Pressable
          disabled={!text.trim() || sending}
          onPress={sendMessage}
          style={({ pressed }) => [
            styles.sendButton,
            !text.trim() || sending ? styles.sendDisabled : null,
            pressed && text.trim() && !sending ? styles.sendPressed : null,
          ]}
          hitSlop={5}
        >
          <Text
            style={[
              styles.sendText,
              !text.trim() || sending ? styles.sendTextDisabled : null,
            ]}
          >
            {sending ? '…' : '↑'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
  listContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  listEmpty: {
    flexGrow: 1,
  },
  header: {
    gap: spacing[3],
    marginBottom: spacing[2],
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
    maxWidth: 360,
  },
  errorCard: {
    padding: spacing[4],
    gap: spacing[1],
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.28)',
    backgroundColor: 'rgba(255, 94, 94, 0.07)',
  },
  errorTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  errorText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  conversationPressable: {
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.992 }],
  },
  conversationCard: {
    minHeight: 86,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.24)',
  },
  avatarText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: fontSize.sm,
  },
  conversationMain: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  date: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  preview: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  previewUnread: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
  },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 7,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  unreadText: {
    color: colors.dark,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
  },
  chevron: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 25,
    lineHeight: 22,
  },
  chatHeader: {
    minHeight: 74,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.dark2,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pressedLight: {
    opacity: 0.75,
  },
  backIcon: {
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: 30,
    lineHeight: 30,
    marginTop: -2,
  },
  chatAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.13)',
  },
  chatAvatarText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: fontSize.sm,
  },
  chatHeaderMain: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  chatName: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  chatSubtitle: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  chatError: {
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: 'rgba(255, 94, 94, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.22)',
  },
  messageLoading: {
    flex: 1,
    padding: spacing[5],
    gap: spacing[3],
    justifyContent: 'flex-end',
  },
  messagesContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  messagesEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  bubbleWrap: {
    width: '100%',
  },
  bubbleWrapMine: {
    alignItems: 'flex-end',
  },
  bubbleWrapTheirs: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    gap: spacing[1],
  },
  mine: {
    backgroundColor: colors.gold,
    borderBottomRightRadius: spacing[1],
  },
  theirs: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: spacing[1],
  },
  mineText: {
    color: colors.dark,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  theirsText: {
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  time: {
    alignSelf: 'flex-end',
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 9,
  },
  mineTime: {
    color: 'rgba(8, 15, 26, 0.62)',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: Platform.OS === 'ios' ? spacing[3] : spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.dark2,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  sendDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendPressed: {
    transform: [{ scale: 0.94 }],
  },
  sendText: {
    color: colors.dark,
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    lineHeight: 22,
  },
  sendTextDisabled: {
    color: colors.gray3,
  },
});
