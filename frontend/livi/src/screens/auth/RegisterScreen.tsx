import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthProvider';
import type { UserRole } from '../../types/auth';
import { Button, Screen, TextField } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

const ROLES: { key: Exclude<UserRole, 'admin'>; label: string; icon: string }[] = [
  { key: 'client', label: 'Acheteur', icon: '🛒' },
  { key: 'vendor', label: 'Vendeur', icon: '🏪' },
  { key: 'transporter', label: 'Transporteur', icon: '🚚' },
];

export function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('client');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();

  // V-AUDIT (OTP/SMS removal from account opening — decision définitive):
  // this used to create the account with no password, send an OTP, and
  // navigate to VerifyOtpScreen to actually open the session. Registration
  // now collects a password + confirmation and opens the session directly
  // in one call — see AuthProvider.register(), which stores the session
  // this returns instead of discarding it. RootNavigator swaps away from
  // the auth stack on its own once that session is set; there is nothing
  // to navigate to here.
  async function submit() {
    if (!firstName.trim() || !lastName.trim() || !/^\+?[0-9\s]{8,18}$/.test(phone.trim()) || !accepted) {
      Alert.alert('Informations incomplètes', 'Remplissez les champs requis et acceptez les conditions.');
      return;
    }
    if (password.length < 10) {
      setPasswordError('10 caractères minimum.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Les deux mots de passe doivent être identiques.');
      return;
    }
    setPasswordError(undefined);

    try {
      setLoading(true);
      await register({
        role,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        password,
        password_confirmation: confirmPassword,
      });
    } catch (e: any) {
      Alert.alert('Inscription', e?.message ?? 'Impossible de créer le compte.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Gratuit · 2 minutes</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Je suis…</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setRole(r.key)}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                >
                  <Text style={styles.roleIcon}>{r.icon}</Text>
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextField label="Prénom" required value={firstName} onChangeText={setFirstName} placeholder="Aminata" />
          <TextField label="Nom" required value={lastName} onChangeText={setLastName} placeholder="Traoré" />
          <TextField
            label="Numéro de téléphone"
            required
            icon="📱"
            value={phone}
            onChangeText={setPhone}
            placeholder="+223 XX XX XX XX"
            keyboardType="phone-pad"
          />
          <TextField
            label="Mot de passe"
            required
            icon="🔒"
            secureTextEntry
            value={password}
            onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(undefined); }}
            placeholder="10 caractères minimum"
          />
          <TextField
            label="Confirmer le mot de passe"
            required
            icon="🔒"
            secureTextEntry
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); if (passwordError) setPasswordError(undefined); }}
            placeholder="10 caractères minimum"
            error={passwordError}
          />

          <Pressable style={styles.checkboxRow} onPress={() => setAccepted((v) => !v)}>
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              {accepted ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxLabel}>J'accepte les conditions d'utilisation</Text>
          </Pressable>

          <Button
            title={loading ? 'Création…' : 'Créer mon compte'}
            onPress={() => void submit()}
            disabled={loading}
            loading={loading}
            size="lg"
            fullWidth
          />
          <Button
            title="Déjà un compte ? Se connecter"
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
            variant="ghost"
            size="md"
            fullWidth
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: spacing[6],
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.gray,
  },
  card: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing[6],
    gap: spacing[4],
  },
  sectionLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark4,
    gap: 4,
  },
  roleChipActive: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldDim,
  },
  roleIcon: {
    fontSize: fontSize.lg,
  },
  roleLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.gray2,
  },
  roleLabelActive: {
    color: colors.gold,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  checkboxMark: {
    color: colors.dark,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.gray2,
  },
});
