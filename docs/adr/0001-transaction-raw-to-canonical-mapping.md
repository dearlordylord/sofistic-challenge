# ADR 0001: Map Raw Transaction Feed to Canonical Transactions With Provenance

## Status

Proposed

## Context

The current seed creates a raw `transactions` table from `packages/transactions-db/seed/transactions.json` and inserts values as-is. The raw table is useful as an ingestion ledger, but it is not a reliable application model:

- 86 raw rows.
- 77 rows after exact de-duplication.
- 73 rows after normalized business de-duplication.
- 11 normalized duplicate groups involving 24 raw rows.
- Mixed date formats: `YYYY-MM-DD`, ISO datetimes, `D Mon YYYY`, and slash dates.
- Mixed amount storage in SQLite: 61 `real` values and 25 `text` values.
- Currency drift: `CAD`, `cad`, and `null`.
- Category drift: nulls, an empty string, and case variants.
- Merchant descriptors include payment processors, locations, terminal codes, pending markers, whitespace, and casing differences.

We do not want to clean the raw table in place. The raw feed must remain audit-safe. Instead, we want a mapping workflow that behaves like a deterministic processor: raw facts in, canonical domain entities out, with every assumption and decision persisted.

Business decision: ambiguous-but-parseable rows should still map to canonical records when the core money movement is trustworthy. Any assumption must be materialized in provenance columns or provenance records so no raw value, rule, or decision is lost.

## Decision

Maintain the raw feed as immutable source data and map it into a canonical transaction model through versioned mapping rules.

The target model will be canonical-first with explicit provenance:

1. Every raw row is preserved unchanged.
2. Every parseable raw row gets a normalized row-level projection.
3. Canonical transactions are built from normalized rows after de-duplication.
4. Merchants are mapped to companies through deterministic aliases and rules.
5. Categories are normalized to controlled labels, with `Uncategorized` used only as an explicit mapped value.
6. Assumptions are grouped and stored as first-class provenance, not comments or hidden code behavior.
7. Duplicate suppression is represented as a mapping decision from many raw rows to one canonical transaction.

This is not an in-place cleanup. It is a raw-to-canonical mapping with traceable decisions.

## Source Model

Existing raw table, kept unchanged:

```sql
transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT,
  date TEXT,
  merchant TEXT,
  amount,
  currency TEXT,
  category TEXT
)
```

For this project, `transactions` is the raw source table. The mapper reads from it and writes to separate canonical/provenance tables. It should not rename, rewrite, backfill, or add columns to `transactions`.

When this system grows beyond a seed-file exercise, we may add optional ingestion metadata beside the existing raw table. That is what `raw_transaction_batches` means: a batch-level record for where a group of raw rows came from. It is not needed to implement the current mapping and it is not a replacement for `transactions`.

Optional future ingestion metadata:

```sql
raw_transaction_batches (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  source_file_name TEXT,
  source_checksum TEXT,
  mapper_version TEXT
)
```

If batch metadata is added later, prefer a sidecar table keyed by the existing raw row ID rather than changing `transactions`:

```sql
raw_transaction_ingestion_metadata (
  transaction_id INTEGER PRIMARY KEY,
  batch_id TEXT NOT NULL,
  source_row_number INTEGER,
  raw_payload_json TEXT,
  ingested_at TEXT NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (batch_id) REFERENCES raw_transaction_batches(id)
)
```

## Target Entities

### `companies`

Represents a real merchant or counterparty, not a raw bank descriptor.

```sql
companies (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  company_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

Examples:

- `amazon` -> `Amazon`
- `starbucks` -> `Starbucks`
- `shell` -> `Shell`
- `uber` -> `Uber`
- `uber_eats` -> `Uber Eats`
- `payroll_sofistic_ai` -> `Sofistic AI`

`company_type` examples: `merchant`, `employer`, `financial_transfer_counterparty`, `unknown`.

### `company_aliases`

Caches raw descriptor mappings to companies. For the first version, this table can be populated by an LLM-assisted mapper instead of a hand-built review workflow.

```sql
company_aliases (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  alias_kind TEXT NOT NULL,
  raw_alias TEXT,
  normalized_alias TEXT NOT NULL,
  match_rule TEXT NOT NULL,
  priority INTEGER NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id)
)
```

`alias_kind` examples: `exact`, `contains`, `regex`, `processor_descriptor`, `llm_suggested`.

Examples:

- `AMAZON.CA TORONTO ON`, `amazon.ca`, `AMZN Mktp CA` -> `Amazon`
- `STARBUCKS #1042`, `SQ *STARBUCKS TORONTO`, `Starbucks Coffee` -> `Starbucks`
- `SHELL C41235`, `SHELL EASYPAY`, `Shell` -> `Shell`
- `UBER *TRIP`, `UBER CANADA/UBERTRIP`, `Uber BV` -> `Uber`
- `UBER EATS`, `UBER *EATS PENDING` -> `Uber Eats`

Aliases are not expected to be filled by a person reviewing every transaction one by one. For the current dataset, the simplest useful workflow is:

1. Group raw merchant descriptors by a normalized descriptor key.
2. Ask an LLM to propose `company.display_name`, `company_type`, `category`, `status`, and confidence for each descriptor group.
3. Persist high-confidence suggestions as aliases with `alias_kind = 'llm_suggested'`.
4. Reuse persisted aliases automatically on future mapping runs.
5. Keep the LLM model, prompt version, input descriptor group, JSON response, confidence, and chosen mapped value as provenance.
6. Mark low-confidence suggestions as `unknown` or `uncategorized` rather than blocking the canonical transaction.

In this dataset, there are only about 30 raw merchant strings, so the LLM should operate on descriptor groups, not on all 86 raw rows. In production, this can later evolve into deterministic aliases plus a review queue, but that is not needed for the first implementation.

### `categories`

Controlled display categories.

```sql
categories (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  parent_category_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_category_id) REFERENCES categories(id)
)
```

Initial categories:

- `subscriptions`
- `transport`
- `food_delivery`
- `groceries`
- `gas`
- `shopping`
- `coffee`
- `home`
- `restaurants`
- `income`
- `uncategorized`

### `canonical_transactions`

Represents one user-visible financial movement.

```sql
canonical_transactions (
  id TEXT PRIMARY KEY,
  transaction_date TEXT NOT NULL,
  company_id TEXT NOT NULL,
  display_merchant TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  category_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  duplicate_group_id TEXT,
  confidence REAL NOT NULL,
  mapping_run_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
)
```

`direction` values:

- `debit` for negative amounts.
- `credit` for positive amounts.

`status` values:

- `posted` by default.
- `pending` when the raw descriptor contains a pending marker, such as `UBER *EATS PENDING`.

### `canonical_transaction_sources`

Connects raw rows to canonical transactions.

```sql
canonical_transaction_sources (
  canonical_transaction_id TEXT NOT NULL,
  raw_transaction_id INTEGER NOT NULL,
  source_role TEXT NOT NULL,
  field_snapshot_json TEXT NOT NULL,
  PRIMARY KEY (canonical_transaction_id, raw_transaction_id),
  FOREIGN KEY (canonical_transaction_id) REFERENCES canonical_transactions(id),
  FOREIGN KEY (raw_transaction_id) REFERENCES transactions(id)
)
```

`source_role` values:

- `primary`: the raw row selected as the representative.
- `duplicate`: a raw row suppressed by de-duplication.
- `supporting`: a raw row used only to reinforce confidence or enrichment.

### `mapping_runs`

Records each deterministic mapping execution.

```sql
mapping_runs (
  id TEXT PRIMARY KEY,
  mapper_version TEXT NOT NULL,
  ruleset_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  input_row_count INTEGER NOT NULL,
  canonical_transaction_count INTEGER,
  exact_duplicate_count INTEGER,
  business_duplicate_count INTEGER,
  notes TEXT
)
```

### `mapping_assumption_groups`

Groups assumptions into named, queryable decisions.

```sql
mapping_assumption_groups (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  default_confidence_delta REAL NOT NULL
)
```

Initial assumption groups:

- `DATE_FORMAT_SLASH_DD_MM`: slash dates are interpreted as `DD/MM/YYYY`.
- `MISSING_CURRENCY_DEFAULT_CAD`: missing currency is mapped to `CAD`.
- `LOWERCASE_CURRENCY_UPPERCASED`: lowercase currency is uppercased.
- `CATEGORY_CASE_NORMALIZED`: category casing is normalized.
- `MISSING_CATEGORY_UNCATEGORIZED`: null or blank category maps to `Uncategorized`.
- `MERCHANT_ALIAS_MATCHED`: raw merchant descriptor matched a known alias.
- `MERCHANT_DESCRIPTOR_STRIPPED`: processor/location/terminal tokens removed.
- `PENDING_STATUS_EXTRACTED`: pending marker moved from merchant descriptor to status.
- `AMOUNT_TEXT_PARSED`: text amount parsed into numeric cents.
- `MISSING_EXTERNAL_ID_FINGERPRINTED`: no external ID; de-duplication uses a fingerprint.
- `DUPLICATE_SUPPRESSED`: raw row mapped as duplicate of another canonical transaction.
- `LLM_MERCHANT_SEMANTIC_MAPPING`: LLM suggested merchant/company/category/status semantics for a descriptor group.
- `LLM_SUGGESTION_REJECTED`: LLM suggestion was produced but not accepted.

### `mapping_decisions`

Field-level and row-level provenance for every non-trivial mapping.

```sql
mapping_decisions (
  id TEXT PRIMARY KEY,
  mapping_run_id TEXT NOT NULL,
  raw_transaction_id INTEGER,
  canonical_transaction_id TEXT,
  decision_scope TEXT NOT NULL,
  target_field TEXT,
  raw_value TEXT,
  mapped_value TEXT,
  assumption_group_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  confidence REAL NOT NULL,
  decision_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (mapping_run_id) REFERENCES mapping_runs(id),
  FOREIGN KEY (raw_transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (canonical_transaction_id) REFERENCES canonical_transactions(id),
  FOREIGN KEY (assumption_group_id) REFERENCES mapping_assumption_groups(id)
)
```

`decision_scope` examples:

- `field_parse`
- `field_default`
- `merchant_resolution`
- `category_resolution`
- `status_extraction`
- `deduplication`
- `representative_selection`

## Mapping Rules

### Date

Map every parseable date to `YYYY-MM-DD`.

Rules:

- `YYYY-MM-DD` stays unchanged.
- ISO datetime maps to its UTC date component.
- `D Mon YYYY` maps via English month names.
- Slash dates map as `DD/MM/YYYY`.

For slash dates where both day and month are `<= 12`, create a `DATE_FORMAT_SLASH_DD_MM` decision. The canonical date is still produced.

### Amount

Map amount to integer cents.

Rules:

- Numeric values multiply by 100 and round to cents.
- Text numeric values parse to decimal first, then cents.
- If a text value is parsed, create an `AMOUNT_TEXT_PARSED` decision.
- Non-numeric amounts should not produce a canonical transaction; they should go to an exception table or failed mapping report.

### Currency

Map currency to uppercase ISO-like code.

Rules:

- `CAD` stays `CAD`.
- `cad` maps to `CAD` with `LOWERCASE_CURRENCY_UPPERCASED`.
- `null` maps to `CAD` with `MISSING_CURRENCY_DEFAULT_CAD`.

The default is acceptable for this dataset because all populated currencies are CAD. In a production feed, this should be source-account-aware.

### Merchant and Company

Map raw merchant descriptor to a company through aliases, deterministic rules, and LLM suggestions.

Rules:

- Trim whitespace.
- Preserve the raw descriptor in `transactions` and `canonical_transaction_sources.field_snapshot_json`.
- Extract status markers such as `PENDING` before merchant display normalization.
- Match against `company_aliases` by priority.
- If matched, set `company_id` and `display_merchant` from `companies`.
- If unmatched, group the descriptor with similar descriptors and ask the LLM for a structured suggestion.
- If the LLM suggestion is high-confidence and passes validation, create or reuse a `companies` row and persist a `company_aliases` row.
- If the LLM suggestion is low-confidence or invalid, map to an `unknown` company and record the failed suggestion as provenance.

Do not erase meaningful descriptor details. Processor names, terminal codes, city names, and pending markers should either be stored in provenance or extracted into structured fields.

### LLM Mapping Suggestions

LLM use should be constrained to semantic enrichment. It should not parse amounts, choose transaction dates, or decide whether money moved. Those parts remain deterministic.

LLM suggestions are generated for descriptor groups, not individual transactions.

```sql
llm_mapping_suggestions (
  id TEXT PRIMARY KEY,
  mapping_run_id TEXT NOT NULL,
  normalized_descriptor TEXT NOT NULL,
  example_raw_descriptors_json TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  proposed_company_id TEXT,
  proposed_display_name TEXT,
  proposed_company_type TEXT,
  proposed_category_id TEXT,
  proposed_status TEXT,
  confidence REAL NOT NULL,
  accepted INTEGER NOT NULL,
  rejection_reason TEXT,
  occurrence_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (mapping_run_id) REFERENCES mapping_runs(id)
)
```

Acceptance rules:

- Accept only valid JSON matching the expected schema.
- Accept only known category IDs, or map the category to `uncategorized`.
- Accept only valid status values, currently `posted` or `pending`.
- Accept only suggestions above the configured confidence threshold.
- Never let the LLM alter raw date, amount, currency, or external ID.

Accepted suggestions should create `mapping_decisions` with assumption group `LLM_MERCHANT_SEMANTIC_MAPPING`. Rejected suggestions should also be persisted so the decision is auditable.

### Category

Map category to `categories`.

Rules:

- Trim category.
- Case-normalize known labels.
- `null` or empty string maps to `uncategorized`.
- Every null/blank mapping creates `MISSING_CATEGORY_UNCATEGORIZED`.
- Every case-only mapping creates `CATEGORY_CASE_NORMALIZED`.

### Direction

Derive transaction direction from amount:

- Negative amount -> `debit`.
- Positive amount -> `credit`.

The original sign remains represented by `amount_cents`.

### Status

Default status is `posted`.

If a raw merchant descriptor contains pending markers, set status to `pending` and record `PENDING_STATUS_EXTRACTED`.

### De-Duplication

Use a layered duplicate strategy.

Exact duplicate key:

```text
external_id + raw date + raw merchant + raw amount + raw currency + raw category
```

Business duplicate key:

```text
normalized date + company_id + amount_cents + currency + direction
```

Prefer `external_id` when available. When `external_id` is missing, use a fingerprint:

```text
normalized date + normalized merchant/company + amount_cents + currency + normalized category
```

Duplicate groups should create:

- One `canonical_transactions` row.
- One `canonical_transaction_sources` row per raw row.
- `DUPLICATE_SUPPRESSED` decisions for suppressed rows.
- `representative_selection` decision explaining why the primary row was selected.

Representative selection order:

1. Row with non-null `external_id`.
2. Row with the most complete fields.
3. Row with the highest-confidence merchant/category mapping.
4. Lowest raw row ID as deterministic tie-breaker.

## Exception Handling

Rows should fail canonical mapping only when core money movement cannot be trusted:

- Unparseable date.
- Missing or non-numeric amount.
- Missing merchant that cannot be assigned even to an unknown counterparty.

Recommended table:

```sql
mapping_exceptions (
  id TEXT PRIMARY KEY,
  mapping_run_id TEXT NOT NULL,
  raw_transaction_id INTEGER NOT NULL,
  exception_code TEXT NOT NULL,
  exception_message TEXT NOT NULL,
  raw_payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (mapping_run_id) REFERENCES mapping_runs(id),
  FOREIGN KEY (raw_transaction_id) REFERENCES transactions(id)
)
```

Missing currency, missing category, ambiguous slash dates, string amounts, duplicate status, and merchant aliases are not exceptions for this dataset. They are mapped with explicit provenance.

## Example Mappings

### Duplicate Shell Rows

Raw rows `13`, `32`, and `33` are exact duplicates:

```text
tx_1027 | 04/05/2026 | SHELL C41235 | -36.10 | CAD | Gas
```

Mapping:

- One canonical transaction.
- Company: `Shell`.
- Date: `2026-05-04`.
- Amount: `-3610`.
- Currency: `CAD`.
- Category: `Gas`.
- Two raw rows marked as `duplicate`.
- Decisions include `DATE_FORMAT_SLASH_DD_MM`, `MERCHANT_ALIAS_MATCHED`, and `DUPLICATE_SUPPRESSED`.

### Starbucks Near Duplicate

Raw rows `11` and `76`:

```text
tx_1012 | 10 Jun 2026 | STARBUCKS #1042       | -10.70 | CAD | Coffee
tx_1012 | 10/06/2026  | SQ *STARBUCKS TORONTO | -10.70 | CAD | Coffee
```

Mapping:

- One canonical transaction.
- Company: `Starbucks`.
- Date: `2026-06-10`.
- Processor descriptor `SQ *` and location `TORONTO` are preserved in provenance.
- Row `76` gets `DATE_FORMAT_SLASH_DD_MM` and `MERCHANT_DESCRIPTOR_STRIPPED`.

### Missing Currency

Raw row `3`:

```text
tx_1056 | 16 Apr 2026 | UBER EATS | -30.88 | null | Food Delivery
```

Mapping:

- Company: `Uber Eats`.
- Currency: `CAD`.
- Decision: `MISSING_CURRENCY_DEFAULT_CAD`.
- Confidence reduced by the assumption group.

### Pending Merchant Descriptor

Raw descriptor:

```text
UBER *EATS PENDING
```

Mapping:

- Company: `Uber Eats`.
- Status: `pending`.
- Display merchant does not include `PENDING`.
- Raw descriptor remains available through source and decision records.
- Decision: `PENDING_STATUS_EXTRACTED`.

## Consequences

Benefits:

- Raw data remains immutable and audit-safe.
- The UI can query clean canonical transactions.
- Every assumption is queryable by rule, run, raw row, target field, and confidence.
- Duplicate handling is explainable instead of silent.
- Merchant and category mappings can evolve without rewriting source facts.

Tradeoffs:

- More tables than a simple cleanup pass.
- Mapping needs a versioned ruleset and repeatable run semantics.
- Queries for audit views will need joins across canonical, source, and decision tables.
- LLM use introduces prompt/model versioning and validation requirements.
- Low-confidence LLM suggestions may still need later review, but they do not block the first canonical mapping.

## Implementation Notes

Initial implementation can be LLM-assisted with deterministic guardrails:

1. Keep existing raw seed behavior.
2. Add mapper code that reads all raw transactions.
3. Deterministically parse dates, amounts, currency, direction, duplicate keys, and pending markers.
4. Group raw merchant descriptors into normalized descriptor groups.
5. Ask the LLM for structured merchant/company/category suggestions per descriptor group.
6. Validate LLM JSON against a strict schema and known enum values.
7. Persist accepted suggestions to `companies`, `company_aliases`, `llm_mapping_suggestions`, and `mapping_decisions`.
8. Persist rejected suggestions to `llm_mapping_suggestions` and map affected rows to `unknown` or `uncategorized`.
9. Write canonical rows, source links, decisions, LLM suggestions, and exceptions in one transaction.
10. Expose `GET /api/transactions` from canonical tables only.
11. Optionally expose `GET /api/transactions/:id/provenance` for audit.

Rule code should have stable IDs and versions, for example:

```text
date.parse.iso@1
date.parse.slash_dd_mm@1
amount.parse_numeric_text@1
currency.default_cad@1
merchant.alias.amazon@1
merchant.llm_descriptor_group@1
dedupe.business_key@1
```

## Open Questions

- What confidence threshold should accept an LLM merchant suggestion automatically?
- Should `Uncategorized` be visible to users, or hidden behind a review queue in the UI?
- Should canonical transaction IDs be deterministic hashes of business keys, or generated IDs stored with source links?
- Should pending transactions be included in duplicate matching with posted transactions, or kept separate until settled?
- Should missing currency default use account metadata once accounts exist?
