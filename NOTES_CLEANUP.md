# Cleanup Notes

## What We Investigated

We inspected the seeded transaction data and confirmed the raw feed is intentionally messy:

- 86 raw rows.
- 77 rows after exact de-duplication.
- 73 rows after normalized business de-duplication.
- 11 business duplicate groups with 13 duplicate source rows.
- Mixed date formats, mixed numeric/text amounts, currency casing/nulls, missing categories, and inconsistent merchant descriptors.

Initial analysis incorrectly treated missing local Node 22 support as a practical blocker. That was corrected by running Node 22.13.1 locally through `npm exec`, seeding SQLite, and verifying the counts directly from the DB.

## Business Decisions From The Chat

- Do not clean the raw `transactions` table in place.
- Treat `transactions` as the immutable raw source table.
- Map raw data into canonical/provenance tables instead.
- Ambiguous-but-parseable rows should still become canonical transactions when the core money movement is trustworthy.
- Every assumption must be materialized in provenance columns/records so no raw data or decision is lost.
- Do not require a person to classify every row one by one.
- Use an LLM-assisted workflow for semantic merchant/category mapping for now.
- The LLM must not alter financial facts like date, amount, currency, or whether money moved.
- Wrong LLM suggestions stay in `llm_mapping_suggestions` with `accepted = 0` and a rejection reason; they become `mapping_exceptions` only if the transaction itself cannot be safely mapped.

## ADR Outcome

We created an ADR:

`docs/adr/0001-transaction-raw-to-canonical-mapping.md`

It defines a raw-to-canonical mapping workflow with:

- `companies`
- `company_aliases`
- `categories`
- `canonical_transactions`
- `canonical_transaction_sources`
- `mapping_runs`
- `mapping_assumption_groups`
- `mapping_decisions`
- `llm_mapping_suggestions`
- `mapping_exceptions`

The ADR was adjusted during the chat to avoid implying a rename or replacement of `transactions`. Optional future ingestion metadata was kept separate from the current raw table.

## Mock Implementation

We then implemented a hardcoded mock of the ADR workflow in:

`packages/transactions-clean/src/canonical-materializer.ts`

and a runnable script:

`packages/transactions-clean/scripts/materialize-canonical-model.ts`

This mock intentionally simulates the future LLM-assisted/user-reviewed workflow using deterministic fixture rules for the current dataset. The source file includes a confession comment saying it should be replaced with a proper descriptor-grouping, LLM suggestion, validation, and review workflow before production use.

The materializer:

- reads from `transactions`
- leaves `transactions` unchanged
- creates/populates canonical and provenance tables
- stores simulated LLM suggestions and acceptances
- links all raw rows to canonical transactions
- records duplicate suppression decisions
- records parsing/defaulting/provenance decisions
- skips when the expected materialized state already exists
- rebuilds if a partial/corrupt materialization is detected

## Acceptance Checks Performed

We backed up the manually materialized DB, then required the new script to reproduce it exactly.

Checks performed:

- Deleted the generated DB.
- Re-seeded raw `transactions`.
- Ran the new materializer.
- Compared every table against the backup DB.
- Verified normal rerun is idempotent with `idempotentSkip: true`.
- Simulated partial completion by deleting 5 `mapping_decisions`.
- Reran materializer and verified it rebuilt the canonical/provenance tables.
- Compared rebuilt DB against the backup again.
- Deleted the backup DB only after passing.

Final materialized counts:

```text
rawTransactions: 86
canonicalTransactions: 73
sourceLinks: 86
duplicateSources: 13
companies: 14
aliases: 29
llmSuggestions: 14
acceptedLlmSuggestions: 14
rejectedLlmSuggestions: 0
mappingDecisions: 243
exceptions: 0
```

Verification:

```text
typecheck: passed
tests: passed
lint: passed with warnings
```

