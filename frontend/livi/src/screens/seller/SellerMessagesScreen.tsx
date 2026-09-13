import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { sellerChatApi, ChatConversation, ChatMessage } from '../../features/seller/sellerApi';
import { useAuth } from '../../features/auth/AuthProvider';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function SellerMessagesScreen() {
  const { user } = useAuth();
  const [convos, setConvos] = useState<ChatConversation[]>([]);
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    // GET /chat/conversations resolves to the array itself — there was never
    // a nested .conversations key, so the list was always empty before.
    sellerChatApi.conversations().then(setConvos).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) return;
    const id = String(selected.id);
    const pull = () => sellerChatApi.messages(id).then(setMessages).catch(() => {});
    pull();
    sellerChatApi.markRead(id).catch(() => {});
    const timer = setInterval(pull, 10000);
    return () => clearInterval(timer);
  }, [selected]);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.gold} /></View>;

  if (selected) {
    return (
      <View style={s.container}>
        <Pressable onPress={() => setSelected(null)}><Text style={s.back}>‹ Conversations</Text></Pressable>
        <Text style={s.title}>{selected.other_user?.name ?? 'Client'}</Text>
        <FlatList
          data={messages}
          keyExtractor={(x, i) => String(x.id ?? i)}
          contentContainerStyle={s.messages}
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            return (
              <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                <Text style={mine ? s.mineText : s.theirsText}>{item.content}</Text>
                <Text style={s.time}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>
              </View>
            );
          }}
        />
        <View style={s.composer}>
          <TextInput value={text} onChangeText={setText} placeholder="Écrire un message…" placeholderTextColor={colors.textMuted} style={s.input} />
          <Pressable
            style={s.send}
            disabled={!text.trim()}
            onPress={async () => {
              const t = text.trim();
              if (!t) return;
              setText('');
              const sent = await sellerChatApi.send(String(selected.id), t);
              setMessages((m) => [...m, sent]);
            }}
          >
            <Text style={s.sendText}>Envoyer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={s.screen}
      data={convos}
      keyExtractor={(x, i) => String(x.id ?? i)}
      contentContainerStyle={s.list}
      ListEmptyComponent={<Text style={s.empty}>Aucune conversation.</Text>}
      renderItem={({ item }) => (
        <Pressable style={s.card} onPress={() => setSelected(item)}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{item.other_user?.name ?? 'Client'}</Text>
            <Text style={s.muted}>{item.last_message_preview ?? 'Aucun message'}</Text>
          </View>
          {item.unread_count ? <Text style={s.badge}>{item.unread_count}</Text> : null}
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark },
  list: { padding: spacing[4], gap: spacing[3] },
  card: { backgroundColor: colors.dark3, borderWidth: 1, borderColor: colors.border, padding: spacing[4], borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  muted: { color: colors.gray2, marginTop: 3, fontFamily: fonts.body, fontSize: fontSize.sm },
  badge: { backgroundColor: colors.gold, color: colors.dark, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, fontFamily: fonts.bodyBold, fontSize: fontSize.xs, overflow: 'hidden' },
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
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], color: colors.textPrimary, fontFamily: fonts.body, backgroundColor: colors.dark3 },
  send: { backgroundColor: colors.gold, paddingHorizontal: spacing[4], justifyContent: 'center', borderRadius: radius.md },
  sendText: { color: colors.dark, fontFamily: fonts.bodyBold },
});
