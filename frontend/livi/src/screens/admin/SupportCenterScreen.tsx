import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Screen,
  SectionHeader,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function SupportCenterScreen({ navigation }: any) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>LIVI ADMIN</Text>
          <Text style={styles.title}>Centre de support</Text>
          <Text style={styles.subtitle}>
            Accédez aux outils disponibles pour assister les utilisateurs sans
            créer de faux tickets ou de données non prises en charge.
          </Text>
        </View>

        <Card style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>?</Text>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Support mobile</Text>
            <Text style={styles.heroText}>
              Le module mobile reste aligné sur les services réellement exposés
              par l’application.
            </Text>
          </View>
        </Card>

        <View style={styles.section}>
          <SectionHeader
            title="Fonctionnement"
            subtitle="Ce qui est actuellement accessible depuis cet espace."
          />

          <Card style={styles.listCard}>
            <View style={styles.listRow}>
              <View style={styles.number}>
                <Text style={styles.numberText}>01</Text>
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Consulter les demandes disponibles</Text>
                <Text style={styles.rowText}>
                  Utilisez les écrans administratifs correspondant aux ressources
                  déjà exposées par le backend.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.listRow}>
              <View style={styles.number}>
                <Text style={styles.numberText}>02</Text>
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Accéder aux conversations</Text>
                <Text style={styles.rowText}>
                  Le support peut s’appuyer sur les modules de conversations
                  lorsqu’ils sont réellement disponibles dans le parcours.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.listRow}>
              <View style={styles.number}>
                <Text style={styles.numberText}>03</Text>
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Rester fidèle au contrat</Text>
                <Text style={styles.rowText}>
                  Aucun ticket, statut ou workflow supplémentaire n’est simulé
                  par cet écran.
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Accès rapide" />

          <Pressable
            onPress={() => navigation.navigate('AdminUsers')}
            style={({ pressed }) => [
              styles.accessPressable,
              pressed ? styles.pressed : null,
            ]}
          >
            <Card style={styles.accessCard}>
              <View style={styles.accessIcon}>
                <Text style={styles.accessIconText}>U</Text>
              </View>

              <View style={styles.accessCopy}>
                <Text style={styles.accessTitle}>Utilisateurs</Text>
                <Text style={styles.accessText}>
                  Ouvrir la ressource administrateur des utilisateurs.
                </Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Card>
          </Pressable>
        </View>

        <Card style={styles.noteCard}>
          <Text style={styles.noteTitle}>Périmètre actuel</Text>
          <Text style={styles.noteText}>
            Aucun endpoint support dédié n’est appelé ici. L’écran sert de
            point d’entrée mobile vers les modules administratifs déjà
            disponibles.
          </Text>
        </Card>

        <Text style={styles.footer}>
          Centre de support · Livi Administration
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[6],
  },
  header: {
    gap: spacing[2],
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
    maxWidth: 370,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.26)',
    backgroundColor: 'rgba(201, 151, 28, 0.06)',
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.13)',
  },
  heroIconText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 26,
  },
  heroCopy: {
    flex: 1,
    gap: spacing[1],
  },
  heroTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  heroText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  section: {
    gap: spacing[3],
  },
  listCard: {
    padding: spacing[4],
    gap: spacing[3],
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  number: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  numberText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: fontSize.xs,
  },
  rowCopy: {
    flex: 1,
    gap: spacing[1],
  },
  rowTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  rowText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  accessPressable: {
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.993 }],
  },
  accessCard: {
    minHeight: 82,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  accessIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  accessIconText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: fontSize.md,
  },
  accessCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  accessTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  accessText: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  chevron: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 24,
    lineHeight: 22,
  },
  noteCard: {
    padding: spacing[4],
    gap: spacing[1],
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  noteTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  noteText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  footer: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
