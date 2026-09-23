import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { sellerApi } from '../../features/seller/sellerApi';
import { normalizeList } from '../../services/api/normalize';
import {
  Button,
  Card,
  EmptyState,
  Screen,
  Skeleton,
} from '../../design/components';
import {
  colors,
  fonts,
  fontSize,
  radius,
  spacing,
} from '../../design/theme';

type InventoryItem = {
  id?: string | number;
  product_id?: string | number;
  name?: string | null;
  product_name?: string | null;
  quantity?: number | string | null;
  stock?: number | string | null;
};

function getProductId(item: InventoryItem): string {
  return String(item.product_id ?? item.id ?? '');
}

function getProductName(item: InventoryItem): string {
  return String(item.name ?? item.product_name ?? 'Produit');
}

function getStock(item: InventoryItem): number | null {
  const raw = item.quantity ?? item.stock;

  if (raw === null || raw === undefined || raw === '') return null;

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function InventoryRow({
  item,
  onSaved,
}: {
  item: InventoryItem;
  onSaved: () => Promise<void> | void;
}) {
  const initialStock = getStock(item);
  const [qty, setQty] = useState(
    initialStock === null ? '' : String(initialStock),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const productName = getProductName(item);
  const productId = getProductId(item);

  const parsedQty = useMemo(() => {
    if (!qty.trim()) return null;

    const value = Number(qty);

    if (!Number.isInteger(value) || value < 0) return null;
    return value;
  }, [qty]);

  const changed = parsedQty !== null && parsedQty !== initialStock;

  const save = useCallback(async () => {
    setMessage('');

    if (!productId) {
      setMessage('Produit introuvable.');
      return;
    }

    if (parsedQty === null) {
      setMessage('Saisissez une quantité entière supérieure ou égale à 0.');
      return;
    }

    setBusy(true);

    try {
      await sellerApi.updateStock(productId, parsedQty);
      setMessage('Stock enregistré.');
      await onSaved();
    } catch (e: any) {
      setMessage(
        e?.message ?? 'Impossible de mettre à jour le stock.',
      );
    } finally {
      setBusy(false);
    }
  }, [onSaved, parsedQty, productId]);

  const statusLabel =
    initialStock === null
      ? 'Stock non renseigné'
      : initialStock === 0
        ? 'Rupture'
        : initialStock <= 5
          ? 'Stock faible'
          : 'Disponible';

  const statusTone =
    initialStock === 0
      ? styles.statusDanger
      : initialStock !== null && initialStock <= 5
        ? styles.statusWarning
        : styles.statusNeutral;

  return (
    <Card style={styles.card} padded>
      <View style={styles.rowHeader}>
        <View style={styles.identity}>
          <View style={styles.productMark}>
            <Text style={styles.productMarkText}>
              {productName.slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={2}>
              {productName}
            </Text>
            <Text style={[styles.status, statusTone]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.currentStock}>
          <Text style={styles.currentStockValue}>
            {initialStock === null ? '—' : initialStock}
          </Text>
          <Text style={styles.currentStockLabel}>actuel</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.inputLabel}>Nouvelle quantité</Text>

      <View style={styles.editRow}>
        <View
          style={[
            styles.inputShell,
            message && !parsedQty ? styles.inputShellError : null,
          ]}
        >
          <TextInput
            value={qty}
            onChangeText={(value) => {
              setMessage('');
              setQty(value.replace(/[^\d]/g, ''));
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            maxLength={7}
            editable={!busy}
            accessibilityLabel={`Nouvelle quantité pour ${productName}`}
          />
          <Text style={styles.inputSuffix}>unités</Text>
        </View>

        <Pressable
          onPress={() => {
            if (initialStock === null) {
              setQty('0');
            } else {
              setQty(String(Math.max(0, initialStock - 1)));
            }
          }}
          disabled={busy || parsedQty === null || parsedQty <= 0}
          style={({ pressed }) => [
            styles.stepButton,
            (busy || parsedQty === null || parsedQty <= 0) &&
              styles.stepButtonDisabled,
            pressed && !busy ? styles.pressed : null,
          ]}
          accessibilityLabel="Diminuer la quantité"
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            const next = parsedQty ?? initialStock ?? 0;
            setQty(String(next + 1));
          }}
          disabled={busy}
          style={({ pressed }) => [
            styles.stepButton,
            pressed && !busy ? styles.pressed : null,
          ]}
          accessibilityLabel="Augmenter la quantité"
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      {message ? (
        <Text
          style={[
            styles.feedback,
            message === 'Stock enregistré.'
              ? styles.feedbackSuccess
              : styles.feedbackError,
          ]}
        >
          {message}
        </Text>
      ) : null}

      <Button
        title={busy ? 'Enregistrement…' : changed ? 'Enregistrer le stock' : 'Aucune modification'}
        onPress={save}
        disabled={busy || !changed}
        loading={busy}
        variant={changed ? 'primary' : 'secondary'}
        fullWidth
        size="md"
      />
    </Card>
  );
}

export function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError('');

    try {
      const response = await sellerApi.inventory();
      setItems(
        normalizeList<InventoryItem>(response, [
          'items',
          'inventory',
          'data',
        ]),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger l’inventaire.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <Skeleton width={110} height={12} radius={radius.pill} />
          <Skeleton width={220} height={32} radius={radius.md} />
          <Skeleton width="86%" height={18} radius={radius.md} />

          {[0, 1, 2].map((item) => (
            <View key={item} style={styles.loadingCard}>
              <Skeleton width="100%" height={154} radius={radius.xl} />
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          `${getProductId(item) || 'product'}-${index}`
        }
        contentContainerStyle={[
          styles.list,
          items.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>ESPACE VENDEUR</Text>
            <Text style={styles.pageTitle}>Inventaire</Text>
            <Text style={styles.subtitle}>
              Ajustez vos quantités sans perdre le contexte de chaque produit.
            </Text>

            {error ? (
              <Card style={styles.errorCard} padded>
                <Text style={styles.errorTitle}>Inventaire indisponible</Text>
                <Text style={styles.errorText}>{error}</Text>

                <Button
                  title="Réessayer"
                  onPress={() => load()}
                  variant="outline"
                  size="sm"
                />
              </Card>
            ) : null}

            {!error && items.length > 0 ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{items.length}</Text>
                  <Text style={styles.summaryLabel}>produits</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>
                    {items.reduce((total, item) => {
                      const stock = getStock(item);
                      return total + (stock === null ? 0 : stock);
                    }, 0)}
                  </Text>
                  <Text style={styles.summaryLabel}>unités suivies</Text>
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          error ? null : (
            <EmptyState
              icon="▦"
              title="Aucun produit à gérer"
              description="Vos produits apparaîtront ici pour ajuster leur stock rapidement."
            />
          )
        }
        renderItem={({ item }) => (
          <InventoryRow item={item} onSaved={() => load(true)} />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[3],
  },
  loadingCard: {
    marginTop: spacing[2],
  },
  list: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  listEmpty: {
    flexGrow: 1,
  },
  header: {
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    lineHeight: 38,
  },
  subtitle: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing[2],
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  summaryCard: {
    flex: 1,
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
  },
  summaryLabel: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  errorCard: {
    marginTop: spacing[3],
    gap: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(255,94,94,0.25)',
    backgroundColor: 'rgba(255,94,94,0.06)',
  },
  errorTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.sm,
  },
  errorText: {
    color: colors.gray2,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  card: {
    gap: spacing[3],
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  productMark: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  productMarkText: {
    color: colors.gold,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.lg,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  status: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSize.xs,
  },
  statusNeutral: {
    color: colors.gray3,
  },
  statusWarning: {
    color: colors.gold2,
  },
  statusDanger: {
    color: colors.red,
  },
  currentStock: {
    alignItems: 'flex-end',
    paddingLeft: spacing[2],
  },
  currentStockValue: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
  },
  currentStockLabel: {
    marginTop: 1,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  inputLabel: {
    color: colors.gray2,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.xs,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  inputShell: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputShellError: {
    borderColor: 'rgba(255,94,94,0.55)',
  },
  input: {
    flex: 1,
    minHeight: 48,
    padding: 0,
    color: colors.textPrimary,
    fontFamily: fonts.bodySemibold,
    fontSize: fontSize.md,
  },
  inputSuffix: {
    marginLeft: spacing[2],
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
  },
  stepButton: {
    width: 50,
    height: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  stepText: {
    color: colors.textPrimary,
    fontFamily: fonts.brandSemibold,
    fontSize: fontSize.xl,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  feedback: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  feedbackSuccess: {
    color: colors.gold2,
  },
  feedbackError: {
    color: colors.red,
  },
});
