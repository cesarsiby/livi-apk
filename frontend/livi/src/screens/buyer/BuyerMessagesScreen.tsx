import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { sellerChatApi, ChatConversation, ChatMessage } from '../../features/seller/sellerApi';
import { useAuth } from '../../features/auth/AuthProvider';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function BuyerMessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // GET /chat/conversations resolves to the array itself (already
      // unwrapped from {success,data}) — no further nesting to peel off.
      setConversations(await sellerChatApi.conversations());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);

  useEffect(() => {
    if (!selected) return;
    const id = String(selected.id);
    const pull = () => sellerChatApi.messages(id).then(setMessages).catch(() => undefined);
    pull();
    sellerChatApi.markRead(id).catch(() => undefined);
    const timer = setInterval(pull, 10000);
    return () => clearInterval(timer);
  }, [selected]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;

  if (selected) {
    return (
      <View style={styles.container}>
        <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>‹ Conversations</Text></Pressable>
        <Text style={styles.title}>{selected.other_user?.name ?? 'Vendeur'}</Text>
        <FlatList
          data={messages}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.messages}
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={mine ? styles.mineText : styles.theirsText}>{item.content}</Text>
                <Text style={styles.time}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput value={text} onChangeText={setText} placeholder="Écrire un message…" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Pressable
            style={styles.send}
            disabled={!text.trim()}
            onPress={async () => {
              const value = text.trim();
              if (!value) return;
              setText('');
              const sent = await sellerChatApi.send(String(selected.id), value);
              setMessages((current) => [...current, sent]);
            }}
          >
            <Text style={styles.sendText}>Envoyer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={conversations}
      keyExtractor={(item, index) => String(item.id ?? index)}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>Aucune conversation.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => setSelected(item)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.other_user?.name ?? 'Vendeur'}</Text>
            <Text style={styles.muted}>{item.last_message_preview ?? 'Aucun message'}</Text>
          </View>
          {item.unread_count ? <Text style={styles.badge}>{item.unread_count}</Text> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  muted: { color: colors.gray2, marginTop: 3, fontFamily: fonts.body, fontSize: fontSize.sm },
  badge: {
    backgroundColor: colors.gold,
    color: colors.dark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    overflow: 'hidden',
  },
  empty: { padding: spacing[10], textAlign: 'center', color: colors.textMuted, fontFamily: fonts.body },
  container: { flex: 1, padding: spacing[4], backgroundColor: colors.dark },
  back: { color: colors.gold, fontFamily: fonts.bodySemibold, marginBottom: spacing[3] },
  title: { fontSize: fontSize.xl, fontFamily: fonts.brand, color: colors.textPrimary },
  messages: { paddingVertical: spacing[3], gap: spacing[2] },
  bubble: { padding: spacing[3], borderRadius: radius.md, maxWidth: '80%' },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.gold },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border },
  mineText: { color: colors.dark, fontFamily: fonts.body },
  theirsText: { color: colors.textPrimary, fontFamily: fonts.body },
  time: { fontSize: 9, color: colors.textMuted, marginTop: 4, fontFamily: fonts.body },
  composer: { flexDirection: 'row', gap: spacing[2], paddingVertical: spacing[2] },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    backgroundColor: colors.dark3,
  },
  send: { backgroundColor: colors.gold, paddingHorizontal: spacing[4], justifyContent: 'center', borderRadius: radius.md },
  sendText: { color: colors.dark, fontFamily: fonts.bodyBold },
});
