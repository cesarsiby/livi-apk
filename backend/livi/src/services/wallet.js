import { ACCOUNT } from './market.js';

// V36 — single source of truth for "how much can this user actually move".
//
// AUDIT FINDING that motivated this file: the `wallets` table
// (available_amount / locked_amount) is created at signup and then NEVER
// updated anywhere in the codebase. `GET /escrow/balance` was reading from
// it directly, so it always returned 0 regardless of real activity — a
// silent, user-facing financial display bug (not a fund-movement bug: all
// actual money movement already correctly uses `ledger_entries`, see
// src/routes/payouts.js, which is why this bug was never caught by a
// payout failing — it only affected what buyers/vendors/transporters SAW).
//
// The real, correct source of truth has always been the double-entry
// ledger: `ledger_entries` grouped by (account_id via code, owner_user_id).
// This function is the one formula for that computation. It is used by:
//   - src/routes/payouts.js (both at payout request creation and at
//     admin settlement — previously two independent inline copies of the
//     same query, now this single function)
//   - src/routes/escrow.js (GET /balance, previously reading the dead
//     `wallets` table)
//
// role -> ledger account code mapping. Only vendor/transporter accounts
// are "payable" accounts a user can withdraw from.
const PAYABLE_ACCOUNT_BY_ROLE = {
  vendor: ACCOUNT.vendor,
  transporter: ACCOUNT.transporter
};

/**
 * Ledger balance for a payable account owned by a user.
 * Ledger entries are signed such that a payable account's balance is
 * negative while funds are owed to the user (see finance.js releaseEscrow /
 * payouts.js payout_settlement) — so "amount owed to the user" is
 * `-sum(ledger_entries.amount)`. Returns a BigInt.
 */
export async function ledgerOwedToUser(c, accountCode, userId) {
  const row = (await c.query(
    `SELECT coalesce(sum(le.amount),0)::bigint amount
     FROM ledger_entries le
     JOIN ledger_accounts a ON a.id = le.account_id
     WHERE a.code=$1 AND le.owner_user_id=$2`,
    [accountCode, userId]
  )).rows[0];
  return -BigInt(row.amount);
}

/** Sum of amounts already reserved by pending/processing payout requests. */
export async function reservedPayoutAmount(c, userId) {
  const row = (await c.query(
    `SELECT coalesce(sum(amount),0)::bigint amount
     FROM payout_requests WHERE user_id=$1 AND status IN ('pending','processing')`,
    [userId]
  )).rows[0];
  return BigInt(row.amount);
}

/**
 * Full withdrawable-balance breakdown for a vendor/transporter:
 *   owed      = total ever credited to this user's payable account (ledger truth)
 *   reserved  = already tied up in a pending/processing payout request
 *   available = owed - reserved (what a NEW payout request may draw against)
 * Returns null for roles with no payable account (e.g. buyer).
 */
export async function payableBalance(c, role, userId) {
  const accountCode = PAYABLE_ACCOUNT_BY_ROLE[role];
  if (!accountCode) return null;
  const owed = await ledgerOwedToUser(c, accountCode, userId);
  const reserved = await reservedPayoutAmount(c, userId);
  const available = owed - reserved;
  return { owed, reserved, available: available < 0n ? 0n : available };
}

/**
 * Buyer-side position: funds currently held on the buyer's behalf across
 * their own not-yet-settled escrows (funded/disputed). This is informational
 * (buyers do not withdraw from LIVI) — it answers "how much of my money is
 * currently in escrow for orders in progress".
 */
export async function buyerEscrowPosition(c, userId) {
  const row = (await c.query(
    `SELECT coalesce(sum(amount),0)::bigint principal,
            coalesce(sum(shipping_fee),0)::bigint shipping_fee,
            count(*)::int order_count
     FROM escrow_transactions
     WHERE buyer_id=$1 AND status IN ('funded','disputed')`,
    [userId]
  )).rows[0];
  return {
    in_escrow_principal: BigInt(row.principal),
    in_escrow_shipping: BigInt(row.shipping_fee),
    active_order_count: row.order_count
  };
}
