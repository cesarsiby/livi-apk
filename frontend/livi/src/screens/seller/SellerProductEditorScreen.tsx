import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import {
  sellerApi,
  SellerProduct,
  ProductVariant,
} from '../../features/seller/sellerApi';

import {
  categoriesApi,
  Category,
} from '../../features/catalogue/categoriesApi';

import {
  Button,
  Money,
  Skeleton,
} from '../../design/components';

import { resolveMediaUrl } from '../../services/api/media';

import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

type MediaItem = {
  id: string | number;
  media_url?: string;
  alt_text?: string | null;
  sort_order?: number;
  kind?: string;
};

const EMPTY_VARIANT = {
  label: '',
  price: '',
  stock: '',
  sku: '',
};

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  multiline = false,
  keyboardType = 'default',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?:
    | 'default'
    | 'decimal-pad'
    | 'number-pad';
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
          multiline && styles.textArea,
        ]}
      />
    </View>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? (
        <Text style={styles.sectionEyebrow}>
          {eyebrow}
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      {subtitle ? (
        <Text style={styles.sectionSubtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function CategoryChip({
  category,
  selected,
  onPress,
}: {
  category: Category;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.categoryChip,
        selected &&
          styles.categoryChipSelected,
      ]}
    >
      <Text
        style={[
          styles.categoryChipText,
          selected &&
            styles.categoryChipTextSelected,
        ]}
      >
        {category.name}
      </Text>
    </Pressable>
  );
}

function MediaCard({
  item,
  onDelete,
}: {
  item: MediaItem;
  onDelete: () => void;
}) {
  const image = resolveMediaUrl(
    item.media_url,
  );

  return (
    <View style={styles.mediaCard}>
      <View style={styles.mediaPreview}>
        {image ? (
          <Image
            source={{ uri: image }}
            resizeMode="cover"
            style={styles.mediaImage}
          />
        ) : (
          <View
            style={
              styles.mediaPlaceholder
            }
          >
            <Text
              style={
                styles.mediaPlaceholderText
              }
            >
              L
            </Text>
          </View>
        )}
      </View>

      <View style={styles.mediaContent}>
        <Text style={styles.mediaTitle}>
          Photo {Number(item.sort_order ?? 0) + 1}
        </Text>

        <Text style={styles.mediaSubtitle}>
          {item.kind === 'image'
            ? 'Image produit'
            : item.kind ?? 'Média'}
        </Text>

        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={styles.mediaDelete}
        >
          <Text style={styles.mediaDeleteText}>
            Supprimer
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function VariantCard({
  variant,
  onDelete,
}: {
  variant: ProductVariant;
  onDelete: () => void;
}) {
  const label =
    String(
      (variant.attributes as any)?.name ??
        variant.sku ??
        'Variante',
    );

  return (
    <View style={styles.variantCard}>
      <View style={styles.variantMain}>
        <View style={styles.variantIcon}>
          <Text style={styles.variantIconText}>
            +
          </Text>
        </View>

        <View style={styles.variantIdentity}>
          <Text
            numberOfLines={1}
            style={styles.variantTitle}
          >
            {label}
          </Text>

          <Text style={styles.variantMeta}>
            Stock : {variant.stock_qty}
          </Text>
        </View>
      </View>

      <View style={styles.variantRight}>
        {variant.price_xof != null ? (
          <Money
            amount={variant.price_xof}
            currency="FCFA"
            size="sm"
            color={colors.gold}
          />
        ) : (
          <Text style={styles.variantPrice}>
            Prix produit
          </Text>
        )}

        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={styles.variantDelete}
        >
          <Text style={styles.variantDeleteText}>
            Retirer
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SellerProductEditorScreen({
  route,
  navigation,
}: any) {
  const routeProductId =
    route.params?.productId
      ? String(route.params.productId)
      : null;

  const [productId, setProductId] =
    useState<string | null>(
      routeProductId,
    );

  const [product, setProduct] =
    useState<SellerProduct | null>(
      null,
    );

  const [name, setName] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [price, setPrice] =
    useState('');

  const [stock, setStock] =
    useState('');

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [categoryId, setCategoryId] =
    useState<string | null>(null);

  const [media, setMedia] =
    useState<MediaItem[]>([]);

  const [variants, setVariants] =
    useState<ProductVariant[]>([]);

  const [variantForm, setVariantForm] =
    useState({
      ...EMPTY_VARIANT,
    });

  const [loading, setLoading] =
    useState(Boolean(routeProductId));

  const [busy, setBusy] =
    useState(false);

  const [addingVariant, setAddingVariant] =
    useState(false);

  const [error, setError] =
    useState('');

  const loadCategories =
    useCallback(async () => {
      try {
        const data =
          await categoriesApi.list();

        if (Array.isArray(data)) {
          setCategories(data);
        }
      } catch {
        setCategories([]);
      }
    }, []);

  const loadProduct =
    useCallback(async () => {
      if (!productId) return;

      setLoading(true);
      setError('');

      try {
        const response =
          await sellerApi.products({
            limit: 100,
          });

        const products =
          Array.isArray(response)
            ? response
            : Array.isArray(
                  response?.products,
                )
              ? response.products
              : Array.isArray(
                    response?.data,
                  )
                ? response.data
                : [];

        const found =
          products.find(
            (item: SellerProduct) =>
              String(item.id) ===
              String(productId),
          ) ?? null;

        if (!found) {
          throw new Error(
            'Produit introuvable.',
          );
        }

        setProduct(found);

        setName(
          found.name ??
            found.title ??
            '',
        );

        setPrice(
          found.price_xof != null
            ? String(
                found.price_xof,
              )
            : found.price != null
              ? String(found.price)
              : '',
        );

        setStock(
          found.stock != null
            ? String(found.stock)
            : '',
        );

        setDescription(
          (found as any)
            .description ?? '',
        );

        setCategoryId(
          (found as any).category_id ??
            null,
        );

        const [mediaResult, variantsResult] =
          await Promise.all([
            sellerApi.media(
              String(productId),
            ),
            sellerApi.variants(
              String(productId),
            ),
          ]);

        setMedia(
          Array.isArray(mediaResult)
            ? mediaResult
            : [],
        );

        setVariants(
          Array.isArray(variantsResult)
            ? variantsResult
            : [],
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de charger le produit.',
        );
      } finally {
        setLoading(false);
      }
    }, [productId]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (productId) {
      void loadProduct();
    } else {
      setLoading(false);
    }
  }, [productId, loadProduct]);

  const save = async () => {
    if (!name.trim()) {
      setError(
        'Le nom du produit est obligatoire.',
      );
      return;
    }

    if (!price.trim()) {
      setError(
        'Le prix du produit est obligatoire.',
      );
      return;
    }

    const numericPrice =
      Number(price);

    if (
      !Number.isInteger(
        numericPrice,
      ) ||
      numericPrice <= 0
    ) {
      setError(
        'Le prix doit être un nombre entier supérieur à zéro.',
      );
      return;
    }

    const numericStock =
      Number(stock || 0);

    if (
      !Number.isInteger(
        numericStock,
      ) ||
      numericStock < 0
    ) {
      setError(
        'Le stock doit être un nombre entier positif ou nul.',
      );
      return;
    }

    setBusy(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        description:
          description.trim() ||
          undefined,
        price_xof: numericPrice,
        stock: numericStock,
        category_id:
          categoryId ?? undefined,
      };

      if (productId) {
        const updated =
          await sellerApi.updateProduct(
            productId,
            payload,
          );

        setProduct(updated);
      } else {
        const created =
          await sellerApi.createProduct(
            payload,
          );

        const createdId =
          String(created.id);

        setProduct(
          created,
        );

        setProductId(createdId);
      }
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible d'enregistrer le produit.",
      );
    } finally {
      setBusy(false);
    }
  };

  const addPhotos =
    async () => {
      if (!productId) {
        setError(
          'Enregistrez d’abord le produit avant d’ajouter des photos.',
        );
        return;
      }

      try {
        const picked =
          await DocumentPicker.getDocumentAsync(
            {
              type: [
                'image/jpeg',
                'image/png',
                'image/webp',
              ],
              multiple: true,
              copyToCacheDirectory: true,
            },
          );

        if (picked.canceled) return;

        setBusy(true);
        setError('');

        for (const file of picked.assets) {
          await sellerApi.uploadMedia(
            productId,
            file.uri,
          );
        }

        const refreshed =
          await sellerApi.media(
            productId,
          );

        setMedia(
          Array.isArray(refreshed)
            ? refreshed
            : [],
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de supprimer la photo.',
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    };

  const publish =
    async () => {
      if (!productId) return;

      if (media.length < 3) {
        setError(
          'Ajoutez au moins 3 photos avant de publier le produit.',
        );
        return;
      }

      try {
        setBusy(true);
        setError('');

        const updated =
          await sellerApi.updateProductStatus(
            productId,
            'active',
          );

        setProduct(
          (current) => ({
            ...(current ?? {}),
            ...(updated ?? {}),
            status: 'active',
          }) as SellerProduct,
        );
      } catch (e: any) {
        setError(
          e?.message ??
            'Impossible de publier le produit.',
        );
      } finally {
        setBusy(false);
      }
    };

  const updateStatus =
    async (
      status:
        | 'paused'
        | 'archived',
    ) => {
      if (!productId) return;

      const label =
        status === 'paused'
          ? 'mettre en pause'
          : 'archiver';

      Alert.alert(
        status === 'paused'
          ? 'Mettre le produit en pause ?'
          : 'Archiver le produit ?',
        `Voulez-vous ${label} ce produit ?`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text:
              status === 'paused'
                ? 'Mettre en pause'
                : 'Archiver',
            style:
              status === 'archived'
                ? 'destructive'
                : 'default',
            onPress: async () => {
              try {
                setBusy(true);
                setError('');

                const updated =
                  await sellerApi.updateProductStatus(
                    productId,
                    status,
                  );

                setProduct(
                  (current) => ({
                    ...(current ?? {}),
                    ...(updated ?? {}),
                    status,
                  }) as SellerProduct,
                );
              } catch (e: any) {
                setError(
                  e?.message ??
                    'Impossible de modifier le statut du produit.',
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    };

  const addVariant =
    async () => {
      if (!productId) {
        setError(
          'Enregistrez d’abord le produit.',
        );
        return;
      }

      if (!variantForm.label.trim()) {
        setError(
          'Indiquez le nom de la variante.',
        );
        return;
      }

      const variantPrice =
        variantForm.price.trim()
          ? Number(
              variantForm.price,
            )
          : undefined;

      const variantStock =
        Number(
          variantForm.stock || 0,
        );

      if (
        variantPrice !== undefined &&
        (!Number.isInteger(
          variantPrice,
        ) ||
          variantPrice <= 0)
      ) {
        setError(
          'Le prix de la variante doit être un entier supérieur à zéro.',
        );
        return;
      }

      if (
        !Number.isInteger(
          variantStock,
        ) ||
        variantStock < 0
      ) {
        setError(
          'Le stock de la variante doit être un entier positif ou nul.',
        );
        return;
      }

      try {
        setAddingVariant(true);
        setError('');

        await sellerApi.createVariant(
          productId,
          {
            sku:
              variantForm.sku.trim() ||
              undefined,
            attributes: {
              name:
                variantForm.label.trim(),
            },
            price_xof:
              variantPrice,
            stock_qty:
              variantStock,
          },
        );

        setVariantForm({
          ...EMPTY_VARIANT,
        });

        const refreshed =
          await sellerApi.variants(
            productId,
          );

        setVariants(
          Array.isArray(refreshed)
            ? refreshed
            : [],
        );
      } catch (e: any) {
        setError(
          e?.message ??
            "Impossible d'ajouter la variante.",
        );
      } finally {
        setAddingVariant(false);
      }
    };

  const removeVariant =
    async (
      variant: ProductVariant,
    ) => {
      if (!productId) return;

      Alert.alert(
        'Retirer cette variante ?',
        'La variante sera archivée.',
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Retirer',
            style: 'destructive',
            onPress: async () => {
              try {
                setAddingVariant(true);
                setError('');

                await sellerApi.archiveVariant(
                  productId,
                  variant.id,
                );

                setVariants(
                  (current) =>
                    current.filter(
                      (item) =>
                        item.id !==
                        variant.id,
                    ),
                );
              } catch (e: any) {
                setError(
                  e?.message ??
                    'Impossible de retirer la variante.',
                );
              } finally {
                setAddingVariant(false);
              }
            },
          },
        ],
      );
    };

  const shareProduct =
    async () => {
      if (!productId) return;

      await Share.share({
        message: `${
          name || 'Mon produit'
        } sur LIVI : livi://product/${productId}`,
      });
    };

  const currentStatus =
    String(
      product?.status ??
        'draft',
    ).toLowerCase();

  const canPublish =
    Boolean(productId) &&
    media.length >= 3 &&
    currentStatus !== 'active';

  const statusLabel =
    currentStatus === 'active'
      ? 'Publié'
      : currentStatus === 'paused'
        ? 'En pause'
        : currentStatus === 'archived'
          ? 'Archivé'
          : 'Brouillon';

  const previewPrice =
    Number(price || 0);

  const pageTitle =
    productId
      ? 'Modifier le produit'
      : 'Nouveau produit';

  const photoProgress =
    `${media.length}/3`;

  const categoryName =
    useMemo(
      () =>
        categories.find(
          (category) =>
            category.id ===
            categoryId,
        )?.name,
      [categories, categoryId],
    );

  if (loading) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.loadingContainer
        }
      >
        <Skeleton
          height={40}
          width="65%"
          radius={radius.md}
        />

        <Skeleton
          height={240}
          radius={radius['2xl']}
        />

        <Skeleton
          height={230}
          radius={radius.xl}
        />

        <Skeleton
          height={180}
          radius={radius.xl}
        />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              CATALOGUE VENDEUR
            </Text>

            <Text style={styles.title}>
              {pageTitle}
            </Text>

            <Text style={styles.subtitle}>
              Construisez une fiche claire et complète
              pour vos clients.
            </Text>
          </View>

          {productId ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {statusLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.previewCard}>
          <View style={styles.previewTop}>
            <Text style={styles.previewEyebrow}>
              APERÇU
            </Text>

            {categoryName ? (
              <View style={styles.previewCategory}>
                <Text
                  style={
                    styles.previewCategoryText
                  }
                >
                  {categoryName}
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            numberOfLines={2}
            style={styles.previewName}
          >
            {name.trim() ||
              'Nom de votre produit'}
          </Text>

          {previewPrice > 0 ? (
            <Money
              amount={previewPrice}
              currency="FCFA"
              size="lg"
              color={colors.gold}
              style={styles.previewPrice}
            />
          ) : (
            <Text style={styles.previewPlaceholder}>
              Prix non renseigné
            </Text>
          )}

          <View style={styles.previewMeta}>
            <View>
              <Text style={styles.previewMetaLabel}>
                Stock
              </Text>

              <Text style={styles.previewMetaValue}>
                {stock || '0'}
              </Text>
            </View>

            <View>
              <Text style={styles.previewMetaLabel}>
                Photos
              </Text>

              <Text style={styles.previewMetaValue}>
                {photoProgress}
              </Text>
            </View>

            <View>
              <Text style={styles.previewMetaLabel}>
                Statut
              </Text>

              <Text style={styles.previewMetaValue}>
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <SectionHeader
            eyebrow="01"
            title="Informations essentielles"
            subtitle="Ce que vos clients verront en premier."
          />

          <Field
            label="Nom du produit"
            placeholder="Ex. Sac en cuir"
            value={name}
            onChangeText={setName}
          />

          <Field
            label="Description"
            placeholder="Décrivez les matières, dimensions, utilisation et avantages…"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.fieldLabel}>
            Catégorie
          </Text>

          {categories.length === 0 ? (
            <Text style={styles.noCategories}>
              Aucune catégorie disponible.
            </Text>
          ) : (
            <View style={styles.categories}>
              {categories.map(
                (category) => (
                  <CategoryChip
                    key={category.id}
                    category={category}
                    selected={
                      category.id ===
                      categoryId
                    }
                    onPress={() =>
                      setCategoryId(
                        category.id,
                      )
                    }
                  />
                ),
              )}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <SectionHeader
            eyebrow="02"
            title="Prix et stock"
            subtitle="Définissez les données commerciales du produit."
          />

          <Field
            label="Prix de vente"
            placeholder="Ex. 25000"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          <Field
            label="Stock disponible"
            placeholder="Ex. 10"
            value={stock}
            onChangeText={setStock}
            keyboardType="number-pad"
          />

          <View style={styles.priceHint}>
            <Text style={styles.priceHintText}>
              Le prix est enregistré en FCFA sur le
              contrat produit Livi.
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <SectionHeader
              eyebrow="03"
              title="Photos"
              subtitle={`Minimum requis pour publier : 3 photos · ${photoProgress}`}
            />

            {productId ? (
              <Pressable
                style={styles.smallAction}
                onPress={() =>
                  void addPhotos()
                }
                disabled={busy}
              >
                <Text
                  style={styles.smallActionText}
                >
                  + Ajouter
                </Text>
              </Pressable>
            ) : null}
          </View>

          {!productId ? (
            <View style={styles.lockedPhotos}>
              <View style={styles.lockedIcon}>
                <Text
                  style={styles.lockedIconText}
                >
                  2
                </Text>
              </View>

              <Text
                style={styles.lockedTitle}
              >
                Enregistrez d’abord le produit
              </Text>

              <Text
                style={styles.lockedText}
              >
                Les photos pourront être ajoutées juste
                après la création de la fiche.
              </Text>
            </View>
          ) : media.length === 0 ? (
            <Pressable
              style={styles.emptyMedia}
              onPress={() =>
                void addPhotos()
              }
              disabled={busy}
            >
              <View style={styles.emptyMediaIcon}>
                <Text
                  style={
                    styles.emptyMediaIconText
                  }
                >
                  +
                </Text>
              </View>

              <Text style={styles.emptyMediaTitle}>
                Ajouter les premières photos
              </Text>

              <Text style={styles.emptyMediaText}>
                JPG, PNG ou WebP.
              </Text>
            </Pressable>
          ) : (
            <View style={styles.mediaList}>
              {media.map((item) => (
                <MediaCard
                  key={String(item.id)}
                  item={item}
                  onDelete={() =>
                    void deleteMedia(item)
                  }
                />
              ))}
            </View>
          )}
        </View>

        {productId ? (
          <View style={styles.sectionCard}>
            <SectionHeader
              eyebrow="04"
              title="Variantes"
              subtitle="Tailles, couleurs ou modèles associés au produit."
            />

            {variants.length > 0 ? (
              <View style={styles.variantList}>
                {variants.map(
                  (variant) => (
                    <VariantCard
                      key={variant.id}
                      variant={variant}
                      onDelete={() =>
                        void removeVariant(
                          variant,
                        )
                      }
                    />
                  ),
                )}
              </View>
            ) : (
              <View style={styles.noVariants}>
                <Text
                  style={styles.noVariantsTitle}
                >
                  Aucune variante
                </Text>

                <Text
                  style={styles.noVariantsText}
                >
                  Ajoutez une variante lorsque votre
                  produit existe sous plusieurs formats.
                </Text>
              </View>
            )}

            <View style={styles.variantForm}>
              <Text
                style={styles.variantFormTitle}
              >
                Ajouter une variante
              </Text>

              <Field
                label="Nom"
                placeholder="Rouge · Taille M"
                value={variantForm.label}
                onChangeText={(value) =>
                  setVariantForm(
                    (current) => ({
                      ...current,
                      label: value,
                    }),
                  )
                }
              />

              <Field
                label="SKU (optionnel)"
                placeholder="Référence interne"
                value={variantForm.sku}
                onChangeText={(value) =>
                  setVariantForm(
                    (current) => ({
                      ...current,
                      sku: value,
                    }),
                  )
                }
              />

              <View style={styles.variantInputs}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Prix"
                    placeholder="Optionnel"
                    value={
                      variantForm.price
                    }
                    onChangeText={(value) =>
                      setVariantForm(
                        (current) => ({
                          ...current,
                          price: value,
                        }),
                      )
                    }
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Field
                    label="Stock"
                    placeholder="0"
                    value={
                      variantForm.stock
                    }
                    onChangeText={(value) =>
                      setVariantForm(
                        (current) => ({
                          ...current,
                          stock: value,
                        }),
                      )
                    }
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Button
                title={
                  addingVariant
                    ? 'Ajout…'
                    : 'Ajouter la variante'
                }
                variant="outline"
                disabled={
                  addingVariant ||
                  !variantForm.label.trim()
                }
                loading={addingVariant}
                onPress={() =>
                  void addVariant()
                }
                fullWidth
              />
            </View>
          </View>
        ) : null}

        <View style={styles.mainActions}>
          <Button
            title={
              busy
                ? 'Enregistrement…'
                : productId
                  ? 'Enregistrer les modifications'
                  : 'Créer le produit'
            }
            disabled={busy}
            loading={busy}
            onPress={() =>
              void save()
            }
            fullWidth
            size="lg"
          />

          {productId && canPublish ? (
            <Button
              title={
                busy
                  ? 'Publication…'
                  : 'Publier le produit'
              }
              disabled={busy}
              loading={busy}
              onPress={() =>
                void publish()
              }
              variant="secondary"
              fullWidth
            />
          ) : null}

          {productId &&
          currentStatus === 'active' ? (
            <Button
              title="Mettre le produit en pause"
              variant="outline"
              disabled={busy}
              onPress={() =>
                void updateStatus(
                  'paused',
                )
              }
              fullWidth
            />
          ) : null}

          {productId &&
          currentStatus === 'paused' ? (
            <Button
              title="Republier le produit"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                void publish()
              }
              fullWidth
            />
          ) : null}

          {productId &&
          currentStatus !== 'archived' ? (
            <Button
              title="Archiver le produit"
              variant="red"
              disabled={busy}
              onPress={() =>
                void updateStatus(
                  'archived',
                )
              }
              fullWidth
            />
          ) : null}

          {productId ? (
            <Button
              title="Partager le lien du produit"
              variant="outline"
              disabled={busy}
              onPress={() =>
                void shareProduct()
              }
              fullWidth
            />
          ) : null}
        </View>

        <Pressable
          style={styles.cancelButton}
          onPress={() =>
            navigation.goBack()
          }
          disabled={busy}
        >
          <Text style={styles.cancelText}>
            Retour
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          Les informations de cette fiche sont enregistrées
          sur le catalogue Livi.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginBottom: spacing[5],
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
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textMuted,
  },

  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  statusBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.gold,
  },

  errorBox: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.red,
  },

  previewCard: {
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  previewEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },

  previewCategory: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
  },

  previewCategoryText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.gold,
  },

  previewName: {
    marginTop: spacing[5],
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
    lineHeight: 25,
    color: colors.textPrimary,
  },

  previewPrice: {
    marginTop: spacing[2],
  },

  previewPlaceholder: {
    marginTop: spacing[2],
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  previewMeta: {
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },

  previewMetaLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },

  previewMetaValue: {
    marginTop: 2,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  sectionCard: {
    marginTop: spacing[5],
    padding: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionHeader: {
    marginBottom: spacing[4],
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  sectionEyebrow: {
    marginBottom: 3,
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.5,
    color: colors.gold,
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
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark4,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
  },

  textArea: {
    minHeight: 110,
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
  },

  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },

  categoryChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
  },

  categoryChipSelected: {
    backgroundColor: colors.goldDim,
    borderColor: colors.goldBorder,
  },

  categoryChipText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  categoryChipTextSelected: {
    fontFamily: fonts.bodySemibold,
    color: colors.gold,
  },

  noCategories: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  priceHint: {
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
  },

  priceHintText: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },

  smallAction: {
    marginTop: 2,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },

  smallActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.gold,
  },

  lockedPhotos: {
    minHeight: 170,
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.dark4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockedIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockedIconText: {
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  lockedTitle: {
    marginTop: spacing[3],
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  lockedText: {
    marginTop: 4,
    maxWidth: 280,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.textMuted,
  },

  emptyMedia: {
    minHeight: 190,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.goldBorder,
    backgroundColor: colors.dark4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyMediaIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyMediaIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xl,
    color: colors.gold,
  },

  emptyMediaTitle: {
    marginTop: spacing[3],
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  emptyMediaText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  mediaList: {
    gap: spacing[3],
  },

  mediaCard: {
    minHeight: 92,
    padding: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing[3],
  },

  mediaPreview: {
    width: 78,
    height: 78,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.dark2,
  },

  mediaImage: {
    width: '100%',
    height: '100%',
  },

  mediaPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mediaPlaceholderText: {
    fontFamily: fonts.brand,
    fontSize: fontSize.xl,
    color: colors.gold,
  },

  mediaContent: {
    flex: 1,
    justifyContent: 'center',
  },

  mediaTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  mediaSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  mediaDelete: {
    marginTop: spacing[2],
    alignSelf: 'flex-start',
  },

  mediaDeleteText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.red,
  },

  noVariants: {
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
  },

  noVariantsTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  noVariantsText: {
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
  },

  variantList: {
    gap: spacing[2],
  },

  variantCard: {
    minHeight: 68,
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },

  variantMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  variantIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  variantIconText: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },

  variantIdentity: {
    flex: 1,
  },

  variantTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  variantMeta: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  variantRight: {
    alignItems: 'flex-end',
    gap: spacing[2],
  },

  variantPrice: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },

  variantDelete: {
    paddingVertical: 2,
  },

  variantDeleteText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    color: colors.red,
  },

  variantForm: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  variantFormTitle: {
    marginBottom: spacing[4],
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  variantInputs: {
    flexDirection: 'row',
    gap: spacing[3],
  },

  mainActions: {
    marginTop: spacing[6],
    gap: spacing[3],
  },

  cancelButton: {
    minHeight: 46,
    marginTop: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  footer: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[2],
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
