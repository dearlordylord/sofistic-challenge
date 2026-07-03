/* eslint-disable max-lines, no-restricted-syntax -- temporary SQLite fixture materializer mirrors ADR tables directly and casts raw query rows */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"

const MAPPING_RUN_ID = "map_run_20260703_simulated_llm_v1"
const MAPPER_VERSION = "manual-simulation@1"
const RULESET_VERSION = "adr-0001@1"
const MOCK_TIMESTAMP = "2026-07-03T15:59:48.349Z"
const MOCK_FINISHED_AT = "2026-07-03T15:59:48.389Z"
const DEFAULT_CURRENCY = "CAD"
const ACCEPTED_LLM_CONFIDENCE = 0.85

/**
 * Temporary hardcoded materializer for ADR 0001.
 *
 * This intentionally mocks the future LLM-assisted and user-reviewed workflow:
 * merchant/company/category suggestions are deterministic fixtures derived from
 * the known seed descriptors, while all model prompts, responses, acceptances,
 * and mapping decisions are still persisted in the target provenance tables.
 *
 * Replace this with a proper descriptor-grouping, LLM suggestion, validation,
 * and review workflow before treating this as production data-cleaning logic.
 */
export function materializeCanonicalTransactionModel(
  dbFile: string,
  options: MaterializationOptions = {}
): MaterializationSummary {
  mkdirSync(dirname(dbFile), { recursive: true })
  const db = new DatabaseSync(dbFile)
  try {
    return materializeCanonicalTransactionModelInOpenDatabase(db, options.seedFile ?? defaultSeedFile())
  } finally {
    db.close()
  }
}

export type MaterializationOptions = {
  readonly seedFile?: string
}

export function defaultDatabaseFile(): string {
  return join(workspaceRoot(), "packages", "transactions-db", "data", "app.db")
}

export type MaterializationSummary = {
  readonly acceptedLlmSuggestions: number
  readonly aliases: number
  readonly canonicalTransactions: number
  readonly companies: number
  readonly duplicateSources: number
  readonly exceptions: number
  readonly idempotentSkip: boolean
  readonly llmSuggestions: number
  readonly mappingDecisions: number
  readonly rawTransactions: number
  readonly rejectedLlmSuggestions: number
  readonly sourceLinks: number
}

type RawRow = {
  readonly amount: number | string | null
  readonly category: string | null
  readonly currency: string | null
  readonly date: string | null
  readonly external_id: string | null
  readonly id: number
  readonly merchant: string | null
}

type MappingRunRow = {
  readonly accepted_llm_suggestion_count: number | null
  readonly canonical_transaction_count: number | null
  readonly business_duplicate_count: number | null
  readonly company_alias_count: number | null
  readonly company_count: number | null
  readonly exception_count: number | null
  readonly finished_at: string | null
  readonly input_fingerprint: string | null
  readonly input_row_count: number
  readonly llm_suggestion_count: number | null
  readonly mapping_decision_count: number | null
  readonly rejected_llm_suggestion_count: number | null
  readonly source_link_count: number | null
}

type CompanySuggestion = {
  readonly confidence: number
  readonly defaultCategoryId: CategoryId
  readonly display: string
  readonly id: string
  readonly type: string
}

type ParsedDate = {
  readonly assumption: AssumptionCode | null
  readonly value: string | null
}

type ParsedAmount = {
  readonly assumption: AssumptionCode | null
  readonly cents: number | null
}

type NormalizedCurrency = {
  readonly assumption: AssumptionCode | null
  readonly value: string
}

type NormalizedCategory = {
  readonly assumption: AssumptionCode | null
  readonly id: CategoryId
}

type NormalizedRow = {
  readonly amount: ParsedAmount
  readonly category: NormalizedCategory
  readonly currency: NormalizedCurrency
  readonly date: ParsedDate
  readonly direction: "credit" | "debit"
  readonly merchant: CompanySuggestion
  readonly row: RawRow
  readonly status: "pending" | "posted"
}

type AssumptionCode =
  | "AMOUNT_TEXT_PARSED"
  | "CATEGORY_CASE_NORMALIZED"
  | "DATE_FORMAT_SLASH_DD_MM"
  | "DATE_ISO_TIMESTAMP_TRUNCATED"
  | "DATE_TEXT_MONTH_PARSED"
  | "DUPLICATE_SUPPRESSED"
  | "LLM_MERCHANT_SEMANTIC_MAPPING"
  | "LLM_SUGGESTION_REJECTED"
  | "LOWERCASE_CURRENCY_UPPERCASED"
  | "MISSING_CATEGORY_UNCATEGORIZED"
  | "MISSING_CURRENCY_DEFAULT_CAD"
  | "MISSING_EXTERNAL_ID_FINGERPRINTED"
  | "PENDING_STATUS_EXTRACTED"
  | "REPRESENTATIVE_SELECTED"

type CategoryId =
  | "coffee"
  | "food_delivery"
  | "gas"
  | "groceries"
  | "home"
  | "income"
  | "restaurants"
  | "shopping"
  | "subscriptions"
  | "transport"
  | "uncategorized"

type DecisionInput = {
  readonly assumption: AssumptionCode
  readonly canonicalId?: string
  readonly confidence?: number
  readonly detail?: unknown
  readonly field?: string
  readonly mappedValue?: unknown
  readonly rawId?: number
  readonly rawValue?: unknown
  readonly ruleId: string
  readonly scope: string
}

const categoryLabels: Readonly<Record<CategoryId, string>> = {
  coffee: "Coffee",
  food_delivery: "Food Delivery",
  gas: "Gas",
  groceries: "Groceries",
  home: "Home",
  income: "Income",
  restaurants: "Restaurants",
  shopping: "Shopping",
  subscriptions: "Subscriptions",
  transport: "Transport",
  uncategorized: "Uncategorized"
}

const categoryEntries: ReadonlyArray<readonly [CategoryId, string]> = [
  ["subscriptions", "Subscriptions"],
  ["transport", "Transport"],
  ["food_delivery", "Food Delivery"],
  ["groceries", "Groceries"],
  ["gas", "Gas"],
  ["shopping", "Shopping"],
  ["coffee", "Coffee"],
  ["home", "Home"],
  ["restaurants", "Restaurants"],
  ["income", "Income"],
  ["uncategorized", "Uncategorized"]
]

const assumptions: ReadonlyArray<readonly [AssumptionCode, string, string, number]> = [
  ["DATE_FORMAT_SLASH_DD_MM", "Slash date interpreted as DD/MM/YYYY", "warning", -0.05],
  ["DATE_TEXT_MONTH_PARSED", "Text month date parsed", "info", -0.01],
  ["DATE_ISO_TIMESTAMP_TRUNCATED", "ISO timestamp truncated", "info", 0],
  ["MISSING_CURRENCY_DEFAULT_CAD", "Missing currency defaulted to CAD", "warning", -0.08],
  ["LOWERCASE_CURRENCY_UPPERCASED", "Currency uppercased", "info", 0],
  ["CATEGORY_CASE_NORMALIZED", "Category case normalized", "info", 0],
  ["MISSING_CATEGORY_UNCATEGORIZED", "Missing category mapped to Uncategorized", "warning", -0.05],
  ["LLM_MERCHANT_SEMANTIC_MAPPING", "LLM semantic merchant mapping", "info", -0.02],
  ["LLM_SUGGESTION_REJECTED", "LLM suggestion rejected", "warning", -0.2],
  ["PENDING_STATUS_EXTRACTED", "Pending marker extracted", "info", 0],
  ["AMOUNT_TEXT_PARSED", "Text amount parsed", "info", 0],
  ["MISSING_EXTERNAL_ID_FINGERPRINTED", "Missing external ID fingerprinted", "warning", -0.05],
  ["DUPLICATE_SUPPRESSED", "Duplicate raw row suppressed", "info", 0],
  ["REPRESENTATIVE_SELECTED", "Representative raw row selected", "info", 0]
]

function materializeCanonicalTransactionModelInOpenDatabase(
  db: DatabaseSync,
  seedFile: string
): MaterializationSummary {
  db.exec("PRAGMA foreign_keys = ON")
  ensureRawTransactionsSeeded(db, seedFile)
  const rawRows = readRawRows(db)
  const inputFingerprint = fingerprintRawRows(rawRows)

  if (hasCompleteCurrentRun(db, inputFingerprint)) {
    return { ...readSummary(db), idempotentSkip: true }
  }

  db.exec("BEGIN")
  try {
    recreateCanonicalTables(db)
    const statements = prepareStatements(db)
    let decisionNumber = 0

    const addDecision = (input: DecisionInput) => {
      decisionNumber += 1
      statements.insertDecision.run(
        `decision_${String(decisionNumber).padStart(5, "0")}`,
        MAPPING_RUN_ID,
        input.rawId ?? null,
        input.canonicalId ?? null,
        input.scope,
        input.field ?? null,
        toNullableString(input.rawValue),
        toNullableString(input.mappedValue),
        input.assumption,
        input.ruleId,
        "1",
        input.confidence ?? 1,
        JSON.stringify(input.detail ?? {}),
        MOCK_TIMESTAMP
      )
    }

    statements.insertRun.run(
      MAPPING_RUN_ID,
      MAPPER_VERSION,
      RULESET_VERSION,
      MOCK_TIMESTAMP,
      inputFingerprint,
      rawRows.length,
      "Simulated ADR 0001 mapper run with accepted LLM-style semantic suggestions."
    )

    for (const [code, name, severity, delta] of assumptions) {
      statements.insertAssumption.run(code, code, name, name, severity, delta)
    }

    for (const [id, displayName] of categoryEntries) {
      statements.insertCategory.run(id, displayName, null, MOCK_TIMESTAMP, MOCK_TIMESTAMP)
    }

    materializeLlmSuggestions(rawRows, statements)

    const normalizedRows = normalizeRows(rawRows, statements)
    const dedupeGroups = groupByBusinessIdentity(normalizedRows)

    for (const [key, rows] of dedupeGroups.entries()) {
      materializeCanonicalGroup(key, rows, statements, addDecision)
    }

    const exactDuplicateExcess = readExactDuplicateExcess(db)
    const finalSummary = readSummary(db)
    statements.finishRun.run(
      MOCK_FINISHED_AT,
      finalSummary.canonicalTransactions,
      exactDuplicateExcess,
      finalSummary.duplicateSources,
      finalSummary.sourceLinks,
      finalSummary.companies,
      finalSummary.aliases,
      finalSummary.llmSuggestions,
      finalSummary.acceptedLlmSuggestions,
      finalSummary.rejectedLlmSuggestions,
      finalSummary.mappingDecisions,
      finalSummary.exceptions,
      MAPPING_RUN_ID
    )
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }

  return { ...readSummary(db), idempotentSkip: false }
}

function ensureRawTransactionsSeeded(db: DatabaseSync, seedFile: string) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT,
      date TEXT,
      merchant TEXT,
      amount,
      currency TEXT,
      category TEXT
    );
  `)

  const row = db.prepare("SELECT COUNT(*) AS count FROM transactions").get() as { readonly count: number }
  if (row.count > 0) return

  const rawSeed = JSON.parse(readFileSync(seedFile, "utf-8")) as ReadonlyArray<Omit<RawRow, "id">>
  const insert = db.prepare(`
    INSERT INTO transactions (external_id, date, merchant, amount, currency, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  db.exec("BEGIN")
  try {
    for (const transaction of rawSeed) {
      insert.run(
        transaction.external_id,
        transaction.date,
        transaction.merchant,
        transaction.amount,
        transaction.currency,
        transaction.category
      )
    }
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

function prepareStatements(db: DatabaseSync) {
  return {
    finishRun: db.prepare(
      `UPDATE mapping_runs
       SET finished_at = ?,
           canonical_transaction_count = ?,
           exact_duplicate_count = ?,
           business_duplicate_count = ?,
           source_link_count = ?,
           company_count = ?,
           company_alias_count = ?,
           llm_suggestion_count = ?,
           accepted_llm_suggestion_count = ?,
           rejected_llm_suggestion_count = ?,
           mapping_decision_count = ?,
           exception_count = ?
       WHERE id = ?`
    ),
    insertAlias: db.prepare("INSERT OR IGNORE INTO company_aliases VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    insertAssumption: db.prepare("INSERT INTO mapping_assumption_groups VALUES (?, ?, ?, ?, ?, ?)"),
    insertCanonical: db.prepare("INSERT INTO canonical_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    insertCategory: db.prepare("INSERT INTO categories VALUES (?, ?, ?, ?, ?)"),
    insertCompany: db.prepare("INSERT OR IGNORE INTO companies VALUES (?, ?, ?, ?, ?)"),
    insertDecision: db.prepare("INSERT INTO mapping_decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    insertException: db.prepare("INSERT INTO mapping_exceptions VALUES (?, ?, ?, ?, ?, ?, ?)"),
    insertRun: db.prepare(
      "INSERT INTO mapping_runs (id, mapper_version, ruleset_version, started_at, input_fingerprint, input_row_count, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ),
    insertSource: db.prepare("INSERT INTO canonical_transaction_sources VALUES (?, ?, ?, ?)"),
    insertSuggestion: db.prepare(
      "INSERT INTO llm_mapping_suggestions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
  }
}

function readRawRows(db: DatabaseSync): ReadonlyArray<RawRow> {
  return db.prepare(
    "SELECT id, external_id, date, merchant, amount, currency, category FROM transactions ORDER BY id ASC"
  ).all() as unknown as ReadonlyArray<RawRow>
}

function fingerprintRawRows(rawRows: ReadonlyArray<RawRow>): string {
  return stableHash(
    JSON.stringify({
      mapperVersion: MAPPER_VERSION,
      rows: rawRows,
      rulesetVersion: RULESET_VERSION
    }),
    64
  )
}

function recreateCanonicalTables(db: DatabaseSync) {
  db.exec(`
    DROP TABLE IF EXISTS mapping_exceptions;
    DROP TABLE IF EXISTS mapping_decisions;
    DROP TABLE IF EXISTS canonical_transaction_sources;
    DROP TABLE IF EXISTS canonical_transactions;
    DROP TABLE IF EXISTS llm_mapping_suggestions;
    DROP TABLE IF EXISTS company_aliases;
    DROP TABLE IF EXISTS companies;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS mapping_assumption_groups;
    DROP TABLE IF EXISTS mapping_runs;

    CREATE TABLE mapping_runs (
      id TEXT PRIMARY KEY,
      mapper_version TEXT NOT NULL,
      ruleset_version TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      input_fingerprint TEXT NOT NULL,
      input_row_count INTEGER NOT NULL,
      canonical_transaction_count INTEGER,
      exact_duplicate_count INTEGER,
      business_duplicate_count INTEGER,
      source_link_count INTEGER,
      company_count INTEGER,
      company_alias_count INTEGER,
      llm_suggestion_count INTEGER,
      accepted_llm_suggestion_count INTEGER,
      rejected_llm_suggestion_count INTEGER,
      mapping_decision_count INTEGER,
      exception_count INTEGER,
      notes TEXT
    );

    CREATE TABLE mapping_assumption_groups (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      default_confidence_delta REAL NOT NULL
    );

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      parent_category_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_category_id) REFERENCES categories(id)
    );

    CREATE TABLE companies (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      company_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE company_aliases (
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
    );

    CREATE TABLE llm_mapping_suggestions (
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
    );

    CREATE TABLE canonical_transactions (
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
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (mapping_run_id) REFERENCES mapping_runs(id),
      CHECK (direction IN ('credit', 'debit')),
      CHECK (status IN ('pending', 'posted'))
    );

    CREATE TABLE canonical_transaction_sources (
      canonical_transaction_id TEXT NOT NULL,
      raw_transaction_id INTEGER NOT NULL,
      source_role TEXT NOT NULL,
      field_snapshot_json TEXT NOT NULL,
      PRIMARY KEY (canonical_transaction_id, raw_transaction_id),
      FOREIGN KEY (canonical_transaction_id) REFERENCES canonical_transactions(id),
      FOREIGN KEY (raw_transaction_id) REFERENCES transactions(id)
    );

    CREATE TABLE mapping_decisions (
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
    );

    CREATE TABLE mapping_exceptions (
      id TEXT PRIMARY KEY,
      mapping_run_id TEXT NOT NULL,
      raw_transaction_id INTEGER NOT NULL,
      exception_code TEXT NOT NULL,
      exception_message TEXT NOT NULL,
      raw_payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (mapping_run_id) REFERENCES mapping_runs(id),
      FOREIGN KEY (raw_transaction_id) REFERENCES transactions(id)
    );
  `)
}

function materializeLlmSuggestions(rawRows: ReadonlyArray<RawRow>, statements: ReturnType<typeof prepareStatements>) {
  const groups = new Map<string, {
    readonly descriptors: Set<string>
    readonly rows: Array<RawRow>
    readonly suggestion: CompanySuggestion
  }>()

  for (const row of rawRows) {
    const suggestion = companyFor(row.merchant)
    const existing = groups.get(suggestion.id)
    if (existing === undefined) {
      groups.set(suggestion.id, {
        descriptors: new Set([String(row.merchant)]),
        rows: [row],
        suggestion
      })
    } else {
      existing.descriptors.add(String(row.merchant))
      existing.rows.push(row)
    }
  }

  for (const { descriptors, rows, suggestion } of groups.values()) {
    const examples = Array.from(descriptors).sort()
    const suggestionId = prefixedHash("llm_suggestion", `${suggestion.id}:${examples.join("|")}`)
    const accepted = suggestion.id !== "unknown" && suggestion.confidence >= ACCEPTED_LLM_CONFIDENCE
    if (accepted || suggestion.id === "unknown") {
      statements.insertCompany.run(suggestion.id, suggestion.display, suggestion.type, MOCK_TIMESTAMP, MOCK_TIMESTAMP)
    }
    const response = {
      companyDisplayName: suggestion.display,
      companyType: suggestion.type,
      category: suggestion.defaultCategoryId,
      status: examples.some(hasPending) ? "pending_if_descriptor_contains_pending" : "posted",
      confidence: suggestion.confidence
    }

    statements.insertSuggestion.run(
      suggestionId,
      MAPPING_RUN_ID,
      suggestion.id,
      JSON.stringify(examples),
      "simulated-llm-mapper",
      "merchant-semantic-v1",
      stableHash("merchant-semantic-v1"),
      JSON.stringify(response),
      suggestion.id,
      suggestion.display,
      suggestion.type,
      suggestion.defaultCategoryId,
      "posted",
      suggestion.confidence,
      accepted ? 1 : 0,
      accepted ? null : "below_confidence_or_unknown_company",
      rows.length,
      MOCK_TIMESTAMP
    )

    if (accepted) {
      for (const descriptor of examples) {
        const normalized = normalizedDescriptor(descriptor)
        statements.insertAlias.run(
          prefixedHash("alias", `${suggestion.id}:${normalized}`),
          suggestion.id,
          "llm_suggested",
          descriptor,
          normalized,
          `llm_mapping_suggestions:${suggestionId}`,
          100,
          MOCK_TIMESTAMP,
          null
        )
      }
    }
  }
}

function normalizeRows(
  rawRows: ReadonlyArray<RawRow>,
  statements: ReturnType<typeof prepareStatements>
): ReadonlyArray<NormalizedRow> {
  const normalized: Array<NormalizedRow> = []

  for (const row of rawRows) {
    const date = parseDate(row.date)
    const amount = parseAmount(row.amount)
    const currency = normalizeCurrency(row.currency)
    const merchant = companyFor(row.merchant)
    const category = normalizeCategory(row.category)
    const status = hasPending(row.merchant) ? "pending" : "posted"

    if (date.value === null || amount.cents === null || row.merchant === null) {
      const exceptionCode = date.value === null
        ? "UNPARSEABLE_DATE"
        : amount.cents === null
        ? "UNPARSEABLE_AMOUNT"
        : "MISSING_MERCHANT"
      statements.insertException.run(
        prefixedHash("exception", `${row.id}:${exceptionCode}`),
        MAPPING_RUN_ID,
        row.id,
        exceptionCode,
        "Core money movement could not be mapped safely.",
        JSON.stringify(row),
        MOCK_TIMESTAMP
      )
    } else {
      const direction = amount.cents < 0 ? "debit" : "credit"
      normalized.push({ amount, category, currency, date, direction, merchant, row, status })
    }
  }

  return normalized
}

function groupByBusinessIdentity(rows: ReadonlyArray<NormalizedRow>): Map<string, ReadonlyArray<NormalizedRow>> {
  const groups = new Map<string, Array<NormalizedRow>>()
  for (const row of rows) {
    const key = businessKey(row)
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, [row])
    } else {
      group.push(row)
    }
  }
  return groups
}

function materializeCanonicalGroup(
  key: string,
  rows: ReadonlyArray<NormalizedRow>,
  statements: ReturnType<typeof prepareStatements>,
  addDecision: (input: DecisionInput) => void
) {
  const sortedRows = Array.from(rows).sort(compareRepresentativePreference)
  const primary = sortedRows[0]
  if (primary === undefined) return

  const canonicalId = prefixedHash("ctx", key)
  const duplicateGroupId = sortedRows.length > 1 ? prefixedHash("dup_group", key) : null
  const confidence = Math.max(
    0.1,
    Math.min(
      1,
      primary.merchant.confidence
        - (primary.currency.assumption === null ? 0 : 0.05)
        - (primary.category.assumption === "MISSING_CATEGORY_UNCATEGORIZED" ? 0.05 : 0)
    )
  )

  statements.insertCanonical.run(
    canonicalId,
    primary.date.value,
    primary.merchant.id,
    primary.merchant.display,
    primary.amount.cents,
    primary.currency.value,
    primary.category.id,
    primary.direction,
    primary.status,
    duplicateGroupId,
    Number(confidence.toFixed(2)),
    MAPPING_RUN_ID,
    MOCK_TIMESTAMP,
    MOCK_TIMESTAMP
  )

  for (const row of sortedRows) {
    const isPrimary = row.row.id === primary.row.id
    statements.insertSource.run(
      canonicalId,
      row.row.id,
      isPrimary ? "primary" : "duplicate",
      JSON.stringify({
        raw: row.row,
        normalized: {
          transaction_date: row.date.value,
          company_id: row.merchant.id,
          display_merchant: row.merchant.display,
          amount_cents: row.amount.cents,
          currency: row.currency.value,
          category_id: row.category.id,
          direction: row.direction,
          status: row.status
        }
      })
    )

    addCoreDecisions(row, canonicalId, addDecision)
    if (!isPrimary) {
      addDecision({
        assumption: "DUPLICATE_SUPPRESSED",
        canonicalId,
        detail: { duplicateGroupId, primaryRawTransactionId: primary.row.id },
        field: "source_role",
        mappedValue: "duplicate",
        rawId: row.row.id,
        rawValue: row.row.id,
        ruleId: "dedupe.business_key",
        scope: "deduplication"
      })
    }
  }

  if (sortedRows.length > 1) {
    addDecision({
      assumption: "REPRESENTATIVE_SELECTED",
      canonicalId,
      detail: {
        duplicateGroupId,
        rawTransactionIds: sortedRows.map((row) => row.row.id)
      },
      field: "source_role",
      mappedValue: "primary",
      rawId: primary.row.id,
      rawValue: primary.row.id,
      ruleId: "dedupe.select_representative",
      scope: "representative_selection"
    })
  }
}

function addCoreDecisions(row: NormalizedRow, canonicalId: string, addDecision: (input: DecisionInput) => void) {
  const merchantSuggestionAccepted = row.merchant.id !== "unknown" && row.merchant.confidence >= ACCEPTED_LLM_CONFIDENCE
  addDecision({
    assumption: merchantSuggestionAccepted ? "LLM_MERCHANT_SEMANTIC_MAPPING" : "LLM_SUGGESTION_REJECTED",
    canonicalId,
    confidence: row.merchant.confidence,
    field: "company_id",
    mappedValue: row.merchant.id,
    rawId: row.row.id,
    rawValue: row.row.merchant,
    ruleId: merchantSuggestionAccepted ? "merchant.llm_descriptor_group" : "merchant.llm_descriptor_group_rejected",
    scope: "merchant_resolution"
  })

  if (row.date.assumption !== null) {
    addDecision({
      assumption: row.date.assumption,
      canonicalId,
      field: "transaction_date",
      mappedValue: row.date.value,
      rawId: row.row.id,
      rawValue: row.row.date,
      ruleId: "date.parse",
      scope: "field_parse"
    })
  }

  if (row.amount.assumption !== null) {
    addDecision({
      assumption: row.amount.assumption,
      canonicalId,
      field: "amount_cents",
      mappedValue: row.amount.cents,
      rawId: row.row.id,
      rawValue: row.row.amount,
      ruleId: "amount.parse_numeric_text",
      scope: "field_parse"
    })
  }

  if (row.currency.assumption !== null) {
    addDecision({
      assumption: row.currency.assumption,
      canonicalId,
      field: "currency",
      mappedValue: row.currency.value,
      rawId: row.row.id,
      rawValue: row.row.currency,
      ruleId: row.row.currency === null ? "currency.default_cad" : "currency.uppercase",
      scope: row.row.currency === null ? "field_default" : "field_parse"
    })
  }

  if (row.category.assumption !== null) {
    addDecision({
      assumption: row.category.assumption,
      canonicalId,
      field: "category_id",
      mappedValue: row.category.id,
      rawId: row.row.id,
      rawValue: row.row.category,
      ruleId: row.category.assumption === "CATEGORY_CASE_NORMALIZED"
        ? "category.case_normalize"
        : "category.default_uncategorized",
      scope: row.row.category === null || row.row.category === "" ? "field_default" : "field_parse"
    })
  }

  if (row.status === "pending") {
    addDecision({
      assumption: "PENDING_STATUS_EXTRACTED",
      canonicalId,
      field: "status",
      mappedValue: "pending",
      rawId: row.row.id,
      rawValue: row.row.merchant,
      ruleId: "status.extract_pending",
      scope: "status_extraction"
    })
  }

  if (row.row.external_id === null || row.row.external_id.trim() === "") {
    addDecision({
      assumption: "MISSING_EXTERNAL_ID_FINGERPRINTED",
      canonicalId,
      field: "external_id",
      mappedValue: businessKey(row),
      rawId: row.row.id,
      rawValue: null,
      ruleId: "identity.fingerprint_missing_external_id",
      scope: "identity"
    })
  }
}

function hasCompleteCurrentRun(db: DatabaseSync, inputFingerprint: string): boolean {
  const requiredTables = [
    "canonical_transaction_sources",
    "canonical_transactions",
    "categories",
    "companies",
    "company_aliases",
    "llm_mapping_suggestions",
    "mapping_assumption_groups",
    "mapping_decisions",
    "mapping_exceptions",
    "mapping_runs",
    "transactions"
  ]

  try {
    for (const tableName of requiredTables) {
      const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName) as {
        readonly name?: string
      } | undefined
      if (table === undefined) return false
    }

    const row = db.prepare("SELECT * FROM mapping_runs WHERE id = ?").get(MAPPING_RUN_ID) as
      | MappingRunRow
      | undefined
    if (row?.finished_at === null || row?.finished_at === undefined) return false
    if (row.input_fingerprint !== inputFingerprint) return false

    const summary = readSummary(db)
    return summary.rawTransactions === row.input_row_count
      && summary.canonicalTransactions === row.canonical_transaction_count
      && summary.sourceLinks === row.source_link_count
      && summary.duplicateSources === row.business_duplicate_count
      && summary.companies === row.company_count
      && summary.aliases === row.company_alias_count
      && summary.llmSuggestions === row.llm_suggestion_count
      && summary.acceptedLlmSuggestions === row.accepted_llm_suggestion_count
      && summary.rejectedLlmSuggestions === row.rejected_llm_suggestion_count
      && summary.mappingDecisions === row.mapping_decision_count
      && summary.exceptions === row.exception_count
  } catch {
    return false
  }
}

function readSummary(db: DatabaseSync): MaterializationSummary {
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM transactions) AS rawTransactions,
      (SELECT COUNT(*) FROM canonical_transactions) AS canonicalTransactions,
      (SELECT COUNT(*) FROM canonical_transaction_sources) AS sourceLinks,
      (SELECT COUNT(*) FROM canonical_transaction_sources WHERE source_role = 'duplicate') AS duplicateSources,
      (SELECT COUNT(*) FROM companies) AS companies,
      (SELECT COUNT(*) FROM company_aliases) AS aliases,
      (SELECT COUNT(*) FROM llm_mapping_suggestions) AS llmSuggestions,
      (SELECT COUNT(*) FROM llm_mapping_suggestions WHERE accepted = 1) AS acceptedLlmSuggestions,
      (SELECT COUNT(*) FROM llm_mapping_suggestions WHERE accepted = 0) AS rejectedLlmSuggestions,
      (SELECT COUNT(*) FROM mapping_decisions) AS mappingDecisions,
      (SELECT COUNT(*) FROM mapping_exceptions) AS exceptions
  `).get() as Omit<MaterializationSummary, "idempotentSkip">

  return { ...counts, idempotentSkip: false }
}

function readExactDuplicateExcess(db: DatabaseSync): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(excess), 0) AS count
    FROM (
      SELECT COUNT(*) - 1 AS excess
      FROM transactions
      GROUP BY external_id, date, merchant, amount, currency, category
      HAVING COUNT(*) > 1
    )
  `).get() as { readonly count: number }

  return row.count
}

function parseDate(rawDate: string | null): ParsedDate {
  if (rawDate === null) return { assumption: null, value: null }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(rawDate)
  if (isoMatch !== null) {
    const year = isoMatch[1]
    const month = isoMatch[2]
    const day = isoMatch[3]
    if (year !== undefined && month !== undefined && day !== undefined) {
      const value = validIsoDate(year, month, day)
      return {
        assumption: rawDate.includes("T") ? "DATE_ISO_TIMESTAMP_TRUNCATED" : null,
        value
      }
    }
  }

  const namedMonthMatch = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(rawDate)
  if (namedMonthMatch !== null) {
    const day = namedMonthMatch[1]
    const monthText = namedMonthMatch[2]
    const year = namedMonthMatch[3]
    if (day !== undefined && monthText !== undefined && year !== undefined) {
      const month = monthNumbers.get(monthText.toLocaleUpperCase())
      if (month !== undefined) return { assumption: "DATE_TEXT_MONTH_PARSED", value: validIsoDate(year, month, day) }
    }
  }

  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(rawDate)
  if (slashMatch !== null) {
    const day = slashMatch[1]
    const month = slashMatch[2]
    const year = slashMatch[3]
    if (day !== undefined && month !== undefined && year !== undefined) {
      return { assumption: "DATE_FORMAT_SLASH_DD_MM", value: validIsoDate(year, month, day) }
    }
  }

  return { assumption: null, value: null }
}

const monthNumbers = new Map([
  ["JAN", "01"],
  ["FEB", "02"],
  ["MAR", "03"],
  ["APR", "04"],
  ["MAY", "05"],
  ["JUN", "06"],
  ["JUL", "07"],
  ["AUG", "08"],
  ["SEP", "09"],
  ["OCT", "10"],
  ["NOV", "11"],
  ["DEC", "12"]
])

function validIsoDate(yearText: string, monthText: string, dayText: string): string | null {
  const year = Number.parseInt(yearText, 10)
  const month = Number.parseInt(monthText, 10)
  const day = Number.parseInt(dayText, 10)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  if (!valid) return null

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
}

function parseAmount(rawAmount: number | string | null): ParsedAmount {
  if (rawAmount === null) return { assumption: null, cents: null }
  if (typeof rawAmount === "string" && rawAmount.trim() === "") return { assumption: null, cents: null }
  const amount = Number(rawAmount)
  return Number.isFinite(amount)
    ? { assumption: typeof rawAmount === "string" ? "AMOUNT_TEXT_PARSED" : null, cents: Math.round(amount * 100) }
    : { assumption: null, cents: null }
}

function normalizeCurrency(rawCurrency: string | null): NormalizedCurrency {
  if (rawCurrency === null || rawCurrency.trim() === "") {
    return { assumption: "MISSING_CURRENCY_DEFAULT_CAD", value: DEFAULT_CURRENCY }
  }

  const currency = rawCurrency.trim().toLocaleUpperCase()
  return {
    assumption: rawCurrency === currency ? null : "LOWERCASE_CURRENCY_UPPERCASED",
    value: currency
  }
}

function normalizeCategory(rawCategory: string | null): NormalizedCategory {
  if (rawCategory === null || rawCategory.trim() === "") {
    return { assumption: "MISSING_CATEGORY_UNCATEGORIZED", id: "uncategorized" }
  }

  const normalized = rawCategory.trim().toLocaleLowerCase()
  for (const [id, label] of Object.entries(categoryLabels)) {
    if (normalized === label.toLocaleLowerCase()) {
      return {
        assumption: rawCategory === label ? null : "CATEGORY_CASE_NORMALIZED",
        id: id as CategoryId
      }
    }
  }

  return { assumption: "MISSING_CATEGORY_UNCATEGORIZED", id: "uncategorized" }
}

function companyFor(rawMerchant: string | null): CompanySuggestion {
  const descriptor = rawMerchant?.trim().toLocaleUpperCase() ?? ""
  if (/AMAZON|AMZN/.test(descriptor)) return company("amazon", "Amazon", "merchant", "shopping", 0.97)
  if (/UBER.*EATS|UBER EATS/.test(descriptor)) {
    return company("uber_eats", "Uber Eats", "merchant", "food_delivery", 0.96)
  }
  if (/UBER/.test(descriptor)) return company("uber", "Uber", "merchant", "transport", 0.96)
  if (/STARBUCKS/.test(descriptor)) return company("starbucks", "Starbucks", "merchant", "coffee", 0.98)
  if (/TIM HORTONS/.test(descriptor)) return company("tim_hortons", "Tim Hortons", "merchant", "coffee", 0.97)
  if (/NETFLIX/.test(descriptor)) return company("netflix", "Netflix", "merchant", "subscriptions", 0.98)
  if (/APPLE/.test(descriptor)) return company("apple", "Apple", "merchant", "subscriptions", 0.96)
  if (/SHELL/.test(descriptor)) return company("shell", "Shell", "merchant", "gas", 0.98)
  if (/LOBLAWS/.test(descriptor)) return company("loblaws", "Loblaws", "merchant", "groceries", 0.98)
  if (/IKEA/.test(descriptor)) return company("ikea", "IKEA", "merchant", "home", 0.98)
  if (/PIZZAIOLO/.test(descriptor)) return company("pizzaiolo", "Pizzaiolo", "merchant", "restaurants", 0.95)
  if (/SPOTIFY/.test(descriptor)) return company("spotify", "Spotify", "merchant", "subscriptions", 0.97)
  if (/PAYROLL/.test(descriptor)) return company("sofistic_ai", "Sofistic AI", "employer", "income", 0.98)
  if (/INTERAC/.test(descriptor)) {
    return company("interac", "Interac e-Transfer", "financial_transfer_counterparty", "uncategorized", 0.9)
  }
  return company("unknown", "Unknown Merchant", "unknown", "uncategorized", 0.35)
}

function company(
  id: string,
  display: string,
  type: string,
  defaultCategoryId: CategoryId,
  confidence: number
): CompanySuggestion {
  return { confidence, defaultCategoryId, display, id, type }
}

function businessKey(row: NormalizedRow): string {
  return JSON.stringify([row.date.value, row.merchant.id, row.amount.cents, row.currency.value, row.direction])
}

function compareRepresentativePreference(left: NormalizedRow, right: NormalizedRow): number {
  const externalIdOrder = Number(Boolean(right.row.external_id)) - Number(Boolean(left.row.external_id))
  if (externalIdOrder !== 0) return externalIdOrder

  const completenessOrder = completeness(right.row) - completeness(left.row)
  return completenessOrder === 0 ? left.row.id - right.row.id : completenessOrder
}

function completeness(row: RawRow): number {
  return ["external_id", "date", "merchant", "amount", "currency", "category"].filter((field) => {
    const value = row[field as keyof RawRow]
    return value !== null && value !== ""
  }).length
}

function normalizedDescriptor(rawMerchant: string): string {
  return rawMerchant.trim().toLocaleUpperCase().replaceAll(/\s+/g, " ")
}

function hasPending(rawMerchant: string | null): boolean {
  return /\bPENDING\b/i.test(rawMerchant ?? "")
}

function toNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

function stableHash(value: string, length = 16): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length)
}

function prefixedHash(prefix: string, value: string): string {
  return `${prefix}_${stableHash(value)}`
}

function defaultSeedFile(): string {
  return join(workspaceRoot(), "packages", "transactions-db", "seed", "transactions.json")
}

function workspaceRoot(): string {
  return findAncestorContaining("pnpm-workspace.yaml", process.cwd())
}

function findAncestorContaining(fileName: string, startDir: string): string {
  let currentDir = startDir
  while (!existsSync(join(currentDir, fileName))) {
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      throw new Error(`Could not find ${fileName} from ${startDir}`)
    }
    currentDir = parentDir
  }

  return currentDir
}
