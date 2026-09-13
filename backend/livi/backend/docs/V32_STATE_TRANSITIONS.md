# LIVI V32 — State transition audit

## Canonical order flow

`pending_payment -> payment_pending -> paid -> preparing -> shipping -> delivered -> completed`

Terminal/correction states include:

- `cancelled`
- `refunded`
- `disputed`

## Mandatory business rules

- `delivered` requires a valid buyer delivery proof.
- `completed` requires successful delivery.
- escrow release is tied to delivery confirmation.
- pickup must occur before delivery.
- a shipment cannot be reassigned after departure.
- terminal states cannot silently return to an earlier state.
- refund cannot recreate a released escrow.
- a second delivery confirmation must be rejected.

## V32 validation

The static audit scans the backend for the canonical states and the
delivery/escrow/refund guard mechanisms.

This is **not** a substitute for a PostgreSQL integration test. The
database-level transition tests must be executed on the disposable
PostgreSQL test environment before production approval.
