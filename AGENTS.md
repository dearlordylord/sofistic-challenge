# Project Instructions

## Package Manager

Use `pnpm`, not npm. Prefer package scripts over raw commands.

## Architecture

- `@sofistic/api` owns shared frontend/backend interface contracts: route constants, Effect Schema codecs, request types, and response types.
- `@sofistic/transactions-shared` owns internal transaction data structures shared by transaction packages.
- `@sofistic/transactions-clean` owns pure transaction cleanup, dedupe, normalization, and search behavior.
- `@sofistic/transactions-db` owns transaction storage concerns and SQLite adapters.
- `@sofistic/server` owns HTTP wiring and server runtime.
- `@sofistic/web` owns the Vite frontend.

## Quality Harness

- `pnpm check-all` gates build, typecheck, lint, circular dependency checks, and tests.
- Data crossing process or network seams must be decoded with Effect Schema.
- Tests should substitute behavior through explicit seams rather than module monkey-patching.
- Type casts should be avoided. Prefer schemas, narrowing, discriminated unions, or `satisfies`.
