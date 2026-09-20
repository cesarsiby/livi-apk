import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Card } from '../../design/components';
import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

export function DepositScreen({ navigation }: any) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>WALLET LIVI</Text>
        <Text style={styles.title}>Ajouter des fonds</Text>
        <Text style={styles.subtitle}>
          Dépôt Mobile Money
        </Text>
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>＋</Text>
        </View>

        <Text style={styles.heroTitle}>
          Fonction de dépôt non disponible
        </Text>

        <Text style={styles.heroText}>
          Le backend mobile actuel n’expose pas de contrat de dépôt
          permettant d’initier une opération réelle depuis cette application.
        </Text>

        <View style={styles.warningBox}>
          <View style={styles.warningDot} />
          <Text style={styles.warningText}>
            Aucun montant ne sera débité et aucun solde ne sera modifié
            depuis cet écran.
          </Text>
        </View>
      </Card>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Pourquoi cet écran reste bloqué ?</Text>

        <Text style={styles.infoText}>
          L’application ne simule volontairement aucune transaction
          financière. Tant qu’un endpoint de dépôt réel n’est pas exposé,
          LIVI préfère afficher un état explicite plutôt que de créer une
          fausse confirmation.
        </Text>
      </View>

      <Button
        title="Retour au Wallet"
        onPress={() => navigation.goBack()}
        fullWidth
        size="lg"
      />

      <Pressable
        onPress={() => navigation.navigate('Transactions')}
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>Consulter les transactions</Text>
      </Pressable>
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
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
    gap: spacing[4],
  },

  header: {
    gap: spacing[1],
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.6,
    color: colors.gold,
  },

  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
    color: colors.textPrimary,
  },

  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  heroCard: {
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing[3],
  },

  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },

  icon: {
    fontFamily: fonts.bodyBold,
    fontSize: 30,
    color: colors.dark,
  },

  heroTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  heroText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  warningBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginTop: spacing[2],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  warningDot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },

  warningText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  infoCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[2],
  },

  infoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  infoText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  linkButton: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },

  linkText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
});
