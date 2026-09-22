import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import { sellerOnboardingApi, type Shop } from '../../features/seller/sellerOnboardingApi';
import { getCurrentLocation } from '../../services/device/location';
import {
  Button,
  Card,
  Skeleton,
} from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

const STEP_IDS = ['identity', 'name', 'category', 'slogan', 'contact', 'review'] as const;

type StepId = (typeof STEP_IDS)[number];

const STEP_LABELS: Record<StepId, string> = {
  identity: 'Accueil',
  name: 'Boutique',
  category: 'Activité',
  slogan: 'Présentation',
  contact: 'Coordonnées',
  review: 'Confirmation',
};

function StepIndicator({
  currentStep,
}: {
  currentStep: number;
}) {
  return (
    <View style={styles.stepper}>
      {STEP_IDS.map((id, index) => {
        const active = index + 1 === currentStep;
        const complete = index + 1 < currentStep;

        return (
          <React.Fragment key={id}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  active ? styles.stepCircleActive : null,
                  complete ? styles.stepCircleComplete : null,
                ]}
              >
                <Text
                  style={[
                    styles.stepCircleText,
                    active || complete ? styles.stepCircleTextActive : null,
                  ]}
                >
                  {complete ? '✓' : index + 1}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.stepLabel,
                  active ? styles.stepLabelActive : null,
                ]}
              >
                {STEP_LABELS[id]}
              </Text>
            </View>

            {index < STEP_IDS.length - 1 ? (
              <View
                style={[
                  styles.stepConnector,
                  complete ? styles.stepConnectorComplete : null,
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function SellerOnboardingScreen({ navigation }: any) {
  const [step, setStep] = useState(1);

  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [commissionPassthrough, setCommissionPassthrough] = useState(false);
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [loadingExisting, setLoadingExisting] = useState(true);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [existingShop, setExistingShop] = useState<Shop | null>(null);

  useEffect(() => {
    let mounted = true;

    sellerOnboardingApi
      .getShop()
      .then((shop) => {
        if (!mounted || !shop) return;

        setExistingShop(shop);
        setName(shop.shop_name ?? '');
        setSlogan(shop.slogan ?? '');
        setCategory(shop.category ?? '');
        setPhone(shop.phone ?? '');
        setCity(shop.city ?? '');
        setAddress(shop.address ?? '');
        setCommissionPassthrough(!!shop.commission_passthrough);

        if (shop.latitude != null && shop.longitude != null) {
          setCoords({
            latitude: Number(shop.latitude),
            longitude: Number(shop.longitude),
          });
        }

        if (shop.category && shop.phone && shop.city) {
          setStep(2);
        }
      })
      .catch(() => {
        // No existing shop data: keep the first-time flow.
      })
      .finally(() => {
        if (mounted) setLoadingExisting(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isEditing = !!existingShop && !!(existingShop.category && existingShop.phone && existingShop.city);

  const title = useMemo(() => {
    if (saved) return isEditing ? 'Boutique mise à jour' : 'Boutique créée';

    const titles: Record<number, string> = {
      1: isEditing ? 'Ma boutique' : 'Bienvenue sur LIVI',
      2: 'Le nom de votre boutique',
      3: 'Votre activité principale',
      4: 'Présentez votre boutique',
      5: 'Vos coordonnées',
      6: 'Vérifiez vos informations',
    };

    return titles[step] ?? titles[1];
  }, [isEditing, saved, step]);

  const subtitle = useMemo(() => {
    if (saved) {
      return isEditing
        ? 'Les informations de votre boutique ont été enregistrées.'
        : 'Votre boutique est configurée. Vous pouvez maintenant gérer vos produits.';
    }

    const subtitles: Record<number, string> = {
      1: isEditing
        ? 'Modifiez les informations utiles à votre activité de vendeur.'
        : 'Quelques informations suffisent pour commencer à configurer votre présence vendeur.',
      2: 'Choisissez un nom clair que vos acheteurs reconnaîtront facilement.',
      3: 'Indiquez la catégorie qui décrit le mieux votre activité.',
      4: 'Une présentation courte aide les acheteurs à comprendre votre boutique.',
      5: 'Ces informations servent notamment au calcul des frais de livraison.',
      6: 'Relisez les informations avant de les enregistrer.',
    };

    return subtitles[step] ?? '';
  }, [isEditing, saved, step]);

  const next = () => {
    setError('');

    if (step === 2 && !name.trim()) {
      setError('Le nom de la boutique est obligatoire.');
      return;
    }

    if (step === 3 && !category.trim()) {
      setError('La catégorie est obligatoire.');
      return;
    }

    if (step === 5 && (!phone.trim() || !city.trim())) {
      setError('Le téléphone et la ville sont obligatoires.');
      return;
    }

    setStep((current) => Math.min(6, current + 1));
  };

  const submit = async () => {
    setBusy(true);
    setError('');

    try {
      await sellerOnboardingApi.submit({
        shop_name: name.trim(),
        slogan: slogan.trim(),
        category: category.trim(),
        phone: phone.trim(),
        city: city.trim(),
        address: address.trim(),
        commission_passthrough: commissionPassthrough,
        ...(coords ?? {}),
      });

      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible d’enregistrer votre boutique.');
    } finally {
      setBusy(false);
    }
  };

  const requestLocation = async () => {
    setLocating(true);
    setError('');

    try {
      const permission = await Location.getForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();

        if (requested.status !== 'granted') {
          setError('L’accès à la position a été refusé.');
          return;
        }
      }

      const location = await getCurrentLocation();

      setCoords({
        latitude: location.latitude,
        longitude: location.longitude,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de récupérer votre position.');
    } finally {
      setLocating(false);
    }
  };

  if (loadingExisting) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={130} height={14} radius={radius.pill} />
        <Skeleton width={260} height={34} radius={radius.md} />
        <Skeleton width="92%" height={42} radius={radius.md} />
        <Skeleton width="100%" height={126} radius={radius.lg} />
        <Skeleton width="100%" height={52} radius={radius.md} />
        <Skeleton width="100%" height={52} radius={radius.md} />
      </View>
    );
  }

  if (saved) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.successContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>

        <Text style={styles.kicker}>LIVI VENDEUR</Text>
        <Text style={styles.successTitle}>{title}</Text>
        <Text style={styles.successSubtitle}>{subtitle}</Text>

        <Card style={styles.successCard}>
          <Text style={styles.successCardTitle}>{name || 'Votre boutique'}</Text>
          <Text style={styles.successCardText}>
            {category || 'Catégorie non renseignée'}
          </Text>
        </Card>

        <Button
          title="Gérer mes produits"
          onPress={() => navigation.navigate('Products')}
          fullWidth
          size="lg"
        />

        <Button
          title="Modifier ma boutique"
          onPress={() => {
            setSaved(false);
            setStep(2);
          }}
          variant="secondary"
          fullWidth
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>
          {isEditing ? 'MA BOUTIQUE' : 'ONBOARDING VENDEUR'}
        </Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <StepIndicator currentStep={step} />

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
          <View style={styles.errorBody}>
            <Text style={styles.errorTitle}>Vérifiez votre saisie</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Pressable onPress={() => setError('')} hitSlop={10}>
            <Text style={styles.dismiss}>Fermer</Text>
          </Pressable>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card style={styles.heroCard}>
          <View style={styles.heroMark}>
            <Text style={styles.heroMarkText}>L</Text>
          </View>
          <Text style={styles.heroTitle}>
            {isEditing ? 'Gardez votre boutique à jour' : 'Votre espace vendeur commence ici'}
          </Text>
          <Text style={styles.heroText}>
            {isEditing
              ? 'Revoyez les informations principales puis continuez pour enregistrer vos modifications.'
              : 'Configurez les informations essentielles de votre boutique avant de gérer vos produits.'}
          </Text>
        </Card>
      ) : null}

      {step === 2 ? (
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Nom de la boutique</Text>
          <Text style={styles.fieldHint}>
            Un nom simple et reconnaissable.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nom de la boutique"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Catégorie principale</Text>
          <Text style={styles.fieldHint}>
            Utilisez la catégorie de votre activité.
          </Text>
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="Ex. Mode, alimentation, maison…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Slogan</Text>
          <Text style={styles.fieldHint}>Facultatif.</Text>
          <TextInput
            value={slogan}
            onChangeText={setSlogan}
            placeholder="Une phrase courte sur votre boutique"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textArea]}
            autoCapitalize="sentences"
            multiline
            maxLength={160}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{slogan.length}/160</Text>
        </View>
      ) : null}

      {step === 5 ? (
        <View style={styles.formStack}>
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Téléphone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Téléphone"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Ville</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Ville"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Adresse</Text>
            <Text style={styles.fieldHint}>Facultatif.</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Adresse de la boutique"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.textAreaSmall]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Card style={styles.locationCard}>
            <View style={styles.locationTop}>
              <View style={styles.locationCopy}>
                <Text style={styles.locationTitle}>Position de la boutique</Text>
                <Text style={styles.locationText}>
                  {coords
                    ? 'Une position est enregistrée pour votre boutique.'
                    : 'Ajoutez votre position actuelle pour les calculs liés à la distance.'}
                </Text>
              </View>
              <View
                style={[
                  styles.locationDot,
                  coords ? styles.locationDotActive : null,
                ]}
              />
            </View>

            <Button
              title={
                locating
                  ? 'Localisation…'
                  : coords
                    ? 'Mettre à jour la position'
                    : 'Utiliser ma position actuelle'
              }
              variant="outline"
              disabled={locating}
              loading={locating}
              onPress={requestLocation}
              fullWidth
            />
          </Card>

          <Card style={styles.commissionCard}>
            <View style={styles.commissionRow}>
              <View style={styles.commissionCopy}>
                <Text style={styles.commissionTitle}>
                  Répercuter la commission LIVI (3 %)
                </Text>
                <Text style={styles.commissionText}>
                  {commissionPassthrough
                    ? 'Le montant présenté à l’acheteur inclut la commission. Le montant de votre produit reste inchangé.'
                    : 'Le prix présenté à l’acheteur reste celui défini. La commission est déduite de votre montant.'}
                </Text>
              </View>

              <Switch
                value={commissionPassthrough}
                onValueChange={setCommissionPassthrough}
                trackColor={{
                  false: colors.dark4,
                  true: colors.gold,
                }}
                thumbColor={colors.white}
              />
            </View>
          </Card>
        </View>
      ) : null}

      {step === 6 ? (
        <View style={styles.reviewStack}>
          <Card style={styles.reviewCard}>
            <View style={styles.reviewHeading}>
              <Text style={styles.reviewTitle}>Informations de la boutique</Text>
              <Text style={styles.reviewEdit}>À confirmer</Text>
            </View>

            {[
              ['Nom', name || '—'],
              ['Catégorie', category || '—'],
              ['Slogan', slogan || '—'],
              ['Téléphone', phone || '—'],
              ['Ville', city || '—'],
              ['Adresse', address || '—'],
              [
                'Commission répercutée',
                commissionPassthrough ? 'Oui' : 'Non',
              ],
              [
                'Position',
                coords ? 'Enregistrée' : 'Non renseignée',
              ],
            ].map(([label, value]) => (
              <View style={styles.reviewRow} key={label}>
                <Text style={styles.reviewLabel}>{label}</Text>
                <Text style={styles.reviewValue} numberOfLines={3}>
                  {value}
                </Text>
              </View>
            ))}
          </Card>

          <Text style={styles.reviewNote}>
            Vous pourrez revenir ici pour modifier les informations de votre
            boutique.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {step > 1 ? (
          <Button
            title="Retour"
            onPress={() => {
              setError('');
              setStep((current) => Math.max(1, current - 1));
            }}
            variant="secondary"
            style={styles.backButton}
          />
        ) : null}

        <Button
          title={
            busy
              ? 'Enregistrement…'
              : step === 6
                ? isEditing
                  ? 'Enregistrer les modifications'
                  : 'Créer ma boutique'
                : 'Continuer'
          }
          onPress={step === 6 ? submit : next}
          disabled={busy}
          loading={busy}
          style={styles.nextButton}
          size="lg"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },
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
  successContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[3],
  },
  header: {
    gap: spacing[2],
  },
  kicker: {
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.15,
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    overflow: 'hidden',
  },
  stepItem: {
    width: 50,
    alignItems: 'center',
    gap: spacing[1],
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark3,
  },
  stepCircleActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201, 151, 28, 0.14)',
  },
  stepCircleComplete: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  stepCircleText: {
    color: colors.gray3,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  stepCircleTextActive: {
    color: colors.dark,
  },
  stepLabel: {
    width: 50,
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: 8,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.gold2,
    fontFamily: fonts.bodySemiBold,
  },
  stepConnector: {
    flex: 1,
    height: 1,
    marginTop: 15,
    backgroundColor: colors.border,
  },
  stepConnectorComplete: {
    backgroundColor: colors.gold,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 94, 0.28)',
    backgroundColor: 'rgba(255, 94, 94, 0.07)',
  },
  errorIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 94, 94, 0.14)',
  },
  errorIconText: {
    color: colors.red,
    fontFamily: fonts.bodyBold,
  },
  errorBody: {
    flex: 1,
    gap: spacing[1],
  },
  errorTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  errorText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  dismiss: {
    color: colors.gold2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  heroCard: {
    alignItems: 'center',
    padding: spacing[6],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.24)',
    backgroundColor: 'rgba(201, 151, 28, 0.06)',
  },
  heroMark: {
    width: 66,
    height: 66,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.35)',
  },
  heroMarkText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 34,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  heroText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 340,
  },
  formGroup: {
    gap: spacing[2],
  },
  formStack: {
    gap: spacing[4],
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  fieldHint: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
  },
  textArea: {
    minHeight: 128,
    paddingTop: spacing[4],
  },
  textAreaSmall: {
    minHeight: 92,
    paddingTop: spacing[4],
  },
  counter: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  locationCard: {
    gap: spacing[4],
  },
  locationTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  locationCopy: {
    flex: 1,
    gap: spacing[1],
  },
  locationTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.md,
  },
  locationText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  locationDot: {
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: 5,
    backgroundColor: colors.gray3,
  },
  locationDotActive: {
    backgroundColor: colors.gold,
  },
  commissionCard: {
    padding: spacing[4],
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  commissionCopy: {
    flex: 1,
    gap: spacing[1],
  },
  commissionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
  },
  commissionText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  reviewStack: {
    gap: spacing[3],
  },
  reviewCard: {
    gap: spacing[1],
  },
  reviewHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing[1],
  },
  reviewTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  reviewEdit: {
    color: colors.gold2,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[4],
    paddingVertical: spacing[2],
  },
  reviewLabel: {
    width: '38%',
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  reviewValue: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.sm,
    textAlign: 'right',
  },
  reviewNote: {
    color: colors.gray3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing[3],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingTop: spacing[1],
  },
  backButton: {
    flex: 0.8,
  },
  nextButton: {
    flex: 1.5,
  },
  successIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 151, 28, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(201, 151, 28, 0.32)',
    marginBottom: spacing[2],
  },
  successIconText: {
    color: colors.gold2,
    fontFamily: fonts.brand,
    fontSize: 38,
  },
  successTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    textAlign: 'center',
  },
  successSubtitle: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 350,
    marginBottom: spacing[3],
  },
  successCard: {
    width: '100%',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  successCardTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  successCardText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },
});
