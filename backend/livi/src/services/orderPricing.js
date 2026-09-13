import { commissionAmount } from './finance.js';

// V-AUDIT (correction financière critique — commission): four explicit
// functions instead of the commission math being implicit in two places
// (order pricing here, escrow release in finance.js) that could drift
// apart. This is the fix for a confirmed bug: when a vendor passes the
// commission on to the buyer (commission_passthrough=true), the buyer
// pays base+commission, but src/services/finance.js#releaseEscrow used to
// apply the commission RATE again to that already-marked-up total instead
// of the original base — e.g. base=10000, commission=3% (300): buyer pays
// 10300, but the vendor was paid 10300 - commissionAmount(10300,300) =
// 10300-309 = 9991, not the 10000 they were supposed to keep in full. The
// comment that used to sit on passthroughPrice() below claimed "no change
// needed there", which was incorrect — verified by tracing the actual
// numbers through routes/orders.js and services/finance.js, not assumed.
//
// The fix (routes/orders.js order creation + services/finance.js release)
// snapshots vendor_net_amount_snapshot directly on escrow_transactions at
// order-creation time, computed with calculateVendorNet() below, so
// release no longer re-derives it from a possibly-marked-up amount or a
// possibly-since-changed commission rate (see also section 22 — a
// commission rate must be locked in at order creation, not re-fetched at
// release, independently of the passthrough bug above).

// The vendor's own price for a line, before any commission is added.
export function calculateBasePrice(unitPriceXof, quantity) {
  return BigInt(unitPriceXof) * BigInt(quantity);
}

// Platform's cut on a given base amount. Thin, explicitly-named wrapper
// around finance.js#commissionAmount (kept as the one place the actual
// floor-division arithmetic lives, so this and releaseEscrow() can never
// compute commission two different ways).
export function calculateCommission(basePriceXof, commissionBps) {
  return commissionAmount(basePriceXof, commissionBps);
}

// What the buyer actually pays: base + commission when the vendor passes
// it through, otherwise exactly the base price.
export function calculateBuyerPrice(basePriceXof, commissionXof, passthrough) {
  return passthrough ? BigInt(basePriceXof) + BigInt(commissionXof) : BigInt(basePriceXof);
}

// What the vendor actually nets: the full base price when the buyer
// covered the commission (passthrough), otherwise base minus commission
// (the vendor absorbs it out of their own price). In both cases
// buyerPrice - vendorNet === commission — the platform's cut is always
// that difference, which is exactly how releaseEscrow() now derives it
// (residual, not recomputed independently) so the two can never fail to
// add back up to the amount actually held in escrow.
export function calculateVendorNet(basePriceXof, commissionXof, passthrough) {
  return passthrough ? BigInt(basePriceXof) : BigInt(basePriceXof) - BigInt(commissionXof);
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function activeCommissionBps(c) {
  const row = (
    await c.query(
      `SELECT commission_bps FROM platform_fee_rules WHERE active=true AND effective_from<=now() ORDER BY effective_from DESC LIMIT 1`
    )
  ).rows[0];
  return row ? Number(row.commission_bps) : 0;
}

// Buyer-facing price when the vendor passes the commission through. Kept in
// XOF integers throughout (no floats), matching the rest of the money code.
export function passthroughPrice(basePriceXof, commissionBps) {
  return Number(BigInt(basePriceXof) + commissionAmount(basePriceXof, commissionBps));
}

export async function computeDeliveryFee(c, { vendorId, addressId }) {
  const rule = (
    await c.query(
      `SELECT * FROM delivery_fee_rules WHERE active=true AND effective_from<=now() ORDER BY effective_from DESC LIMIT 1`
    )
  ).rows[0];
  // No rule configured at all: honest zero rather than an invented number —
  // matches the project-wide rule against fabricating financial values.
  if (!rule) return { fee_xof: 0, distance_km: null, rule_id: null };

  const vendor = (await c.query('SELECT latitude,longitude FROM vendors WHERE id=$1', [vendorId])).rows[0];
  const addr = (await c.query('SELECT latitude,longitude FROM user_addresses WHERE id=$1', [addressId])).rows[0];

  let distanceKm = null;
  if (vendor?.latitude != null && vendor?.longitude != null && addr?.latitude != null && addr?.longitude != null) {
    distanceKm = haversineKm(Number(vendor.latitude), Number(vendor.longitude), Number(addr.latitude), Number(addr.longitude));
  }

  // Vendor or buyer hasn't set coordinates yet: charge the base fee only,
  // rather than failing the order or guessing a distance. Both vendor and
  // address forms should now collect coordinates going forward (see
  // VehicleScreen-style profile completeness work), which will make this
  // fallback progressively rarer instead of a permanent gap.
  let fee = Number(rule.base_fee_xof);
  if (distanceKm != null) fee += Math.ceil(distanceKm) * Number(rule.per_km_fee_xof);
  if (rule.max_fee_xof != null) fee = Math.min(fee, Number(rule.max_fee_xof));

  return { fee_xof: fee, distance_km: distanceKm, rule_id: rule.id };
}
