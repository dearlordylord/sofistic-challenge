For the report please see [NOTES.md](NOTES.md)

# Sofistic.AI Technical Test — Transactions Feed

Thanks for taking the time to do this test! We've tried to keep it close to the kind of work we actually do: taking imperfect financial data and turning it into a clean, fast client experience.

**Time box: ~2 hours.** We'd rather see well-structured, partially-complete work than a rushed everything. If you run out of time, note what you'd do next in your write-up.

## The task

Build a small **transactions feed**: a client opens the app and sees their recent transactions, and can search them.

A user should be able to:

- See a list of their transactions (date, merchant, amount, category)
- Search transactions by merchant name, with results updating **as they type** (`onChange` — no submit button)
- Trust what they see: no duplicate transactions, merchant names displayed in a clean, readable form

### The catch

The database we provide is seeded with deliberately messy data, like real bank feeds:

- Some transactions are exact or near duplicates (same transaction ingested twice)
- Merchant names are inconsistent (`AMZN Mktp CA`, `amazon.ca`, `AMAZON.CA TORONTO`)
- Some fields are missing or inconsistently formatted

**All data cleaning and search logic must happen server-side.** The frontend should receive display-ready data from your API. How you clean it (and where in your backend that responsibility lives) is up to you — we're interested in your judgment here.

## Acceptance criteria

1. The frontend fetches transactions from your API — no transaction data hard-coded in the client
2. Search triggers on change with **reasonable performance** — the API shouldn't be hammered on every keystroke, and fast typers shouldn't see stale results
3. The API response contains no duplicate transactions
4. Merchant names are normalized to a single consistent display name
5. The API contract (endpoints, params, response shape) is yours to design — be ready to explain your choices

## Starter repo (optional)

This repo is a ready-to-go starting point: **NestJS + TypeScript + SQLite** on the backend (SQLite via Node's built-in `node:sqlite` — no native modules or ORM required) and **React + TypeScript + Vite** on the frontend, with an `/api` proxy already wired between them.

Using it is optional. If you prefer another stack, go ahead — just use the same seed data (`server/seed/transactions.json`) and include clear run instructions.

### Runtime

Requires **Node 22.13+** for `node:sqlite`. The repo includes `.nvmrc` and `.node-version` pinned to `22.13.0` for Node version managers.

Use `pnpm` through the pinned package manager declaration in `package.json`:

```bash
corepack enable
corepack pnpm install
```

### Quickstart

After selecting Node 22.13+:

```bash
pnpm install
pnpm run seed     # creates packages/transactions-db/data/app.db
pnpm run server   # Effect API on http://localhost:3000/api
pnpm run client   # React app on http://localhost:5173 (separate terminal)
```

`GET /api/health` confirms the API is wired; the client fetches `GET /api/transactions` for the feed.

### Package Structure

This repo is organized as a small typed monorepo:

- `packages/api`: frontend/backend interface contracts, route constants, and Effect Schema codecs
- `packages/transactions-shared`: internal transaction data structures
- `packages/transactions-clean`: pure transaction cleaning, dedupe, display normalization, and merchant search
- `packages/transactions-db`: SQLite storage concerns and seed script
- `packages/server`: Effect HTTP server and package wiring
- `packages/web`: Vite/React frontend

Useful gates:

```bash
pnpm run build
pnpm run typecheck
pnpm run test
pnpm run lint
pnpm run circular
pnpm run check-all
```

## Guidance

- **Write the backend as if it were part of a larger system.** The problem is small, but structure your code the way you would if this feature were one of fifty. That's most of what we're evaluating.
- Use any libraries you like.
- Don't spend time on: auth, deployment, responsive design, or visual polish. Functional and readable beats pretty.
- Tests are welcome but not required given the time box; telling us *what* you'd test is fine.

## Write-up

Include a short `NOTES.md` covering:

1. Your approach and any key decisions (especially: how you handled the messy data, and your API contract)
2. What you'd improve or do differently with more time
3. **How you used AI tools** — we use them daily and expect you to; we want to see how you direct them. What you accepted vs. you pushed back on.

## What we look for

- Backend structure and separation of concerns
- How you handle the search-as-you-type performance problem
- Judgment on the messy data (there's no single right answer)
- A clear, honest write-up. It will be used as a basis for the follow-up conversation.

## Submitting

Send us a link to a repo (or a zip) with your code, `NOTES.md`, and instructions to run it locally.

Good luck — have fun with it.
