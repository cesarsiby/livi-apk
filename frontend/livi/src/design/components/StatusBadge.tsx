import React from 'react';
import { Badge } from './Badge';
import { getStatusMeta, StatusDomain } from '../status';

type Props = {
  /** Quelle famille de statut afficher — voir src/design/status.ts */
  domain: StatusDomain;
  status?: string | null;
  /** Surcharge ponctuelle du libellé (le badge garde la couleur du statut réel) */
  label?: string;
};

/**
 * Badge de statut unique pour toute l'app : commande, escrow, livraison,
 * retrait, litige, KYC, mission. Remplace les <Badge label={`… : ${x.status}`}
 * dispersés qui affichaient parfois la valeur technique brute du backend
 * directement à l'utilisateur (ex. "awaiting_payment").
 */
export function StatusBadge({ domain, status, label }: Props) {
  const meta = getStatusMeta(domain, status);
  return <Badge label={label ?? meta.label} variant={meta.variant} />;
}
