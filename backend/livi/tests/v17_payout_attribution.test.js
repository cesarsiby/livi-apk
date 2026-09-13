import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('V17: payout settlement checks payable balance against payout owner', () => {
  // V36 note: this guard was originally inline SQL in src/routes/payouts.js.
  // V36's escrow<->ledger<->wallet audit consolidated it (and the identical
  // copy used at payout request creation) into a single shared function,
  // src/services/wallet.js#ledgerOwedToUser, to remove duplicated balance
  // logic that could silently drift apart. The guard itself — a payout can
  // only be settled against ledger entries owned by that payout's own
  // user_id — is unchanged; only its location moved. Verify both: the
  // shared function still ties account+owner together, and payouts.js
  // still calls it with the payout's own user_id (p.user_id), not a caller-
  // supplied or unrelated id.
  const walletSrc = fs.readFileSync(new URL('../src/services/wallet.js', import.meta.url), 'utf8');
  assert.match(walletSrc, /WHERE a\.code=\$1 AND le\.owner_user_id=\$2/);
  const routeSrc = fs.readFileSync(new URL('../src/routes/payouts.js', import.meta.url), 'utf8');
  assert.match(routeSrc, /ledgerOwedToUser\(c,acct,p\.user_id\)/);
});

test('V17: database migration contains payout owner guard', () => {
  const sql = fs.readFileSync(new URL('../migrations/014_v17_payout_attribution.sql', import.meta.url), 'utf8');
  assert.match(sql, /payout_settlement_owner_guard/);
  assert.match(sql, /Payout settlement payable owner mismatch/);
});
