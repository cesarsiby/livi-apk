import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, radius, spacing } from '../theme';
import { StatusBadge } from './StatusBadge';
import { formatMoney } from './Money';
import type { Order } from '../../features/orders/ordersApi';

type Props = { order: Order; onPress?: () => void };

// Prochaine action suggérée à l'acheteur selon orders.status (voir
// migrations/034_v50_status_enum_integrity.sql pour la liste exhaustive).
const NEXT_ACTION: Record<string, string> = {
  pending_payment: 'Finaliser le paiement',
  payment_pending: 'Paiement en cours de confirmation',
  paid: 'En attente de préparation par le vendeur',
  preparing: 'Le vendeur prépare la commande',
  shipping: 'Suivre la livraison',
  delivered: 'Confirmer la réception',
  disputed: 'Litige en cours',
};

/**
 * Carte commande unique de l'app (liste des commandes, accueil, historique).
 * Un seul statut mis en avant (order.status) plutôt que les 3 champs bruts
 * (status / payment_status / delivery_status) empilés — la vue détaillée
 * garde les 3 pour qui veut le détail complet.
 */
export function OrderCard({ order, onPress }: Props) {
  const status = order.status ?? '';
  const itemsCount = Array.isArray(order.items) ? order.items.length : undefined;
  const nextAction = NEXT_ACTION[status];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Text style={styles.reference} numberOfLines={1}>{order.reference ?? `Commande #${String(order.id).slice(0, 8)}`}</Text>
        <StatusBadge domain="order" status={status} />
      </View>
      <View style={styles.row}>
        <Text style={styles.meta}>{itemsCount != null ? `${itemsCount} article${itemsCount > 1 ? 's' : ''}` : 'Détails de la commande'}</Text>
        <Text style={styles.amount}>{formatMoney(order.total_amount ?? order.total, order.currency ?? 'FCFA')}</Text>
      </View>
      {nextAction ? <Text style={styles.nextAction}>→ {nextAction}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.dark3, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing[4], gap: spacing[2] },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  reference: { fontFamily: fonts.brandSemibold, fontSize: fontSize.base, color: colors.textPrimary, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.textMuted },
  amount: { fontFamily: fonts.bodyBold, fontSize: fontSize.base, color: colors.gold },
  nextAction: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: colors.blue, marginTop: 2 },
});
