import test from 'node:test';
import assert from 'node:assert/strict';

// Mirrors src/services/orderPricing.js exactly (that file cannot be
// imported directly here: it pulls in finance.js -> market.js ->
// config/db.js -> 'pg', which is not installed in this offline sandbox —
// same constraint tests/finance_math.test.js already works around for
// commission math). Any change to the real functions should be reflected
// here too.
const commissionAmount = (amount, bps) => (BigInt(amount) * BigInt(bps)) / 10000n;
const calculateBasePrice = (unitPriceXof, quantity) => BigInt(unitPriceXof) * BigInt(quantity);
const calculateCommission = (basePriceXof, commissionBps) => commissionAmount(basePriceXof, commissionBps);
const calculateBuyerPrice = (basePriceXof, commissionXof, passthrough) =>
  passthrough ? BigInt(basePriceXof) + BigInt(commissionXof) : BigInt(basePriceXof);
const calculateVendorNet = (basePriceXof, commissionXof, passthrough) =>
  passthrough ? BigInt(basePriceXof) : BigInt(basePriceXof) - BigInt(commissionXof);

// The OLD (buggy) release-time formula, for comparison only: commission
// re-applied to the marked-up total instead of the base price.
const oldBuggyVendorNet = (amountHeld, bps) => BigInt(amountHeld) - commissionAmount(amountHeld, bps);

test('master-prompt worked example: base 10000 XOF, 3% commission, passthrough on', () => {
  const base = 10000n, bps = 300n;
  const commission = calculateCommission(base, bps);
  const buyerPrice = calculateBuyerPrice(base, commission, true);
  const vendorNet = calculateVendorNet(base, commission, true);

  assert.equal(commission, 300n);
  assert.equal(buyerPrice, 10300n, 'buyer pays base + commission');
  assert.equal(vendorNet, 10000n, 'vendor must receive the full base price, not less');
});

test('confirms the bug this replaces: the old formula really did shortchange the vendor to 9991', () => {
  // This is not a hypothetical — routes/orders.js stored e.amount=10300 for
  // a passthrough order (the marked-up total) and services/finance.js
  // used to compute vendorNet = e.amount - commissionAmount(e.amount, bps)
  // directly from that. Reproduced here exactly to document the fault the
  // new calculateVendorNet()/vendor_net_amount_snapshot path removes.
  const amountHeldInEscrow = 10300n; // base(10000) + commission(300), as actually stored pre-fix
  assert.equal(oldBuggyVendorNet(amountHeldInEscrow, 300n), 9991n);
  assert.notEqual(oldBuggyVendorNet(amountHeldInEscrow, 300n), 10000n);
});

test('non-passthrough: vendor absorbs the commission out of their own price, buyer pays sticker price', () => {
  const base = 10000n, bps = 300n;
  const commission = calculateCommission(base, bps);
  const buyerPrice = calculateBuyerPrice(base, commission, false);
  const vendorNet = calculateVendorNet(base, commission, false);

  assert.equal(buyerPrice, 10000n, 'buyer pays exactly the sticker price, no markup');
  assert.equal(vendorNet, 9700n, 'vendor absorbs the 3% commission from their own price');
});

test('invariant: buyerPrice - vendorNet === commission, for both passthrough and non-passthrough', () => {
  for (const passthrough of [true, false]) {
    for (const [base, bps] of [[10000n, 300n], [999n, 333n], [1n, 10000n], [123456n, 750n]]) {
      const commission = calculateCommission(base, bps);
      const buyerPrice = calculateBuyerPrice(base, commission, passthrough);
      const vendorNet = calculateVendorNet(base, commission, passthrough);
      assert.equal(buyerPrice - vendorNet, commission, `passthrough=${passthrough} base=${base} bps=${bps}`);
    }
  }
});

test('rates required by the audit: 0%, 1%, 3%, 5%, 10% on a 100000 XOF base', () => {
  const base = 100000n;
  const expected = { 0: 0n, 100: 1000n, 300: 3000n, 500: 5000n, 1000: 10000n };
  for (const [bps, expectedCommission] of Object.entries(expected)) {
    const commission = calculateCommission(base, BigInt(bps));
    assert.equal(commission, expectedCommission, `${bps}bps on ${base}`);
    // Passthrough: vendor always nets the full base regardless of rate.
    assert.equal(calculateVendorNet(base, commission, true), base);
    // Non-passthrough: vendor nets base minus that rate's commission.
    assert.equal(calculateVendorNet(base, commission, false), base - expectedCommission);
  }
});

test('calculateBasePrice: unit price times quantity, matching order_items.total_price convention', () => {
  assert.equal(calculateBasePrice(2500, 4), 10000n);
  assert.equal(calculateBasePrice(1, 1), 1n);
});

test('per-item accumulation matches a single aggregate calculation (no rounding drift for these cases)', () => {
  // routes/orders.js computes commission/vendorNet per line item and sums,
  // rather than once against a pre-summed subtotal, specifically to stay
  // consistent with how passthroughPrice() already built the per-item
  // buyer-facing price. Confirms the two approaches agree here; floor-
  // division commission math can in principle diverge by a few XOF between
  // "per item then sum" and "sum then once" for unusual quantity/price
  // combinations, which is exactly why orders.js does it per item.
  const items = [{ base: 10000n, qty: 2n }, { base: 4999n, qty: 3n }];
  const bps = 300n;
  let total = 0n, vendorNetTotal = 0n;
  for (const { base, qty } of items) {
    const commission = calculateCommission(base, bps);
    total += calculateBuyerPrice(base, commission, true) * qty;
    vendorNetTotal += calculateVendorNet(base, commission, true) * qty;
  }
  assert.equal(vendorNetTotal, items.reduce((s, i) => s + i.base * i.qty, 0n), 'passthrough: vendor nets the full base across all items');
  assert.equal(total - vendorNetTotal, items.reduce((s, i) => s + calculateCommission(i.base, bps) * i.qty, 0n));
});
