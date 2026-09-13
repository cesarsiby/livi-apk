# LIVI V34 — Inventory concurrency

## Required invariant

For any sellable product:

`available_quantity >= 0`

## Concurrent checkout scenario

Initial stock:

`1`

Two concurrent buyers attempt to reserve one unit each.

Required result:

- exactly one reservation succeeds;
- exactly one reservation fails;
- stock remains `0`;
- no negative quantity;
- no duplicate reservation;
- rollback restores the previous quantity if the order transaction fails.

## Production implementation requirement

The final PostgreSQL implementation must use an atomic transaction, for example:

- row-level locking (`SELECT ... FOR UPDATE`);
- or an atomic conditional update;
- plus a database `CHECK` constraint preventing negative stock.

The API must never perform a separate read followed by a separate write
without a transaction/locking strategy.

V34 provides a source-level audit. The real concurrent test must be run
against a disposable PostgreSQL database with two independent connections.
