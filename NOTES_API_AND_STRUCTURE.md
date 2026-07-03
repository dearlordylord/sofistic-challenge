# API and Structure Notes

## Decision Process

We started from the README acceptance criteria: the frontend must fetch from the backend, search should update on change without stale results, duplicate transactions must be suppressed, merchant names must be normalized, and all cleaning/search logic must stay server-side.

We compared the starter repo against the stronger `../luigi*` structure. The useful part to copy was not the exact domain shape, but the discipline: typed package seams, shared schemas at the frontend/backend interface, pure domain modules, storage adapters, and repo-level build/typecheck/test/lint gates.

We then chose a smaller package split than Luigi:

- `api` for the public HTTP interface.
- `web` for the React client.
- `server` for HTTP wiring.
- `transactions-shared` for internal transaction data structures.
- `transactions-clean` for cleanup, dedupe, normalization, and search.
- `transactions-db` for storage concerns.

For the feed contract, we deliberately kept the main endpoint narrow. The UI should receive display-ready data, while cleanup provenance, raw rows, duplicate groups, and mapping decisions remain behind server-side modules or future audit endpoints.

During the API grill, we made these contract decisions in order:

1. The feed response is display-only.
2. Feed item IDs are canonical transaction IDs owned by this system.
3. Money should use integer minor units, with JSON-safe handling for values that may exceed JavaScript safe integers.
4. Currency should be a schema-defined union.
5. Dates should be date-only ISO strings after reconsidering the seed data.
6. Search should use explicit structured query params.
7. Pagination is intentionally excluded from the first contract.

## Current API Contract Direction

- `GET /api/transactions` returns display-ready feed data only.
- The feed item ID is a canonical transaction ID owned by this system, not a raw row ID or upstream `external_id`.
- Feed items are `{ id, transactionDate, merchant, amountMinor, currency, category }`.
- Money is represented as `amountMinor`, a string-encoded integer minor-unit value such as `"-1798"`.
- Currency is the schema-defined union `"CAD"` for the first version.
- Transaction dates should be date-only ISO strings, for example `2026-06-18`.
- Search uses the explicit `merchantQuery` query param rather than a vague `q`.
- The response does not expose cleanup provenance, raw rows, duplicate groups, `limit`, `cursor`, or `nextCursor`.

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
