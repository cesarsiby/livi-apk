import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
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

const EMPTY_FORM = {
  label: '',
  recipient_name: '',
  phone: '',
  address_line: '',
  city: '',
  country: 'ML',
  is_default: false,
  neighborhood: '',
  landmark_type: '',
  landmark_description: '',
};

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  multiline = false,
  keyboardType,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
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
        multiline={multiline}
        textAlignVertical={
          multiline ? 'top' : 'center'
        }
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
      />
    </View>
  );
}

function AddressCard({
  address,
  onEdit,
  onDelete,
  onMakeDefault,
}: {
  address: any;
  onEdit: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
}) {
  const neighborhood = address.neighborhood;
  const landmark =
    address.landmark_type &&
    address.landmark_description
      ? `${address.landmark_type} : ${address.landmark_description}`
      : address.landmark_description;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.addressIcon}>
          <Text style={styles.addressIconText}>
            ⌂
          </Text>
        </View>

        <View style={styles.cardHeaderText}>
          <Text
            numberOfLines={1}
            style={styles.addressTitle}
          >
            {address.label ?? 'Adresse'}
          </Text>

          <Text style={styles.recipient}>
            {address.recipient_name ?? '—'}
          </Text>
        </View>

        {address.is_default ? (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>
              PAR DÉFAUT
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.addressDetails}>
        <Text style={styles.addressText}>
          {address.address_line ??
            address.address ??
            '—'}
        </Text>

        <Text style={styles.addressText}>
          {[address.city, address.country]
            .filter(Boolean)
            .join(', ') || '—'}
        </Text>

        {address.phone ? (
          <Text style={styles.addressMuted}>
            {address.phone}
          </Text>
        ) : null}

        {neighborhood || landmark ? (
          <View style={styles.landmarkBox}>
            <View style={styles.landmarkIcon}>
              <Text style={styles.landmarkIconText}>
                •
              </Text>
            </View>

            <View style={styles.landmarkContent}>
              {neighborhood ? (
                <Text style={styles.landmarkTitle}>
                  {neighborhood}
                </Text>
              ) : null}

              {landmark ? (
                <Text style={styles.landmarkText}>
                  {landmark}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onEdit}
          style={styles.action}
        >
          <Text style={styles.actionText}>
            Modifier
          </Text>
        </Pressable>

        {!address.is_default ? (
          <Pressable
            onPress={onMakeDefault}
            style={styles.action}
          >
            <Text style={styles.actionText}>
              Par défaut
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onDelete}
          style={styles.action}
        >
          <Text
            style={[
              styles.actionText,
              styles.deleteText,
            ]}
          >
            Supprimer
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AddressesScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] =
    useState<any>(null);

  const [form, setForm] =
    useState({ ...EMPTY_FORM });

  const [saving, setSaving] =
    useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');

    buyerApi
      .addresses()
      .then((response) => {
        setItems(
          normalizeList<any>(
            response,
            ['addresses', 'data'],
          ),
        );
      })
      .catch((e: any) => {
        setError(
          e?.message ??
            'Impossible de charger vos adresses.',
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

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setModal(true);
  };

  const openEdit = (address: any) => {
    setEditing(address);

    setForm({
      ...EMPTY_FORM,
      ...address,
      country: address.country ?? 'ML',
      is_default: Boolean(
        address.is_default,
      ),
    });

    setError('');
    setModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModal(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const setField = (
    field: keyof typeof EMPTY_FORM,
    value: string | boolean,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const save = async () => {
    if (!form.label.trim()) {
      setError('Donnez un nom à cette adresse.');
      return;
    }

    if (!form.recipient_name.trim()) {
      setError('Indiquez le nom du destinataire.');
      return;
    }

    if (!form.phone.trim()) {
      setError(
        'Indiquez le numéro du destinataire.',
      );
      return;
    }

    if (!form.address_line.trim()) {
      setError('Indiquez l’adresse.');
      return;
    }

    if (!form.city.trim()) {
      setError('Indiquez la ville.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        ...form,
        label: form.label.trim(),
        recipient_name:
          form.recipient_name.trim(),
        phone: form.phone.trim(),
        address_line:
          form.address_line.trim(),
        city: form.city.trim(),
        neighborhood:
          form.neighborhood.trim(),
        landmark_type:
          form.landmark_type.trim(),
        landmark_description:
          form.landmark_description.trim(),
        country: form.country || 'ML',
      };

      if (editing) {
        await buyerApi.updateAddress(
          String(editing.id),
          payload,
        );
      } else {
        await buyerApi.addAddress(
          payload,
        );
      }

      setModal(false);
      setEditing(null);
      setForm({ ...EMPTY_FORM });

      load();
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible d'enregistrer l'adresse.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert(
      'Supprimer cette adresse ?',
      'Cette action est définitive.',
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
              await buyerApi.deleteAddress(id);
              load();
            } catch (e: any) {
              setError(
                e?.message ??
                  "Impossible de supprimer l'adresse.",
              );
            }
          },
        },
      ],
    );
  };

  const makeDefault = async (id: string) => {
    try {
      await buyerApi.updateAddress(id, {
        is_default: true,
      });

      load();
    } catch (e: any) {
      setError(
        e?.message ??
          'Impossible de définir cette adresse par défaut.',
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton
          height={58}
          radius={radius.xl}
        />

        <Skeleton
          height={180}
          radius={radius.xl}
        />

        <Skeleton
          height={180}
          radius={radius.xl}
        />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.screen}
        data={items}
        keyExtractor={(item) =>
          String(item.id)
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          items.length === 0 &&
            styles.listEmpty,
        ]}
        refreshing={false}
        onRefresh={load}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>
                  LIVRAISON
                </Text>

                <Text style={styles.title}>
                  Mes adresses
                </Text>

                <Text style={styles.subtitle}>
                  Où souhaitez-vous recevoir vos
                  commandes ?
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countNumber}>
                  {items.length}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={openCreate}
              style={styles.addButton}
            >
              <View style={styles.addIcon}>
                <Text style={styles.addIconText}>
                  +
                </Text>
              </View>

              <View style={styles.addContent}>
                <Text style={styles.addTitle}>
                  Ajouter une adresse
                </Text>

                <Text style={styles.addSubtitle}>
                  Enregistrez un nouveau lieu de
                  livraison
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

            {items.length > 0 ? (
              <View style={styles.helperBox}>
                <View style={styles.helperIcon}>
                  <Text
                    style={
                      styles.helperIconText
                    }
                  >
                    •
                  </Text>
                </View>

                <Text style={styles.helperText}>
                  Les repères locaux peuvent aider
                  le livreur à trouver votre adresse
                  plus facilement.
                </Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="·"
            title="Aucune adresse enregistrée"
            description="Ajoutez un lieu de livraison pour passer vos prochaines commandes plus facilement."
            actionLabel="Ajouter une adresse"
            onAction={openCreate}
          />
        }
        renderItem={({ item }) => (
          <AddressCard
            address={item}
            onEdit={() => openEdit(item)}
            onDelete={() =>
              remove(String(item.id))
            }
            onMakeDefault={() =>
              makeDefault(String(item.id))
            }
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={{ height: spacing[3] }} />
        )}
      />

      <Modal
        visible={modal}
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
            <View>
              <Text style={styles.modalEyebrow}>
                ADRESSE DE LIVRAISON
              </Text>

              <Text style={styles.modalTitle}>
                {editing
                  ? 'Modifier l’adresse'
                  : 'Nouvelle adresse'}
              </Text>
            </View>

            <Pressable
              style={styles.closeButton}
              onPress={closeModal}
              disabled={saving}
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

            <View style={styles.formCard}>
              <Text style={styles.formSectionTitle}>
                Informations principales
              </Text>

              <Field
                label="Nom de l’adresse"
                placeholder="Maison, Bureau, Famille…"
                value={form.label}
                onChangeText={(value) =>
                  setField('label', value)
                }
              />

              <Field
                label="Destinataire"
                placeholder="Nom complet"
                value={form.recipient_name}
                onChangeText={(value) =>
                  setField(
                    'recipient_name',
                    value,
                  )
                }
              />

              <Field
                label="Téléphone"
                placeholder="Numéro joignable"
                value={form.phone}
                onChangeText={(value) =>
                  setField('phone', value)
                }
                keyboardType="phone-pad"
              />

              <Field
                label="Adresse"
                placeholder="Rue, secteur ou indication principale"
                value={form.address_line}
                onChangeText={(value) =>
                  setField(
                    'address_line',
                    value,
                  )
                }
                multiline
              />

              <Field
                label="Ville"
                placeholder="Ville"
                value={form.city}
                onChangeText={(value) =>
                  setField('city', value)
                }
              />
            </View>

            <View style={styles.formCard}>
              <View style={styles.formSectionHeading}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={
                      styles.formSectionTitle
                    }
                  >
                    Repères locaux
                  </Text>

                  <Text
                    style={
                      styles.formSectionSubtitle
                    }
                  >
                    Ajoutez ce qui aidera le livreur
                    à vous trouver.
                  </Text>
                </View>
              </View>

              <Field
                label="Quartier / secteur"
                placeholder="Quartier ou zone"
                value={form.neighborhood}
                onChangeText={(value) =>
                  setField(
                    'neighborhood',
                    value,
                  )
                }
              />

              <Field
                label="Type de repère"
                placeholder="Pharmacie, école, boutique…"
                value={form.landmark_type}
                onChangeText={(value) =>
                  setField(
                    'landmark_type',
                    value,
                  )
                }
              />

              <Field
                label="Description du repère"
                placeholder="Précision utile pour le livreur"
                value={
                  form.landmark_description
                }
                onChangeText={(value) =>
                  setField(
                    'landmark_description',
                    value,
                  )
                }
                multiline
              />
            </View>

            <Pressable
              style={styles.defaultToggle}
              onPress={() =>
                setField(
                  'is_default',
                  !form.is_default,
                )
              }
            >
              <View
                style={[
                  styles.checkbox,
                  form.is_default &&
                    styles.checkboxActive,
                ]}
              >
                {form.is_default ? (
                  <Text
                    style={
                      styles.checkboxCheck
                    }
                  >
                    ✓
                  </Text>
                ) : null}
              </View>

              <View style={styles.defaultTextWrap}>
                <Text style={styles.defaultTitle}>
                  Utiliser comme adresse par défaut
                </Text>

                <Text style={styles.defaultSubtitle}>
                  Elle sera proposée en priorité lors
                  du checkout.
                </Text>
              </View>
            </Pressable>

            <Button
              title={
                saving
                  ? 'Enregistrement…'
                  : editing
                    ? 'Enregistrer les modifications'
                    : 'Ajouter cette adresse'
              }
              onPress={() => void save()}
              disabled={saving}
              loading={saving}
              fullWidth
            />

            <Pressable
              style={styles.cancelButton}
              onPress={closeModal}
              disabled={saving}
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  list: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  listEmpty: {
    flexGrow: 1,
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
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing[3],
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

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
    maxWidth: 280,
  },

  countBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countNumber: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  addButton: {
    minHeight: 78,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
  },

  addIcon: {
    width: 38,
    height: 38,
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

  addContent: {
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
    opacity: 0.65,
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

  errorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  retryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  helperBox: {
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

  helperIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  helperIconText: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },

  helperText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
  },

  card: {
    marginTop: spacing[4],
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.gold,
  },

  cardHeaderText: {
    flex: 1,
  },

  addressTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  recipient: {
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
    letterSpacing: 0.7,
    color: colors.gold,
  },

  addressDetails: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  addressText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },

  addressMuted: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  landmarkBox: {
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    flexDirection: 'row',
    gap: spacing[2],
  },

  landmarkIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  landmarkIconText: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },

  landmarkContent: {
    flex: 1,
  },

  landmarkTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },

  landmarkText: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  actions: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
  },

  action: {
    paddingVertical: 4,
  },

  actionText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
  },

  deleteText: {
    color: colors.red,
  },

  modalScreen: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  modalHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    padding: spacing[5],
    paddingBottom: spacing[10],
  },

  modalError: {
    marginBottom: spacing[4],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  formCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[4],
  },

  formSectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  formSectionTitle: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    marginBottom: spacing[4],
  },

  formSectionSubtitle: {
    marginTop: -spacing[3],
    marginBottom: spacing[4],
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textMuted,
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
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    paddingHorizontal: spacing[4],
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },

  multilineInput: {
    minHeight: 88,
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
  },

  defaultToggle: {
    marginBottom: spacing[5],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },

  checkboxCheck: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.dark,
  },

  defaultTextWrap: {
    flex: 1,
  },

  defaultTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  defaultSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  cancelButton: {
    minHeight: 46,
    marginTop: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
