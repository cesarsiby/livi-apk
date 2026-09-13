import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { liveApi } from '../../features/live/liveApi';
import { Button } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function VideoUploadScreen({ navigation }: any) {
  const [uri, setUri] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (!r.canceled && r.assets?.[0]) setUri(r.assets[0].uri);
  };
  const upload = async () => {
    if (!uri || !title.trim()) return;
    setBusy(true); setError('');
    try { await liveApi.uploadVideo(uri, { title: title.trim(), description: desc }); navigation.goBack(); }
    catch (e: any) { setError(e?.message ?? 'Upload impossible.'); }
    finally { setBusy(false); }
  };

  return (
    <View style={s.c}>
      <TouchableOpacity style={s.pick} onPress={pick}>
        <Text style={s.pickText}>{uri ? 'Vidéo sélectionnée' : 'Choisir une vidéo'}</Text>
      </TouchableOpacity>
      <TextInput value={title} onChangeText={setTitle} placeholder="Titre" placeholderTextColor={colors.textMuted} style={s.i} />
      <TextInput value={desc} onChangeText={setDesc} placeholder="Description" placeholderTextColor={colors.textMuted} multiline style={[s.i, { height: 100 }]} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button title="Publier" onPress={upload} disabled={busy || !uri || !title.trim()} loading={busy} fullWidth size="lg" />
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, padding: spacing[4], gap: spacing[3], backgroundColor: colors.dark },
  pick: { height: 160, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  pickText: { color: colors.gray2, fontFamily: fonts.body },
  i: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], color: colors.textPrimary, fontFamily: fonts.body, backgroundColor: colors.dark3 },
  error: { color: colors.red, fontFamily: fonts.body },
});
