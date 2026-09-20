import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { buyerApi } from '../../features/buyer/buyerApi';
import { normalizeList } from '../../services/api/normalize';

import {
  Button,
  EmptyState,
  Skeleton,
} from '../../design/components';

import {
  colors,
  fonts,
  fontSize,
  radius,
  shadow,
  spacing,
} from '../../design/theme';

type PaymentMethod = {
  id: string | number;
  operator?: string;
  provider?: string;
  phone_masked?: string;
  phone?: string;
  is_default?: boolean;
};

function formatPhone(method: PaymentMethod) {
  return (
    method.phone_masked ??
    method.phone ??
    'Numéro enregistré'
  );
}

function MethodCard({
  method,
  onDefault,
  onRemove,
  busy,
}: {
  method: PaymentMethod;
  onDefault: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const scale = useRef(
    new Animated.Value(1),
  ).current;

  return (
    <Animated.View
      style={[
        styles.methodAnimated,
        {
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        disabled={busy}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.985,
            useNativeDriver: true,
            friction: 8,
            tension: 95,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 95,
          }).start()
        }
        style={styles.methodCard}
      >
        <View style={styles.methodHeader}>
          <View style={styles.operatorMark}>
            <Text
              style={styles.operatorMarkText}
            >
              {String(
                method.operator ??
                  method.provider ??
                  'M',
              )
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View style={styles.methodIdentity}>
            <Text
              style={styles.methodTitle}
              numberOfLines={1}
            >
              {method.operator ??
                method.provider ??
                'Mobile Money'}
            </Text>

            <Text
              style={styles.methodNumber}
              numberOfLines={1}
            >
              {formatPhone(method)}
            </Text>
          </View>

          {method.is_default ? (
            <View style={styles.defaultBadge}>
              <Text
                style={styles.defaultBadgeText}
              >
                PAR DÉFAUT
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.methodFooter}>
          {method.is_default ? (
            <Text style={styles.defaultHint}>
              Utilisé automatiquement au paiement
            </Text>
          ) : (
            <Pressable
              onPress={onDefault}
              disabled={busy}
              hitSlop={8}
            >
              <Text
                style={styles.actionText}
              >
                Utiliser par défaut
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onRemove}
            disabled={busy}
            hitSlop={8}
          >
            <Text
              style={[
                styles.actionText,
                styles.removeText,
              ]}
            >
              Supprimer
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?:
    | 'default'
    | 'phone-pad'
    | 'number-pad';
  autoCapitalize?: 'none' | 'words';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

export function PaymentMethodsScreen() {
  const [methods, setMethods] =
    useState<PaymentMethod[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState('');

  const [modalVisible, setModalVisible] =
    useState(false);
  const [operator, setOperator] =
    useState('');
  const [phone, setPhone] =
    useState('');
  const [otp, setOtp] =
    useState('');
  const [sessionId, setSessionId] =
    useState('');
  const [isDefault, setIsDefault] =
    useState(true);
  const [processing, setProcessing] =
    useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response =
          await buyerApi.paymentMethods();

        setMethods(
          normalizeList<PaymentMethod>(
            response,
            [
              'methods',
              'payment_methods',
              'data',
            ],
          ),
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger vos moyens de paiement.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openAddModal() {
    setOperator('');
    setPhone('');
    setOtp('');
    setSessionId('');
    setIsDefault(true);
    setError('');
    setModalVisible(true);
  }

  function closeModal() {
    if (processing) return;

    setModalVisible(false);
    setOperator('');
    setPhone('');
    setOtp('');
    setSessionId('');
    setError('');
  }

  async function startVerification() {
    if (!operator.trim()) {
      setError(
        'Indiquez l’opérateur de paiement.',
      );
      return;
    }

    if (!phone.trim()) {
      setError(
        'Indiquez le numéro à vérifier.',
      );
      return;
    }

    try {
      setProcessing(true);
      setError('');

      const response =
        await buyerApi.initiatePaymentMethod(
          operator.trim(),
          phone.trim(),
        );

      const nextSession = String(
        response?.session_id ??
          response?.sessionId ??
          '',
      );

      if (!nextSession) {
        throw new Error(
          'La session de vérification n’a pas été créée.',
        );
      }

      setSessionId(nextSession);
    } catch (e: any) {
      setError(
        e?.message ??
          'Impossible d’initier la vérification.',
      );
    } finally {
      setProcessing(false);
    }
  }

  async function verify() {
    if (!sessionId) {
      setError(
        'Session de vérification absente.',
      );
      return;
    }

    if (!otp.trim()) {
      setError(
        'Entrez le code reçu par SMS.',
      );
      return;
    }

    try {
      setProcessing(true);
      setError('');

      await buyerApi.verifyPaymentMethod(
        sessionId,
        otp.trim(),
        isDefault,
      );

      setModalVisible(false);
      setOtp('');
      setSessionId('');
      setPhone('');
      setOperator('');
      setError('');

      await load(true);
    } catch (e: any) {
      setError(
        e?.message ??
          'Code invalide ou opération refusée.',
      );
    } finally {
      setProcessing(false);
    }
  }

  async function resend() {
    if (!sessionId || processing) return;

    try {
      setProcessing(true);
      setError('');

      await buyerApi.resendPaymentMethodOtp(
        sessionId,
      );

      Alert.alert(
        'Code renvoyé',
        'Un nouveau code de vérification a été demandé.',
      );
    } catch (e: any) {
      setError(
        e?.message ??
          'Impossible de renvoyer le code.',
      );
    } finally {
      setProcessing(false);
    }
  }

  function remove(method: PaymentMethod) {
    Alert.alert(
      'Supprimer ce moyen de paiement ?',
      `${method.operator ?? method.provider ?? 'Ce moyen de paiement'}${method.phone_masked ? ` · ${method.phone_masked}` : ''} ne sera plus disponible au checkout.`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setError('');

              await buyerApi.removePaymentMethod(
                String(method.id),
              );

              await load(true);
            } catch (e: any) {
              setError(
                e?.message ??
                  'Impossible de supprimer ce moyen de paiement.',
              );
            }
          },
        },
      ],
    );
  }

  async function makeDefault(
    method: PaymentMethod,
  ) {
    try {
      setError('');

      await buyerApi.setDefaultPaymentMethod(
        String(method.id),
      );

      await load(true);
    } catch (e: any) {
      setError(
        e?.message ??
          'Impossible de définir ce moyen par défaut.',
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton
          width="62%"
          height={14}
          radius={radius.sm}
        />
        <Skeleton
          width="84%"
          height={32}
          radius={radius.md}
        />
        <Skeleton
          width="100%"
          height={78}
          radius={radius.xl}
        />
        <Skeleton
          width="100%"
          height={138}
          radius={radius['2xl']}
        />
        <Skeleton
          width="100%"
          height={138}
          radius={radius['2xl']}
        />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.container
        }
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
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              PAIEMENT
            </Text>

            <Text style={styles.title}>
              Mes moyens de paiement
            </Text>

            <Text style={styles.subtitle}>
              Gérez les moyens disponibles pour vos
              achats sur LIVI.
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countNumber}>
              {methods.length}
            </Text>
            <Text style={styles.countLabel}>
              enregistré
              {methods.length > 1
                ? 's'
                : ''}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={openAddModal}
          style={({ pressed }) => [
            styles.addButton,
            pressed &&
              styles.addButtonPressed,
          ]}
        >
          <View style={styles.addIcon}>
            <Text style={styles.addIconText}>
              +
            </Text>
          </View>

          <View style={styles.addCopy}>
            <Text style={styles.addTitle}>
              Ajouter un moyen
            </Text>
            <Text style={styles.addSubtitle}>
              Vérification par code OTP
            </Text>
          </View>

          <Text style={styles.addArrow}>
            ›
          </Text>
        </Pressable>

        {error && !modalVisible ? (
          <View style={styles.errorBox}>
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>
                Opération indisponible
              </Text>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>

            <Pressable
              onPress={() => load()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.securityBox}>
          <View style={styles.securityIcon}>
            <Text
              style={
                styles.securityIconText
              }
            >
              ✓
            </Text>
          </View>

          <View style={styles.securityCopy}>
            <Text
              style={styles.securityTitle}
            >
              Vérification avant enregistrement
            </Text>

            <Text
              style={styles.securityText}
            >
              Un code OTP est demandé avant
              qu’un moyen de paiement soit
              enregistré.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>
              Moyens enregistrés
            </Text>
            <Text style={styles.sectionSubtitle}>
              Le moyen par défaut est proposé
              automatiquement au paiement.
            </Text>
          </View>
        </View>

        {methods.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="·"
              title="Aucun moyen de paiement"
              description="Ajoutez un moyen Mobile Money vérifié pour simplifier vos prochains paiements."
              actionLabel="Ajouter un moyen"
              onAction={openAddModal}
            />
          </View>
        ) : (
          <View style={styles.methodsList}>
            {methods.map((method) => (
              <MethodCard
                key={String(method.id)}
                method={method}
                onDefault={() =>
                  void makeDefault(method)
                }
                onRemove={() =>
                  remove(method)
                }
                busy={processing}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalScreen}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalEyebrow}>
                AJOUT SÉCURISÉ
              </Text>

              <Text style={styles.modalTitle}>
                {sessionId
                  ? 'Vérifier le numéro'
                  : 'Ajouter un moyen'}
              </Text>
            </View>

            <Pressable
              onPress={closeModal}
              disabled={processing}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>
                ×
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={
              styles.modalContent
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <View style={styles.modalError}>
                <Text
                  style={
                    styles.modalErrorText
                  }
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {!sessionId ? (
              <>
                <View style={styles.introCard}>
                  <View style={styles.introMark}>
                    <Text
                      style={
                        styles.introMarkText
                      }
                    >
                      ✓
                    </Text>
                  </View>

                  <View style={styles.introCopy}>
                    <Text style={styles.introTitle}>
                      Numéro vérifié par OTP
                    </Text>
                    <Text style={styles.introText}>
                      Renseignez l’opérateur et le
                      numéro à associer à votre compte.
                    </Text>
                  </View>
                </View>

                <View style={styles.formCard}>
                  <Field
                    label="Opérateur"
                    value={operator}
                    placeholder="Nom de l’opérateur"
                    onChangeText={(value) => {
                      setOperator(value);
                      if (error) setError('');
                    }}
                    autoCapitalize="words"
                  />

                  <Field
                    label="Numéro de paiement"
                    value={phone}
                    placeholder="Numéro Mobile Money"
                    onChangeText={(value) => {
                      setPhone(value);
                      if (error) setError('');
                    }}
                    keyboardType="phone-pad"
                  />

                  <Pressable
                    onPress={() =>
                      setIsDefault(
                        (current) => !current,
                      )
                    }
                    disabled={processing}
                    style={styles.defaultOption}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isDefault &&
                          styles.checkboxActive,
                      ]}
                    >
                      {isDefault ? (
                        <Text
                          style={
                            styles.checkboxMark
                          }
                        >
                          ✓
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.optionCopy}>
                      <Text
                        style={
                          styles.optionTitle
                        }
                      >
                        Définir comme moyen par défaut
                      </Text>

                      <Text
                        style={
                          styles.optionSubtitle
                        }
                      >
                        Il sera proposé en priorité au
                        paiement.
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <Button
                  title="Envoyer le code"
                  onPress={() =>
                    void startVerification()
                  }
                  disabled={processing}
                  loading={processing}
                  fullWidth
                  size="lg"
                />
              </>
            ) : (
              <>
                <View style={styles.otpCard}>
                  <View style={styles.otpMark}>
                    <Text
                      style={
                        styles.otpMarkText
                      }
                    >
                      OTP
                    </Text>
                  </View>

                  <Text style={styles.otpTitle}>
                    Entrez le code reçu
                  </Text>

                  <Text style={styles.otpText}>
                    Le code permet de confirmer le
                    numéro avant son enregistrement.
                  </Text>

                  <Text
                    style={styles.otpPhone}
                    numberOfLines={1}
                  >
                    {phone}
                  </Text>
                </View>

                <View style={styles.formCard}>
                  <Field
                    label="Code OTP"
                    value={otp}
                    placeholder="000000"
                    onChangeText={(value) => {
                      setOtp(
                        value
                          .replace(/\D/g, '')
                          .slice(0, 8),
                      );
                      if (error) setError('');
                    }}
                    keyboardType="number-pad"
                  />

                  <Button
                    title="Vérifier et enregistrer"
                    onPress={() =>
                      void verify()
                    }
                    disabled={
                      processing ||
                      !otp.trim()
                    }
                    loading={processing}
                    fullWidth
                    size="lg"
                  />

                  <Pressable
                    onPress={() =>
                      void resend()
                    }
                    disabled={processing}
                    style={styles.resendButton}
                  >
                    <Text
                      style={
                        styles.resendText
                      }
                    >
                      Renvoyer le code
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            <Pressable
              onPress={closeModal}
              disabled={processing}
              style={styles.cancelButton}
            >
              <Text
                style={styles.cancelText}
              >
                Annuler
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
  },

  loadingScreen: {
    flex: 1,
    padding: spacing[5],
    gap: spacing[4],
    backgroundColor: colors.dark,
  },

  header: {
    marginBottom: spacing[5],
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
  },

  headerCopy: {
    flex: 1,
  },

  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.gold,
  },

  title: {
    marginTop: 2,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
  },

  countBadge: {
    minWidth: 68,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },

  countNumber: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    lineHeight: 22,
    color: colors.gold,
  },

  countLabel: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.textMuted,
  },

  addButton: {
    minHeight: 78,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.gold,
  },

  addButtonPressed: {
    opacity: 0.88,
  },

  addIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xl,
    color: colors.gold,
  },

  addCopy: {
    flex: 1,
    marginLeft: spacing[3],
  },

  addTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.dark,
  },

  addSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.dark,
    opacity: 0.62,
  },

  addArrow: {
    marginLeft: spacing[3],
    fontFamily: fonts.body,
    fontSize: fontSize['2xl'],
    color: colors.dark,
  },

  errorBox: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  errorCopy: {
    flex: 1,
  },

  errorTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  errorText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  retryButton: {
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  securityBox: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
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

  securityCopy: {
    flex: 1,
  },

  securityTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  securityText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  sectionHeader: {
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },

  sectionHeaderCopy: {
    gap: 2,
  },

  sectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },

  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
  },

  methodsList: {
    gap: spacing[3],
  },

  methodAnimated: {
    width: '100%',
  },

  methodCard: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  operatorMark: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  operatorMarkText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  methodIdentity: {
    flex: 1,
    minWidth: 0,
  },

  methodTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  methodNumber: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  defaultBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  defaultBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    color: colors.gold,
    letterSpacing: 0.5,
  },

  methodFooter: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  defaultHint: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  actionText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  removeText: {
    color: colors.red,
  },

  emptyWrapper: {
    minHeight: 340,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalScreen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  modalHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  modalHeaderCopy: {
    flex: 1,
  },

  modalEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.5,
    color: colors.gold,
  },

  modalTitle: {
    marginTop: 2,
    fontFamily: fonts.brand,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeText: {
    marginTop: -2,
    fontFamily: fonts.body,
    fontSize: 27,
    color: colors.textMuted,
  },

  modalContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
  },

  modalError: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  modalErrorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  introCard: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing[3],
  },

  introMark: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  introMarkText: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },

  introCopy: {
    flex: 1,
  },

  introTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  introText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
  },

  formCard: {
    marginBottom: spacing[4],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  field: {
    marginBottom: spacing[4],
  },

  fieldLabel: {
    marginBottom: spacing[2],
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },

  defaultOption: {
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },

  checkboxMark: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.dark,
  },

  optionCopy: {
    flex: 1,
  },

  optionTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  optionSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  otpCard: {
    marginBottom: spacing[4],
    padding: spacing[6],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
  },

  otpMark: {
    minWidth: 56,
    minHeight: 42,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  otpMarkText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
    letterSpacing: 0.5,
  },

  otpTitle: {
    marginTop: spacing[4],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  otpText: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
  },

  otpPhone: {
    marginTop: spacing[3],
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
    textAlign: 'center',
  },

  resendButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[2],
  },

  resendText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.gold,
  },

  cancelButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[2],
  },

  cancelText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
