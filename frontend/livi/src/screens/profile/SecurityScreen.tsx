import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { profileApi } from '../../features/profile/profileApi';
import type { SecuritySession } from '../../features/profile/types';
import { useAuth } from '../../features/auth/AuthProvider';
import { Button, Card, EmptyState, Skeleton } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function SecurityScreen({ navigation }: any) {
  const { signOut } = useAuth();
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const load = async () => {
    setLoading(true); setMessage('');
    try { setSessions(await profileApi.listSessions()); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Impossible de charger les sessions.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const revoke = async (id: string) => {
    setMessage('');
    try { await profileApi.revokeSession(id); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Impossible de révoquer la session.'); }
  };
  const changePassword = async () => {
    setChanging(true); setMessage('');
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setMessage('Mot de passe modifié par le serveur.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Échec du changement de mot de passe.'); }
    finally { setChanging(false); }
  };

  // V54: POST /auth/sessions/logout-all already existed on the backend
  // (src/routes/authSessions.js) with no caller anywhere in the app. It
  // revokes every session for the account, including this one, so a
  // successful call is followed by the normal local sign-out rather than a
  // refresh of the session list (which would just 401).
  const logoutAll = () => {
    Alert.alert(
      'Déconnecter tous les appareils',
      'Cela mettra fin à toutes vos sessions, y compris celle-ci. Vous devrez vous reconnecter.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter tout', style: 'destructive', onPress: async () => {
            setLoggingOutAll(true); setMessage('');
            try { await profileApi.logoutAll(); await signOut(); }
            catch (e) { setMessage(e instanceof Error ? e.message : 'Échec de la déconnexion globale.'); setLoggingOutAll(false); }
          },
        },
      ],
    );
  };

  return (
    <FlatList
      style={styles.screen}
      data={sessions}
      keyExtractor={(x) => x.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={{ gap: spacing[3] }}>
          <Text style={styles.title}>Sécurité</Text>
          <Text style={styles.section}>Changer le mot de passe</Text>
          <TextInput secureTextEntry style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Mot de passe actuel" placeholderTextColor={colors.textMuted} />
          <TextInput secureTextEntry style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="Nouveau mot de passe" placeholderTextColor={colors.textMuted} />
          <Button title={changing ? 'Modification…' : 'Modifier'} onPress={() => void changePassword()} disabled={changing || !currentPassword || !newPassword} fullWidth />
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Text style={styles.section}>Sessions et appareils</Text>
          {loading ? <Skeleton height={70} radius={radius.lg} /> : null}
        </View>
      }
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Text style={styles.device}>{item.device_name ?? 'Appareil'}</Text>
          <Text style={styles.meta}>{item.current ? 'Session actuelle' : 'Autre session'}</Text>
          {item.last_used_at ? <Text style={styles.muted}>Dernière activité : {new Date(item.last_used_at).toLocaleString('fr-FR')}</Text> : null}
          {!item.current && <Button title="Révoquer" onPress={() => void revoke(item.id)} variant="outline" size="sm" />}
        </Card>
      )}
      ListEmptyComponent={!loading ? <EmptyState icon="📱" title="Aucune autre session" description="Les appareils connectés à votre compte apparaîtront ici." /> : null}
      ListFooterComponent={
        sessions.length > 0 ? (
          <Button
            title={loggingOutAll ? 'Déconnexion…' : 'Déconnecter tous les appareils'}
            onPress={logoutAll}
            disabled={loggingOutAll}
            loading={loggingOutAll}
            variant="red"
            fullWidth
            style={{ marginTop: spacing[3] }}
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[3] },
  title: { fontSize: fontSize['3xl'], fontFamily: fonts.brand, color: colors.textPrimary },
  section: { fontSize: fontSize.lg, fontFamily: fonts.brandSemibold, color: colors.textPrimary, marginVertical: spacing[2] },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    backgroundColor: colors.dark3,
    color: colors.textPrimary,
    fontFamily: fonts.body,
  },
  message: { color: colors.gold2, fontFamily: fonts.body },
  card: { padding: spacing[3], gap: spacing[2], marginBottom: spacing[2] },
  device: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  muted: { color: colors.textMuted, fontFamily: fonts.body },
});
