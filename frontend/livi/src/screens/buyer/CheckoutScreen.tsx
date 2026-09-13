import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCart } from '../../features/cart/cartStore';
import { checkoutApi, Address, PaymentMethod, OrderQuote } from '../../features/checkout/checkoutApi';
import { normalizeList } from '../../services/api/normalize';
import { Button } from '../../design/components';
import { colors, fonts, fontSize, radius, spacing } from '../../design/theme';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, feuille de route priorité 1 — bug le
// plus grave trouvé cette session, constat C0) : GET /users/me/addresses
// et GET /users/me/payment-methods renvoient tous deux un tableau brut une
// fois déballé par apiRequest() (mêmes routes que AddressesScreen /
// PaymentMethodsScreen, routes/compatibility.js, `ok(res, rows)`).
// `a?.addresses ?? a?.data ?? []` et `p?.payment_methods ?? p?.methods ??
// p?.data ?? []` retombaient donc toujours sur [] — ce qui, combiné à
// `disabled={!addresses.length || !payments.length}` sur le bouton de
// paiement, rendait le checkout DÉFINITIVEMENT IMPOSSIBLE À VALIDER,
// quelles que soient les adresses/moyens de paiement réellement enregistrés
// par l'acheteur. Corrigé avec normalizeList().
//
// Ajout : explication de la protection des fonds avant paiement (§18 de la
// mission — "comment la transaction est protégée" devait apparaître dans
// la hiérarchie du checkout, elle en était absente).
export function CheckoutScreen({ navigation }: any) {
  const { lines, subtotal, clear } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [addressId, setAddressId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [paying, setPaying] = useState(false);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    if (!lines.length) { navigation.replace('Cart'); return; }
    Promise.all([checkoutApi.addresses(), checkoutApi.paymentMethods()]).then(([a, p]) => {
      const aa = normalizeList<Address>(a, ['addresses', 'data']);
      const pp = normalizeList<PaymentMethod>(p, ['payment_methods', 'methods', 'data']);
      setAddresses(aa); setPayments(pp);
      if (aa[0]) setAddressId(String(aa[0].id));
      if (pp[0]) setPaymentId(String(pp[0].id));
    }).catch((e) => setLoadError(e?.message ?? 'Impossible de charger le checkout.')).finally(() => setLoading(false));
  }, []);

  // V54 (RAPPORT — "COMMANDE ET FRAIS"): shows the real, server-computed
  // breakdown (price + distance-based delivery fee = total) as soon as an
  // address is picked, instead of only the cart subtotal — the delivery fee
  // used to be hardcoded to 0 and was never shown at all.
  useEffect(() => {
    if (!addressId || !lines.length) { setQuote(null); return; }
    setQuoting(true);
    checkoutApi.quote(lines, addressId)
      .then(setQuote)
      .catch(() => setQuote(null))
      .finally(() => setQuoting(false));
  }, [addressId, lines]);

  async function pay() {
    if (!addressId || !paymentId) { Alert.alert('Checkout', 'Sélectionnez une adresse et un moyen de paiement.'); return; }
    try {
      setPaying(true);
      const order = await checkoutApi.createOrder(lines, addressId, paymentId);
      const orderId = (order as any)?.id ?? (order as any)?.order?.id;
      if (!orderId) throw new Error("La commande n'a pas retourné d'identifiant.");
      // V54: was `subtotal` (cart-only, no delivery fee) — the amount sent
      // to payment initiation must match the order's real total_amount
      // (product price + delivery fee), which the backend now computes
      // authoritatively and returns on the created order.
      const amount = Number((order as any)?.total_amount ?? quote?.total_xof ?? subtotal);
      const payment = await checkoutApi.initPayment(String(orderId), amount, paymentId);
      const ref = (payment as any)?.reference ?? (payment as any)?.payment_reference ?? (payment as any)?.id;
      if (!ref) throw new Error("Le paiement n'a pas retourné de référence.");
      clear();
      navigation.replace('OrderDetails', { orderId });
    } catch (e: any) {
      Alert.alert('Paiement impossible', e?.message ?? "Impossible d'initialiser le paiement.");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checkout sécurisé</Text>
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      <View style={styles.breakdown}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Sous-total produits</Text>
          <Text style={styles.breakdownValue}>{(quote?.subtotal_xof ?? subtotal).toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Frais de livraison{quote?.distance_km != null ? ` (${quote.distance_km.toFixed(1)} km)` : ''}</Text>
          <Text style={styles.breakdownValue}>{quoting ? '…' : quote ? `${quote.shipping_fee_xof.toLocaleString('fr-FR')} FCFA` : '—'}</Text>
        </View>
        <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
          <Text style={styles.total}>Total à payer</Text>
          <Text style={styles.total}>{quote ? `${quote.total_xof.toLocaleString('fr-FR')} FCFA` : `${subtotal.toLocaleString('fr-FR')} FCFA`}</Text>
        </View>
      </View>

      <Text style={styles.section}>Adresse de livraison</Text>
      {addresses.length === 0 ? (
        <Pressable style={styles.emptyLink} onPress={() => navigation.navigate('Addresses')}>
          <Text style={styles.emptyLinkText}>+ Ajouter une adresse de livraison</Text>
        </Pressable>
      ) : addresses.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => setAddressId(String(a.id))}
          style={[styles.option, addressId === String(a.id) && styles.selected]}
        >
          <Text style={styles.bold}>{a.label ?? a.name ?? 'Adresse'}</Text>
          <Text style={styles.meta}>{a.address ?? (a as any).address_line ?? a.line1 ?? a.city ?? ''}</Text>
        </Pressable>
      ))}

      <Text style={styles.section}>Mode de paiement</Text>
      {payments.length === 0 ? (
        <Pressable style={styles.emptyLink} onPress={() => navigation.navigate('PaymentMethods')}>
          <Text style={styles.emptyLinkText}>+ Ajouter un moyen de paiement</Text>
        </Pressable>
      ) : payments.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => setPaymentId(String(p.id))}
          style={[styles.option, paymentId === String(p.id) && styles.selected]}
        >
          <Text style={styles.bold}>{p.label ?? p.type ?? 'Moyen de paiement'}</Text>
          <Text style={styles.meta}>{p.last4 ? `•••• ${p.last4}` : ''}</Text>
        </Pressable>
      ))}

      <View style={styles.protection}>
        <Text style={styles.protectionIcon}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.protectionTitle}>Paiement protégé</Text>
          <Text style={styles.protectionText}>Votre argent est retenu par LIVI jusqu'à la confirmation de réception — le vendeur n'est payé qu'une fois la commande bien arrivée.</Text>
        </View>
      </View>

      <Button
        title={paying ? 'Traitement…' : 'Payer et sécuriser la commande'}
        disabled={paying || !addresses.length || !payments.length}
        loading={paying}
        onPress={pay}
        size="lg"
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark, padding: spacing[4], gap: spacing[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  title: { fontFamily: fonts.brand, fontSize: fontSize['3xl'], color: colors.textPrimary },
  breakdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.dark3,
    padding: spacing[4],
    gap: spacing[2],
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm },
  breakdownValue: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: fontSize.sm },
  breakdownTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[2], marginTop: spacing[1] },
  total: { fontFamily: fonts.brandSemibold, fontSize: fontSize.xl, color: colors.gold },
  section: { fontFamily: fonts.brandSemibold, fontSize: fontSize.lg, color: colors.textPrimary, marginTop: spacing[2] },
  option: {
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.dark3,
  },
  selected: { borderColor: colors.gold, borderWidth: 2, backgroundColor: colors.goldDim },
  bold: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, color: colors.gray2, fontSize: fontSize.sm, marginTop: 2 },
  error: { color: colors.red, fontFamily: fonts.body },
  emptyLink: {
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    alignItems: 'center',
  },
  emptyLinkText: { color: colors.gold, fontFamily: fonts.bodySemibold },
  protection: {
    flexDirection: 'row',
    gap: spacing[3],
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[4],
    marginTop: spacing[2],
    alignItems: 'flex-start',
  },
  protectionIcon: { fontSize: fontSize.lg },
  protectionTitle: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: fontSize.sm },
  protectionText: { fontFamily: fonts.body, color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
});
