import { HttpError } from '../utils/http.js';

export const PREPARATION_OPTIONS_HOURS = [1, 2, 3, 4, 12, 24];
export const SHELF_LIFE_REFERENCE_TYPES = ['harvest', 'production', 'packaging', 'preparation'];

export function assertPreparationHours(value) {
  const n = Number(value);
  if (!PREPARATION_OPTIONS_HOURS.includes(n)) {
    throw new HttpError(422, 'Le délai de préparation doit être de 1 h, 2 h, 3 h, 4 h, 12 h ou 24 h.', 'INVALID_PREPARATION_TIME');
  }
  return n;
}

export function assertShelfLifeReferenceType(value) {
  if (!SHELF_LIFE_REFERENCE_TYPES.includes(String(value))) {
    throw new HttpError(422, 'La base de départ de la durée de conservation est invalide.', 'INVALID_SHELF_LIFE_REFERENCE_TYPE');
  }
  return String(value);
}

export function addMinutes(dateLike, minutes) {
  const date = new Date(dateLike);
  date.setTime(date.getTime() + Number(minutes) * 60 * 1000);
  return date;
}

export function addHours(dateLike, hours) {
  return addMinutes(dateLike, Number(hours) * 60);
}

export function expiryAt({ shelf_life_reference_at, shelf_life_hours }) {
  if (!shelf_life_reference_at || shelf_life_hours == null) return null;
  return addHours(shelf_life_reference_at, Number(shelf_life_hours));
}

export function effectiveShelfLifeReference(product, { preparationStartedAt = null, preparationReadyAt = null, now = new Date() } = {}) {
  const type = String(product?.shelf_life_reference_type || '');
  if (type === 'preparation') return preparationReadyAt ? new Date(preparationReadyAt) : (preparationStartedAt ? addHours(preparationStartedAt, Number(product?.preparation_time_hours || 0)) : null);
  return product?.shelf_life_reference_at ? new Date(product.shelf_life_reference_at) : null;
}

export function remainingShelfLifeHours(product, now = new Date(), options = {}) {
  const type = String(product?.shelf_life_reference_type || '');
  if (type === 'preparation' && !options.preparationStartedAt) {
    // The clock has not started yet. The remaining shelf-life at the start
    // of preparation is the full declared shelf life.
    return product?.shelf_life_hours == null ? null : Number(product.shelf_life_hours);
  }
  const reference = effectiveShelfLifeReference(product, options);
  if (!reference || product?.shelf_life_hours == null) return null;
  return (addHours(reference, Number(product.shelf_life_hours)).getTime() - new Date(now).getTime()) / 3600000;
}

/**
 * Validate a perishable line against the part of the clock that remains.
 * Before preparation has started, a preparation-based shelf life is not
 * consumed by preparation itself. For a harvest/production/packaging basis,
 * elapsed time before preparation does consume the shelf life.
 */
export function assertPerishableCompatible(product, preparationHours, transitMaxMinutes, now = new Date(), { preparationStartedAt = null, preparationReadyAt = null } = {}) {
  if (!product?.is_perishable) return;
  const shelfHours = Number(product.shelf_life_hours);
  const referenceType = String(product.shelf_life_reference_type || '');
  if (!Number.isFinite(shelfHours) || shelfHours <= 0 || !SHELF_LIFE_REFERENCE_TYPES.includes(referenceType)) {
    throw new HttpError(422, 'La durée de conservation du produit périssable est incomplète.', 'PERISHABLE_SHELF_LIFE_METADATA_REQUIRED');
  }
  if (referenceType !== 'preparation' && !product.shelf_life_reference_at) {
    throw new HttpError(422, 'La date de référence de conservation du produit périssable est obligatoire.', 'PERISHABLE_SHELF_LIFE_METADATA_REQUIRED');
  }

  const transitHours = Number(transitMaxMinutes || 0) / 60;
  const prepHours = Number(preparationHours || 0);
  const started = preparationStartedAt ? new Date(preparationStartedAt) : null;
  const ready = preparationReadyAt ? new Date(preparationReadyAt) : null;
  const current = new Date(now);

  if (referenceType === 'preparation' && !started) {
    // At checkout / quote time, preparation itself occurs before the shelf-life
    // clock starts. Only the post-preparation transit window is reserved.
    if (shelfHours < transitHours) {
      throw new HttpError(409, `La durée de conservation (${shelfHours.toFixed(1)} h) est insuffisante pour le transport prévu (${transitHours.toFixed(1)} h).`, 'PERISHABLE_SHELF_LIFE_INSUFFICIENT');
    }
    return;
  }

  const reference = referenceType === 'preparation' ? (ready || (started ? addHours(started, prepHours) : addHours(current, prepHours))) : new Date(product.shelf_life_reference_at);
  const expires = addHours(reference, shelfHours);
  const remaining = (expires.getTime() - current.getTime()) / 3600000;
  const preparationAlreadyDone = !!ready && current.getTime() >= ready.getTime();
  const required = preparationAlreadyDone ? transitHours : prepHours + transitHours;
  if (remaining < required) {
    throw new HttpError(409, `Le délai restant de conservation (${Math.max(0, remaining).toFixed(1)} h) est insuffisant pour la préparation et le transport prévus (${required.toFixed(1)} h).`, 'PERISHABLE_SHELF_LIFE_INSUFFICIENT');
  }
}

export async function loadUrbanTransit(c, distanceKm) {
  const query = distanceKm == null
    ? `SELECT * FROM urban_delivery_time_rules WHERE active=true AND effective_from<=now() AND min_distance_km=0 AND max_distance_km IS NULL ORDER BY effective_from DESC LIMIT 1`
    : `SELECT * FROM urban_delivery_time_rules WHERE active=true AND effective_from<=now() AND min_distance_km <= $1 AND (max_distance_km IS NULL OR $1 <= max_distance_km) ORDER BY min_distance_km DESC,effective_from DESC LIMIT 1`;
  const row = (await c.query(query, distanceKm == null ? [] : [distanceKm])).rows[0];
  if (!row) throw new HttpError(409, 'Le délai de livraison urbaine n’est pas configuré pour cette distance.', 'URBAN_TRANSIT_RULE_NOT_CONFIGURED');
  return { minMinutes: Number(row.transit_min_minutes), maxMinutes: Number(row.transit_max_minutes), ruleId: row.id };
}

export async function loadIntercityPricing(c) {
  const row = (await c.query(`SELECT * FROM intercity_pricing_rules WHERE active=true AND effective_from<=now() ORDER BY effective_from DESC LIMIT 1`)).rows[0];
  if (!row) throw new HttpError(409, 'La règle de garantie interville n’est pas configurée.', 'INTERCITY_GUARANTEE_RULE_NOT_CONFIGURED');
  return row;
}

export function calculateIntercityGuaranteeXof(cargoValueXof, { guarantee_bps }) {
  const cargo = BigInt(cargoValueXof);
  const bps = BigInt(guarantee_bps);
  if (cargo < 0n || bps < 0n) throw new HttpError(422, 'Valeur de marchandise ou taux de garantie invalide.', 'INTERCITY_GUARANTEE_INVALID');
  // XOF is stored as an integer. Ceiling is a technical rounding rule only;
  // there is no minimum guarantee amount.
  return (cargo * bps + 9999n) / 10000n;
}

export function calculateIntercityTransportCostXof(route, minimumTransportFeeXof = 1000) {
  const minimum = BigInt(minimumTransportFeeXof || 1000);
  const fuel = BigInt(route?.fuel_cost_xof || 0);
  const operatingCharges = BigInt(route?.operating_charges_xof || 0);
  const partnerCharges = BigInt(route?.partner_service_fee_xof || 0);
  if (fuel < 0n || operatingCharges < 0n || partnerCharges < 0n || minimum < 0n) throw new HttpError(422, 'Coût de transport invalide.', 'INTERCITY_TRANSPORT_COST_INVALID');
  // Authoritative user-defined rule: fuel + minimum delivery fee + charges.
  // Partner service cost is a charge component; legacy fee_xof is not a second source of truth.
  return fuel + minimum + operatingCharges + partnerCharges;
}

export function calculateIntercityShipping({ transportCostXof, routeFeeXof } = {}) {
  // routeFeeXof is accepted only for backward compatibility with the V58 call site.
  // Return the scalar buyer transport charge; the partner guarantee is excluded.
  return BigInt(transportCostXof ?? routeFeeXof ?? 0);
}

export async function selectIntercityOriginLocation(c, partnerId, city) {
  const row = (await c.query(`SELECT id FROM partner_locations WHERE partner_id=$1 AND status='active' AND lower(city)=lower($2) AND location_type IN ('depot','both') ORDER BY location_type='both' DESC,created_at ASC LIMIT 1`, [partnerId, city])).rows[0];
  if (!row) throw new HttpError(409, 'Aucun point de départ partenaire n’est configuré dans la ville d’origine.', 'INTERCITY_ORIGIN_LOCATION_NOT_CONFIGURED');
  return row.id;
}

export async function assertIntercityDestinationLocation(c, { partnerId, destinationCity, destinationLocationId }) {
  const row = (await c.query(`SELECT id FROM partner_locations WHERE id=$1 AND partner_id=$2 AND lower(city)=lower($3) AND status='active' AND location_type IN ('pickup','both')`, [destinationLocationId, partnerId, destinationCity])).rows[0];
  if (!row) throw new HttpError(422, 'Point de retrait interville invalide.', 'INTERCITY_DESTINATION_LOCATION_INVALID');
  return row.id;
}
