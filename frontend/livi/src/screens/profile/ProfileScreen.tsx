import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { profileApi } from '../../features/profile/profileApi';
import { useAuth } from '../../features/auth/AuthProvider';
import { ActionRow, Button, Card, SectionHeader, Skeleton, TextField } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

// V54 (conservé) : seul écran fiable de tous les rôles pour Sécurité/
// Notifications/KYC/etc. LIVI 2.0 (RAPPORT_UXUI_SESSION21) : "Wallet"
// retiré des raccourcis ci-dessous pour les 3 rôles — c'est désormais un
// onglet à part entière dans chaque navigateur (Buyer/Seller/Transporter),
// le lister encore ici dupliquerait un accès déjà à un tap de distance
// (règle §44 : une fonctionnalité ne doit pas être accessible de cinq
// façons différentes sans raison).
const ROLE_LINKS: Record<string, [string, string, string][]> = {
  client: [
    ['📍', 'Adresses', 'Addresses'],
    ['❤️', 'Favoris', 'Wishlist'],
    ['↩️', 'Remboursements', 'Refunds'],
    ['💳', 'Moyens de paiement', 'PaymentMethods'],
  ],
  vendor: [
    ['🏪', 'Boutique', 'Onboarding'],
    ['🪪', 'Vérification KYC', 'KYC'],
    ['💰', 'Versements', 'Payouts'],
  ],
  transporter: [
    ['🚗', 'Mon véhicule', 'Vehicle'],
    ['🪪', 'Vérification KYC', 'KYC'],
    ['💵', 'Mes revenus', 'Earnings'],
  ],
  admin: [['🏠', 'Tableau de bord', 'AdminDashboard']],
};

export function ProfileScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true); setMessage('');
    try {
      const data = await profileApi.getProfile();
      setName(data.name ?? ''); setEmail(data.email ?? ''); setPhone(data.phone ?? '');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Impossible de charger le profil.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true); setMessage('');
    try { await profileApi.updateProfile({ name, email, phone }); setMessage('Profil mis à jour.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Échec de la mise à jour.'); }
    finally { setSaving(false); }
  };

  const roleLinks = ROLE_LINKS[user?.role ?? ''] ?? [];
  const canNavigate = typeof navigation?.navigate === 'function';
  const accountLinks: [string, string, string][] = [['🔒', 'Sécurité', 'Security'], ['🔔', 'Notifications', 'Notifications']];

  if (loading) {
    return (
      <View style={styles.loadingList}>
        <Skeleton height={40} radius={10} />
        <Skeleton height={40} radius={10} />
        <Skeleton height={40} radius={10} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View>
        <Text style={styles.title}>Mon profil</Text>
        <Text style={styles.meta}>{roleLabel(user?.role)}</Text>
      </View>

      <View style={{ gap: spacing[3] }}>
        <TextField label="Nom" value={name} onChangeText={setName} placeholder="Nom" />
        <TextField label="Email" value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
        <TextField label="Téléphone" value={phone} onChangeText={setPhone} placeholder="Téléphone" keyboardType="phone-pad" />
        {!!message && <Text style={styles.message}>{message}</Text>}
        <Button title={saving ? 'Enregistrement…' : 'Enregistrer'} onPress={save} disabled={saving} loading={saving} fullWidth />
      </View>

      {canNavigate && roleLinks.length > 0 ? (
        <View>
          <SectionHeader title="Mes services" />
          <Card style={styles.groupCard} padded={false}>
            {roleLinks.map(([icon, label, target], idx) => (
              <View key={target}>
                <ActionRow icon={icon} title={label} onPress={() => navigation.navigate(target)} />
                {idx < roleLinks.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {canNavigate ? (
        <View>
          <SectionHeader title="Compte" />
          <Card style={styles.groupCard} padded={false}>
            {accountLinks.map(([icon, label, target], idx) => (
              <View key={target}>
                <ActionRow icon={icon} title={label} onPress={() => navigation.navigate(target)} />
                {idx < accountLinks.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <Button title="Se déconnecter" onPress={() => void signOut()} variant="red" fullWidth />
    </ScrollView>
  );
}

function roleLabel(role?: string): string {
  switch (role) {
    case 'client': return 'Compte acheteur';
    case 'vendor': return 'Compte vendeur';
    case 'transporter': return 'Compte transporteur';
    case 'admin': return 'Compte administrateur';
    default: return '—';
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  container: { padding: spacing[5], gap: spacing[6], paddingBottom: spacing[12] },
  loadingList: { flex: 1, backgroundColor: colors.dark, padding: spacing[5], gap: spacing[3], justifyContent: 'center' },
  title: { fontFamily: fonts.brand, fontSize: fontSize['3xl'], color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  message: { fontFamily: fonts.body, color: colors.gold2 },
  groupCard: { paddingHorizontal: spacing[4] },
  divider: { height: 1, backgroundColor: colors.border },
});
