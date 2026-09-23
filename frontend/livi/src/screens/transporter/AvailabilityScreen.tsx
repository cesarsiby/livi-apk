import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { transporterApi } from '../../features/transporter/transporterApi';
import {
  Card,
  Screen,
  Skeleton,
  StatusBadge,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

const OPTIONS = [
  {
    value: 'online' as const,
    label: 'Disponible',
    description: 'Recevoir des propositions de mission.',
  },
  {
    value: 'busy' as const,
    label: 'En mission',
    description: 'Indiquez que vous êtes déjà engagé sur une livraison.',
  },
  {
    value: 'offline' as const,
    label: 'Indisponible',
    description: 'Ne pas recevoir de nouvelle proposition.',
  },
];

function normalizeStatus(value: unknown): 'online' | 'offline' | 'busy' | '' {
  const raw = String(value ?? '').trim().toLowerCase();

  if (raw === 'online' || raw === 'offline' || raw === 'busy') {
    return raw;
  }

  return '';
}

export function AvailabilityScreen() {
  const [current, setCurrent] = useState<'online' | 'offline' | 'busy' | ''>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      const data = await transporterApi.dashboard();
      const status = normalizeStatus(
        data?.availability?.status ??
          data?.availability ??
          data?.status,
      );
      setCurrent(status);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger votre disponibilité.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentOption = useMemo(
    () => OPTIONS.find((option) => option.value === current),
    [current],
  );

  const change = useCallback(
    async (value: 'online' | 'offline' | 'busy') => {
      if (busy || current === value) return;

      setBusy(true);
      setError('');

      try {
        const result = await transporterApi.setAvailability(value);
        const next = normalizeStatus(
          result?.availability?.status ??
            result?.availability ??
            result?.status,
        );

        setCurrent(next || value);
      } catch (e: any) {
        setError(
          e?.message ?? 'La modification de disponibilité a été refusée.',
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, current],
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={145} height={14} radius={radius.pill} />
        <Skeleton width={250} height={34} radius={radius.md} />
        <Skeleton width="92%" height={42} radius={radius.md} />
        <Skeleton width="100%" height={96} radius={radius.lg} />
        <Skeleton width="100%" height={96} radius={radius.lg} />
        <Skeleton width="100%" height={96} radius={radius.lg} />
      </View>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ESPACE TRANSPORTEUR</Text>
          <Text style={styles.title}>Disponibilité</Text>
          <Text style={styles.subtitle}>
            Choisissez l’état qui sera enregistré sur votre profil transporteur.
          </Text>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <View style={styles.errorDot} />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Card style={styles.currentCard}>
          <View style={styles.currentCopy}>
            <Text style={styles.currentLabel}>État actuel</Text>

            {current ? (
              <>
                <Text style={styles.currentTitle}>
                  {currentOption?.label ?? current}
                </Text>
                <Text style={styles.currentText}>
                  {currentOption?.description ?? 'Statut enregistré côté serveur.'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.currentTitle}>Statut non retourné</Text>
                <Text style={styles.currentText}>
                  L’état actuel n’a pas pu être interprété à partir de la réponse.
                </Text>
              </>
            )}
          </View>

          <View style={styles.statusWrap}>
            <StatusBadge
              domain="transporterAvailability"
              status={current || undefined}
            />
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choisir un état</Text>
          <Text style={styles.sectionSubtitle}>
            La modification est enregistrée directement par LIVI.
          </Text>

          <View style={styles.options}>
            {OPTIONS.map((option) => {
              const active = current === option.value;

              return (
                <Pressable
                  key={option.value}
                  disabled={busy}
                  onPress={() => change(option.value)}
                  style={({ pressed }) => [
                    styles.optionPressable,
                    pressed && !busy ? styles.optionPressed : null,
                  ]}
                >
                  <Card
                    style={[
                      styles.option,
                      active ? styles.optionActive : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.optionIcon,
                        active ? styles.optionIconActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionIconText,
                          active ? styles.optionIconTextActive : null,
                        ]}
                      >
                        {active ? '✓' : '•'}
                      </Text>
                    </View>

                    <View style={styles.optionCopy}>
                      <View style={styles.optionHeading}>
                        <Text style={styles.optionTitle}>
                          {option.label}
                        </Text>

                        {active ? (
                          <Text style={styles.selected}>ACTIF</Text>
                        ) : null}
                      </View>

                      <Text style={styles.optionText}>
                        {option.description}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card style={styles.noteCard}>
          <View style={styles.noteIcon}>
            <Text style={styles.noteIconText}>i</Text>
          </View>
          <View style={styles.noteCopy}>
            <Text style={styles.noteTitle}>À retenir</Text>
            <Text style={styles.noteText}>
              L’application n’imite pas un statut local : l’état affiché est
              celui retourné par le backend après votre dernière modification.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: spacing[5],
    gap: spacing[4],
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[5],
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
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(255,94,94,0.25)',
    backgroundColor: 'rgba(255,94,94,0.07)',
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: colors.red,
  },
  errorText: {
    flex: 1,
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  currentCard: {
    minHeight: 120,
    padding: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(201,151,28,0.27)',
    backgroundColor: 'rgba(201,151,28,0.065)',
  },
  currentCopy: {
    flex: 1,
    gap: spacing[1],
  },
  currentLabel: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
  },
  currentText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  statusWrap: {
    alignItems: 'flex-end',
  },
  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  sectionSubtitle: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  options: {
    marginTop: spacing[2],
    gap: spacing[3],
  },
  optionPressable: {
    borderRadius: radius.lg,
  },
  optionPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.995 }],
  },
  option: {
    minHeight: 88,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  optionActive: {
    borderWidth: 1,
    borderColor: 'rgba(201,151,28,0.42)',
    backgroundColor: 'rgba(201,151,28,0.09)',
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIconActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  optionIconText: {
    color: colors.gray3,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
  },
  optionIconTextActive: {
    color: colors.dark,
  },
  optionCopy: {
    flex: 1,
    gap: spacing[1],
  },
  optionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  optionTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  selected: {
    color: colors.gold2,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  optionText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  noteCard: {
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  noteIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  noteIconText: {
    color: colors.gold2,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.sm,
  },
  noteCopy: {
    flex: 1,
    gap: spacing[1],
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
});
