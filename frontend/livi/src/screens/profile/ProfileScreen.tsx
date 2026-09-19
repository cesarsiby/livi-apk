import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { profileApi } from '../../features/profile/profileApi';
import { useAuth } from '../../features/auth/AuthProvider';

import {
  Button,
  Skeleton,
  TextField,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

type MenuItem = {
  symbol: string;
  title: string;
  subtitle: string;
  target: string;
};

const ROLE_LINKS: Record<string, MenuItem[]> = {
  client: [
    {
      symbol: '⌂',
      title: 'Adresses',
      subtitle: 'Gérer vos lieux de livraison',
      target: 'Addresses',
    },
    {
      symbol: '♡',
      title: 'Favoris',
      subtitle: 'Vos produits enregistrés',
      target: 'Wishlist',
    },
    {
      symbol: '↩',
      title: 'Remboursements',
      subtitle: 'Suivre les remboursements',
      target: 'Refunds',
    },
    {
      symbol: '▣',
      title: 'Moyens de paiement',
      subtitle: 'Gérer vos moyens enregistrés',
      target: 'PaymentMethods',
    },
  ],

  vendor: [
    {
      symbol: '⌂',
      title: 'Boutique',
      subtitle: 'Gérer votre espace vendeur',
      target: 'Onboarding',
    },
    {
      symbol: 'ID',
      title: 'Vérification KYC',
      subtitle: 'État de votre vérification',
      target: 'KYC',
    },
    {
      symbol: '↗',
      title: 'Versements',
      subtitle: 'Suivre vos versements',
      target: 'Payouts',
    },
  ],

  transporter: [
    {
      symbol: '▱',
      title: 'Mon véhicule',
      subtitle: 'Informations de votre véhicule',
      target: 'Vehicle',
    },
    {
      symbol: 'ID',
      title: 'Vérification KYC',
      subtitle: 'État de votre vérification',
      target: 'KYC',
    },
    {
      symbol: '↗',
      title: 'Mes revenus',
      subtitle: 'Consulter vos revenus',
      target: 'Earnings',
    },
  ],

  admin: [
    {
      symbol: '⌂',
      title: 'Tableau de bord',
      subtitle: 'Accéder à l’administration',
      target: 'AdminDashboard',
    },
  ],
};

const ACCOUNT_LINKS: MenuItem[] = [
  {
    symbol: '◈',
    title: 'Sécurité',
    subtitle: 'Mot de passe et sessions',
    target: 'Security',
  },
  {
    symbol: '◌',
    title: 'Notifications',
    subtitle: 'Préférences et alertes',
    target: 'Notifications',
  },
];

function roleLabel(role?: string) {
  switch (role) {
    case 'client':
      return 'Compte acheteur';

    case 'vendor':
      return 'Compte vendeur';

    case 'transporter':
      return 'Compte transporteur';

    case 'admin':
      return 'Compte administrateur';

    default:
      return 'Compte Livi';
  }
}

function initials(name?: string, email?: string) {
  const source = (name || email || 'L').trim();

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function MenuRow({
  item,
  onPress,
  last,
}: {
  item: MenuItem;
  onPress: () => void;
  last?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handleIn = () => {
    Animated.spring(scale, {
      toValue: 0.985,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const handleOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        style={[
          styles.menuRow,
          !last && styles.menuRowBorder,
        ]}
      >
        <View style={styles.menuIcon}>
          <Text style={styles.menuIconText}>
            {item.symbol}
          </Text>
        </View>

        <View style={styles.menuContent}>
          <Text style={styles.menuTitle}>
            {item.title}
          </Text>

          <Text style={styles.menuSubtitle}>
            {item.subtitle}
          </Text>
        </View>

        <Text style={styles.menuArrow}>
          ›
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function ProfileScreen({ navigation }: any) {
  const { user, signOut } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const entrance = useRef(
    new Animated.Value(0),
  ).current;

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const data = await profileApi.getProfile();

      setName(data.name ?? '');
      setEmail(data.email ?? '');
      setPhone(data.phone ?? '');
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'Impossible de charger le profil.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [load, entrance]);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage('');

    try {
      const updated = await profileApi.updateProfile({
        name,
        email,
        phone,
      });

      setName(updated.name ?? name);
      setEmail(updated.email ?? email);
      setPhone(updated.phone ?? phone);

      setMessage('Profil mis à jour.');
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'Échec de la mise à jour.',
      );
    } finally {
      setSaving(false);
    }
  }, [email, name, phone]);

  const roleLinks = useMemo(
    () => ROLE_LINKS[user?.role ?? ''] ?? [],
    [user?.role],
  );

  const displayName =
    name.trim() ||
    user?.name?.trim() ||
    'Votre compte';

  const displayEmail =
    email.trim() ||
    user?.email?.trim() ||
    '';

  const displayPhone =
    phone.trim() ||
    user?.phone?.trim() ||
    '';

  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  if (loading) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.loadingContainer}
      >
        <Skeleton
          height={150}
          radius={radius['2xl']}
        />

        <Skeleton
          height={210}
          radius={radius.xl}
        />

        <Skeleton
          height={190}
          radius={radius.xl}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={{
          opacity: entrance,
          transform: [{ translateY }],
        }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              MON ESPACE
            </Text>

            <Text style={styles.title}>
              Profil
            </Text>
          </View>
        </View>

        <View style={styles.identityCard}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityAvatarText}>
              {initials(
                displayName,
                displayEmail,
              )}
            </Text>
          </View>

          <View style={styles.identityInfo}>
            <Text
              numberOfLines={1}
              style={styles.identityName}
            >
              {displayName}
            </Text>

            <Text
              numberOfLines={1}
              style={styles.identityEmail}
            >
              {displayEmail ||
                'Adresse e-mail non renseignée'}
            </Text>

            {displayPhone ? (
              <Text
                numberOfLines={1}
                style={styles.identityPhone}
              >
                {displayPhone}
              </Text>
            ) : null}

            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {roleLabel(user?.role)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Informations personnelles
            </Text>

            <Text style={styles.sectionSubtitle}>
              Vos données de compte
            </Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="Nom"
              value={name}
              onChangeText={setName}
              placeholder="Votre nom"
            />

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Votre email"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextField
              label="Téléphone"
              value={phone}
              onChangeText={setPhone}
              placeholder="Votre téléphone"
              keyboardType="phone-pad"
            />

            {message ? (
              <View
                style={[
                  styles.messageBox,
                  message === 'Profil mis à jour.' &&
                    styles.messageSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message ===
                      'Profil mis à jour.' &&
                      styles.messageTextSuccess,
                  ]}
                >
                  {message}
                </Text>
              </View>
            ) : null}

            <Button
              title={
                saving
                  ? 'Enregistrement…'
                  : 'Enregistrer les modifications'
              }
              onPress={() => void save()}
              disabled={saving}
              loading={saving}
              fullWidth
            />
          </View>
        </View>

        {roleLinks.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Mes services
              </Text>

              <Text style={styles.sectionSubtitle}>
                Accès rapides
              </Text>
            </View>

            <View style={styles.menuCard}>
              {roleLinks.map((item, index) => (
                <MenuRow
                  key={item.target}
                  item={item}
                  last={
                    index ===
                    roleLinks.length - 1
                  }
                  onPress={() =>
                    navigation.navigate(
                      item.target,
                    )
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Compte
            </Text>

            <Text style={styles.sectionSubtitle}>
              Préférences et protection
            </Text>
          </View>

          <View style={styles.menuCard}>
            {ACCOUNT_LINKS.map((item, index) => (
              <MenuRow
                key={item.target}
                item={item}
                last={
                  index ===
                  ACCOUNT_LINKS.length - 1
                }
                onPress={() =>
                  navigation.navigate(
                    item.target,
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.securityNote}>
          <View style={styles.securityIcon}>
            <Text style={styles.securityIconText}>
              ✓
            </Text>
          </View>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>
              Votre compte est protégé
            </Text>

            <Text style={styles.securityText}>
              Gérez vos sessions et votre mot de
              passe depuis la section Sécurité.
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.signOutButton}
          onPress={() => void signOut()}
        >
          <Text style={styles.signOutText}>
            Se déconnecter
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          Livi · Relier l'Afrique, un colis à la fois
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  loadingContainer: {
    padding: spacing[5],
    gap: spacing[4],
    backgroundColor: colors.dark,
  },

  header: {
    marginBottom: spacing[4],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
    marginBottom: 2,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    color: colors.textPrimary,
  },

  identityCard: {
    minHeight: 148,
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },

  identityAvatar: {
    width: 76,
    height: 76,
    borderRadius: radius['2xl'],
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  identityAvatarText: {
    fontFamily: fonts.brand,
    fontSize: fontSize['2xl'],
    color: colors.dark,
  },

  identityInfo: {
    flex: 1,
  },

  identityName: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  identityEmail: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  identityPhone: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  roleBadgeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.gold,
  },

  section: {
    marginTop: spacing[6],
  },

  sectionHeader: {
    marginBottom: spacing[3],
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  form: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },

  messageBox: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  messageSuccess: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  messageText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  messageTextSuccess: {
    color: colors.gold2,
  },

  menuCard: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  menuRow: {
    minHeight: 78,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  menuContent: {
    flex: 1,
  },

  menuTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  menuSubtitle: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  menuArrow: {
    fontFamily: fonts.body,
    fontSize: fontSize['2xl'],
    color: colors.textMuted,
  },

  securityNote: {
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing[3],
  },

  securityIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  securityIconText: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },

  securityContent: {
    flex: 1,
  },

  securityTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  securityText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  signOutButton: {
    marginTop: spacing[6],
    minHeight: 50,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.redBorder,
    backgroundColor: colors.redDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  signOutText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.red,
  },

  footer: {
    marginTop: spacing[5],
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
