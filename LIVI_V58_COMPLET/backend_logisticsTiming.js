import { HttpError } from '../utils/http.js';

export const PREPARATION_OPTIONS_HOURS = [1, 2, 3, 4, 12, 24];

export function assertPreparationHours(value) {
  const n = Number(value);
  if (!PREPARATION_OPTIONS_HOURS.includes(n)) {
    throw new HttpError(422, 'Le délai de préparation doit être de 1 h, 2 h, 3 h, 4 h, 12 h ou 24 h.', 'INVALID_PREPARATION_TIME');
  }
  return n;
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

export function remainingShelfLifeHours(product, now = new Date()) {
  const expires = expiryAt(product);
  if (!expires) return null;
  return (expires.getTime() - new Date(now).getTime()) / 3600000;
}

export function assertPerishableCompatible(product, preparationHours, transitMaxMinutes, now = new Date()) {
  if (!product?.is_perishable) return;
  const remaining = remainingShelfLifeHours(product, now);
  if (remaining == null) {
    throw new HttpError(422, 'La durée de conservation du produit périssable est incomplète.', 'PERISHABLE_SHELF_LIFE_METADATA_REQUIRED');
  }
  const required = Number(preparationHours) + Number(transitMaxMinutes || 0) / 60;
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

export function calculateIntercityGuaranteeXof(cargoValueXof, { guarantee_bps, minimum_guarantee_xof }) {
  const cargo = BigInt(cargoValueXof);
  const bps = BigInt(guarantee_bps);
  const minimum = BigInt(minimum_guarantee_xof);
  const raw = (cargo * bps + 9999n) / 10000n;
  return raw > minimum ? raw : minimum;
}

export function calculateIntercityTransportCostXof(route, minimumTransportFeeXof = 1000) {
  const declaredTotal = BigInt(route?.fee_xof || 0);
  const breakdownTotal = BigInt(route?.fuel_cost_xof || 0) + BigInt(route?.operating_charges_xof || 0) + BigInt(route?.partner_service_fee_xof || 0);
  const minimum = BigInt(minimumTransportFeeXof || 1000);
  const base = breakdownTotal > 0n ? breakdownTotal : declaredTotal;
  return base > minimum ? base : minimum;
}

export function calculateIntercityShipping({ transportCostXof, guaranteeXof, minimumTransportFeeXof = 1000 }) {
  // The guarantee is a distinct security amount held with the shipment.
  // The operational transport price remains at least 1,000 XOF.
  // Total intercity logistics amount = operational transport + guarantee.
  const transport = BigInt(transportCostXof || 0);
  const guarantee = BigInt(guaranteeXof || 0);
  const minimum = BigInt(minimumTransportFeeXof || 1000);
  const routeCost = transport > minimum ? transport : minimum;
  return routeCost + guarantee;
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
