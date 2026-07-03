# API and Structure Notes

## Current API Contract Direction

- `GET /api/transactions` returns display-ready feed data only.
- The feed item ID is a canonical transaction ID owned by this system, not a raw row ID or upstream `external_id`.
- Money should be represented as integer minor units in JSON, with care for values beyond JavaScript safe integers. Prefer a string-encoded integer amount for the public contract if large values are possible.
- Currency should be a schema-defined union, not an arbitrary string.
- Transaction dates should be date-only ISO strings, for example `2026-06-18`.
- Search should use explicit structured query params, for example `merchantQuery`, rather than a vague `q`.

## Pagination Decision

We decided not to include pagination in the first API contract. The seed data is small, and omitting pagination keeps the take-home contract easier to reason about while the cleaning and display model are still being shaped.

In a proper production system, this endpoint should add pagination before the dataset can grow without bound. A likely future shape is `limit` plus a stable cursor, with a response-level `nextCursor`.

## Package Structure Direction

- `@sofistic/api` owns frontend/backend interface contracts and schemas.
- `@sofistic/transactions-shared` owns internal transaction data structures.
- `@sofistic/transactions-clean` owns cleanup, dedupe, normalization, and search behavior.
- `@sofistic/transactions-db` owns storage concerns.
- `@sofistic/server` wires HTTP to the transaction modules.
- `@sofistic/web` owns the React UI.
