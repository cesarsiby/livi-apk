import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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

function MethodCard({
  method,
  onDefault,
  onRemove,
}: {
  method: PaymentMethod;
  onDefault: () => void;
  onRemove: () => void;
}) {
  const scale = useRef(
    new AnimatedValueShim(1),
  ).current;

  return (
    <Pressable
      onPressIn={() => scale.set(0.985)}
      onPressOut={() => scale.set(1)}
      style={[
        styles.methodCard,
        scale.value < 1 &&
          styles.methodCardPressed,
      ]}
    >
      <View style={styles.methodHeader}>
        <View style={styles.operatorMark}>
          <Text style={styles.operatorMarkText}>
            {String(
              method.operator ??
                method.provider ??
                'M',
            )
              .slice(0, 1)
              .toUpperCase()}
          </Text>
        </View>

        <View style={styles.methodIdentity}>
          <Text style={styles.methodTitle}>
            {method.operator ??
              method.provider ??
              'Mobile Money'}
          </Text>

          <Text style={styles.methodNumber}>
            {method.phone_masked ??
              method.phone ??
              'Numéro enregistré'}
          </Text>
        </View>

        {method.is_default ? (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>
              PAR DÉFAUT
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.methodFooter}>
        {!method.is_default ? (
          <Pressable
            onPress={onDefault}
            hitSlop={8}
            style={styles.methodAction}
          >
            <Text style={styles.methodActionText}>
              Utiliser par défaut
            </Text>
          </Pressable>
        ) : (
          <View style={styles.defaultHint}>
            <Text style={styles.defaultHintText}>
              Utilisé automatiquement au paiement
            </Text>
          </View>
        )}

        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={styles.methodAction}
        >
          <Text
            style={[
              styles.methodActionText,
              styles.removeText,
            ]}
          >
            Supprimer
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

/**
 * Petite valeur animable locale pour conserver la dépendance du composant
 * à React Native uniquement, sans ajouter de nouvelle bibliothèque.
 */
class AnimatedValueShim {
  value: number;

  constructor(initial: number) {
    this.value = initial;
  }

  set(next: number) {
    this.value = next;
  }
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  secureTextEntry?: boolean;
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
        secureTextEntry={secureTextEntry}
        style={styles.input}
        autoCapitalize="none"
      />
    </View>
  );
}

export function PaymentMethodsScreen() {
  const [methods, setMethods] =
    useState<PaymentMethod[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [modalVisible, setModalVisible] =
    useState(false);

  const [operator, setOperator] =
    useState('Orange Money');

  const [phone, setPhone] =
    useState('');

  const [otp, setOtp] =
    useState('');

  const [session, setSession] =
    useState('');

  const [isDefault, setIsDefault] =
    useState(true);

  const [processing, setProcessing] =
    useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');

    buyerApi
      .paymentMethods()
      .then((response) => {
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
      })
      .catch((e: any) => {
        setError(
          e?.message ??
            'Impossible de charger vos moyens de paiement.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openAddModal = () => {
    setOperator('Orange Money');
    setPhone('');
    setOtp('');
    setSession('');
    setIsDefault(true);
    setError('');
    setModalVisible(true);
  };

  const closeModal = () => {
    if (processing) return;

    setModalVisible(false);
    setOtp('');
    setSession('');
  };

  const startVerification = async () => {
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

      const sessionId = String(
        response?.session_id ??
          response?.sessionId ??
          '',
      );

      if (!sessionId) {
        throw new Error(
          'La session de vérification n’a pas été créée.',
        );
      }

      setSession(sessionId);
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible d'initier la vérification.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const verify = async () => {
    if (!session) {
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
        session,
        otp.trim(),
        isDefault,
      );

      setModalVisible(false);
      setOtp('');
      setSession('');
      setPhone('');

      load();
    } catch (e: any) {
      setError(
        e?.message ??
          'Code invalide ou opération refusée.',
      );
    } finally {
      setProcessing(false);
    }
  };

  const resend = async () => {
    if (!session) return;

    try {
      setProcessing(true);
      setError('');

      await buyerApi.resendPaymentMethodOtp(
        session,
      );
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible de renvoyer le code.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const remove = (
    method: PaymentMethod,
  ) => {
    Alert.alert(
      'Supprimer ce moyen de paiement ?',
      `${
        method.operator ??
        method.provider ??
        'Ce moyen de paiement'
      }${
        method.phone_masked
          ? ` · ${method.phone_masked}`
          : ''
      } ne sera plus disponible au checkout.`,
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

              load();
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
  };

  const makeDefault = async (
    method: PaymentMethod,
  ) => {
    try {
      setError('');

      await buyerApi.setDefaultPaymentMethod(
        String(method.id),
      );

      load();
    } catch (e: any) {
      setError(
        e?.message ??
          'Impossible de définir ce moyen par défaut.',
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton
          height={86}
          radius={radius.xl}
        />

        <Skeleton
          height={150}
          radius={radius.xl}
        />

        <Skeleton
          height={150}
          radius={radius.xl}
        />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
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
              Gérez les moyens utilisés pour vos achats
              sur Livi.
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countNumber}>
              {methods.length}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={openAddModal}
          style={styles.addButton}
        >
          <View style={styles.addIcon}>
            <Text style={styles.addIconText}>
              +
            </Text>
          </View>

          <View style={styles.addContent}>
            <Text style={styles.addTitle}>
              Ajouter un moyen
            </Text>

            <Text style={styles.addSubtitle}>
              Vérifiez votre numéro Mobile Money
            </Text>
          </View>

          <Text style={styles.addArrow}>
            ›
          </Text>
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable onPress={load}>
              <Text style={styles.retryText}>
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.securityNote}>
          <View style={styles.securityIcon}>
            <Text style={styles.securityIconText}>
              ✓
            </Text>
          </View>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>
              Vérification avant utilisation
            </Text>

            <Text style={styles.securityText}>
              Livi vérifie le numéro avec un code OTP
              avant de l’enregistrer.
            </Text>
          </View>
        </View>

        {methods.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Moyens enregistrés
              </Text>

              <Text style={styles.sectionSubtitle}>
                Sélectionnez celui à utiliser par
                défaut.
              </Text>
            </View>

            <View style={styles.methodsList}>
              {methods.map((method) => (
                <MethodCard
                  key={String(method.id)}
                  method={method}
                  onDefault={() =>
                    makeDefault(method)
                  }
                  onRemove={() =>
                    remove(method)
                  }
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="·"
              title="Aucun moyen de paiement"
              description="Ajoutez un numéro Mobile Money pour payer plus rapidement au moment du checkout."
              actionLabel="Ajouter un moyen"
              onAction={openAddModal}
            />
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
            <View style={{ flex: 1 }}>
              <Text style={styles.modalEyebrow}>
                NOUVEAU MOYEN
              </Text>

              <Text style={styles.modalTitle}>
                {session
                  ? 'Vérifier le numéro'
                  : 'Ajouter un moyen'}
              </Text>
            </View>

            <Pressable
              style={styles.closeButton}
              onPress={closeModal}
              disabled={processing}
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
                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            ) : null}

            {!session ? (
              <>
                <View style={styles.introCard}>
                  <View style={styles.introIcon}>
                    <Text
                      style={styles.introIconText}
                    >
                      ✓
                    </Text>
                  </View>

                  <View style={styles.introContent}>
                    <Text style={styles.introTitle}>
                      Votre numéro sera vérifié
                    </Text>

                    <Text style={styles.introText}>
                      Entrez le numéro associé à votre
                      moyen de paiement. Un code OTP sera
                      demandé avant l’enregistrement.
                    </Text>
                  </View>
                </View>

                <View style={styles.formCard}>
                  <Field
                    label="Opérateur"
                    value={operator}
                    placeholder="Nom de l’opérateur"
                    onChangeText={setOperator}
                  />

                  <Field
                    label="Numéro"
                    value={phone}
                    placeholder="Numéro Mobile Money"
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />

                  <Pressable
                    style={styles.defaultOption}
                    onPress={() =>
                      setIsDefault(
                        (current) => !current,
                      )
                    }
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
                            styles.checkboxText
                          }
                        >
                          ✓
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={
                        styles.defaultOptionText
                      }
                    >
                      <Text
                        style={
                          styles.defaultOptionTitle
                        }
                      >
                        Définir par défaut
                      </Text>

                      <Text
                        style={
                          styles.defaultOptionSubtitle
                        }
                      >
                        Ce moyen sera proposé en priorité
                        lors du paiement.
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <Button
                  title={
                    processing
                      ? 'Envoi…'
                      : 'Envoyer le code'
                  }
                  onPress={() =>
                    void startVerification()
                  }
                  disabled={processing}
                  loading={processing}
                  fullWidth
                />
              </>
            ) : (
              <>
                <View style={styles.otpCard}>
                  <View style={styles.otpCircle}>
                    <Text style={styles.otpCircleText}>
                      ✓
                    </Text>
                  </View>

                  <Text style={styles.otpTitle}>
                    Code de vérification
                  </Text>

                  <Text style={styles.otpSubtitle}>
                    Entrez le code envoyé au numéro
                    indiqué.
                  </Text>

                  <Text
                    style={styles.otpNumber}
                    numberOfLines={1}
                  >
                    {phone}
                  </Text>
                </View>

                <View style={styles.formCard}>
                  <Field
                    label="Code OTP"
                    value={otp}
                    placeholder="Code reçu par SMS"
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                  />

                  <Button
                    title={
                      processing
                        ? 'Vérification…'
                        : 'Vérifier et enregistrer'
                    }
                    onPress={() =>
                      void verify()
                    }
                    disabled={
                      processing ||
                      !otp.trim()
                    }
                    loading={processing}
                    fullWidth
                  />

                  <Pressable
                    style={styles.resendButton}
                    onPress={() =>
                      void resend()
                    }
                    disabled={processing}
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
              style={styles.cancelButton}
              onPress={closeModal}
              disabled={processing}
            >
              <Text style={styles.cancelText}>
                Annuler
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = Styl
