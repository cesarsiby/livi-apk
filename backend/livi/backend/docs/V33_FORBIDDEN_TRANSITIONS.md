# LIVI V33 — Forbidden transition audit

V33 adds a conservative static audit for dangerous direct state transitions.

Forbidden paths include:

- `pending_payment -> delivered`
- `payment_pending -> completed`
- `paid -> completed`
- `delivered -> preparing`
- `completed -> refunded`

The audit also requires evidence of:

- pickup handling;
- buyer delivery proof;
- escrow handling.

This is a source-level audit only. It does not replace PostgreSQL integration
tests. The real validation must attempt these transitions against a disposable
PostgreSQL database and assert that each transaction is rejected/rolled back.
