import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCart } from '../../features/cart/cartStore';
import { Button, EmptyState } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

export function CartScreen({ navigation }: any) {
  const { lines, subtotal, setQuantity, remove } = useCart();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panier</Text>
      <FlatList
        data={lines}
        keyExtractor={(x) => `${x.product.id}::${x.variant?.id ?? ''}`}
        renderItem={({ item }) => {
          const price = item.variant ? (item.variant.display_price_xof ?? item.variant.price_xof) : (item.product.display_price_xof ?? item.product.price_xof);
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.product.name ?? item.product.title ?? 'Produit'}</Text>
                {!!item.variant && <Text style={styles.meta}>{String((item.variant.attributes as any)?.name ?? item.variant.sku ?? 'Variante')}</Text>}
                <Text style={styles.meta}>{Number(price ?? 0).toLocaleString('fr-FR')} FCFA × {item.quantity}</Text>
              </View>
              <Pressable style={styles.qtyBtn} onPress={() => setQuantity(item.product.id, item.quantity - 1, item.variant?.id)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Pressable style={styles.qtyBtn} onPress={() => setQuantity(item.product.id, item.quantity + 1, item.variant?.id)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
              <Pressable onPress={() => remove(item.product.id, item.variant?.id)}>
                <Text style={styles.remove}>Supprimer</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyState icon="🛒" title="Votre panier est vide" description="Parcourez le catalogue pour trouver votre bonheur." actionLabel="Parcourir le catalogue" onAction={() => navigation.navigate('Catalogue')} />}
      />
      <View style={styles.footer}>
        <Text style={styles.total}>Total : {subtotal.toLocaleString('fr-FR')} FCFA</Text>
        <Button
          title="Passer au checkout"
          disabled={!lines.length}
          onPress={() => navigation.navigate('Checkout')}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark, padding: spacing[4] },
  title: {
    fontFamily: fonts.brand,
    fontSize: fontSize['3xl'],
    color: colors.textPrimary,
    marginBottom: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing[3],
  },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm, marginTop: 2 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: fontSize.md },
  remove: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: fontSize.sm },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted, fontFamily: fonts.body },
  footer: { paddingTop: spacing[4], gap: spacing[3] },
  total: { fontFamily: fonts.brand, fontSize: fontSize.xl, color: colors.gold },
});
