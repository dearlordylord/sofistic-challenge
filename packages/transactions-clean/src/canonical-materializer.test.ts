import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { afterEach, describe, expect, it } from "vitest"

import { defaultDatabaseFile, materializeCanonicalTransactionModel } from "./canonical-materializer.js"

const tempDirs: Array<string> = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true })
  }
})

describe("canonical transaction materializer", () => {
  it("seeds a missing database and materializes canonical/provenance tables", () => {
    const dbFile = tempDbFile()

    const summary = materializeCanonicalTransactionModel(dbFile)

    expect(summary).toMatchObject({
      acceptedLlmSuggestions: 14,
      aliases: 29,
      canonicalTransactions: 73,
      companies: 14,
      duplicateSources: 13,
      exceptions: 0,
      idempotentSkip: false,
      llmSuggestions: 14,
      mappingDecisions: 243,
      rawTransactions: 86,
      rejectedLlmSuggestions: 0,
      sourceLinks: 86
    })
  })

  it("skips a completed materialization for the same raw input", () => {
    const dbFile = tempDbFile()

    materializeCanonicalTransactionModel(dbFile)
    const secondRun = materializeCanonicalTransactionModel(dbFile)

    expect(secondRun.idempotentSkip).toBe(true)
  })

  it("rebuilds partial materialization state", () => {
    const dbFile = tempDbFile()
    materializeCanonicalTransactionModel(dbFile)

    withDb(dbFile, (db) => {
      db.exec("DELETE FROM mapping_decisions WHERE id IN (SELECT id FROM mapping_decisions LIMIT 5)")
    })

    const summary = materializeCanonicalTransactionModel(dbFile)

    expect(summary.idempotentSkip).toBe(false)
    expect(summary.mappingDecisions).toBe(243)
  })

  it("rebuilds when raw data changes without changing raw row count", () => {
    const dbFile = tempDbFile()
    materializeCanonicalTransactionModel(dbFile)

    withDb(dbFile, (db) => {
      db.prepare("UPDATE transactions SET merchant = ? WHERE id = 1").run("AMAZON.CA TORONTO ON")
    })

    const summary = materializeCanonicalTransactionModel(dbFile)

    expect(summary.idempotentSkip).toBe(false)
    expect(canonicalMerchantForRawRow(dbFile, 1)).toBe("Amazon")
  })

  it("excepts invalid financial facts instead of canonicalizing them", () => {
    const dbFile = tempDbFile()
    withDb(dbFile, (db) => {
      createRawTable(db)
      db.prepare(`
        INSERT INTO transactions (external_id, date, merchant, amount, currency, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("bad_1", "2026-99-99", "STARBUCKS #1042", "", "CAD", "Coffee")
    })

    const summary = materializeCanonicalTransactionModel(dbFile)

    expect(summary.canonicalTransactions).toBe(0)
    expect(summary.exceptions).toBe(1)
  })

  it("excepts unsupported currencies instead of coercing them to CAD", () => {
    const dbFile = tempDbFile()
    withDb(dbFile, (db) => {
      createRawTable(db)
      db.prepare(`
        INSERT INTO transactions (external_id, date, merchant, amount, currency, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("usd_1", "2026-06-18", "STARBUCKS #1042", "-10.00", "USD", "Coffee")
    })

    const summary = materializeCanonicalTransactionModel(dbFile)

    expect(summary.canonicalTransactions).toBe(0)
    expect(summary.exceptions).toBe(1)
  })

  it("persists rejected LLM suggestions without creating reusable aliases", () => {
    const dbFile = tempDbFile()
    withDb(dbFile, (db) => {
      createRawTable(db)
      db.prepare(`
        INSERT INTO transactions (external_id, date, merchant, amount, currency, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("unknown_1", "2026-05-01", "MYSTERY DESCRIPTOR", -123.45, "CAD", null)
    })

    const summary = materializeCanonicalTransactionModel(dbFile)

    expect(summary.canonicalTransactions).toBe(1)
    expect(summary.aliases).toBe(0)
    expect(summary.rejectedLlmSuggestions).toBe(1)
    expect(decisionCount(dbFile, "LLM_SUGGESTION_REJECTED")).toBe(1)
  })

  it("resolves the default DB path from the workspace root", () => {
    expect(defaultDatabaseFile()).toMatch(/packages\/transactions-db\/data\/app\.db$/)
    expect(defaultDatabaseFile()).not.toContain("packages/transactions-clean/packages")
  })
})

function tempDbFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "sofistic-clean-"))
  tempDirs.push(dir)
  return join(dir, "app.db")
}

function withDb<A>(dbFile: string, use: (db: DatabaseSync) => A): A {
  const db = new DatabaseSync(dbFile)
  try {
    return use(db)
  } finally {
    db.close()
  }
}

function createRawTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT,
      date TEXT,
      merchant TEXT,
      amount,
      currency TEXT,
      category TEXT
    );
  `)
}

function canonicalMerchantForRawRow(dbFile: string, rawRowId: number): string | null {
  return withDb(dbFile, (db) => {
    const row = db.prepare(`
      SELECT canonical_transactions.display_merchant AS merchant
      FROM canonical_transaction_sources
      JOIN canonical_transactions ON canonical_transactions.id = canonical_transaction_sources.canonical_transaction_id
      WHERE canonical_transaction_sources.raw_transaction_id = ?
    `).get(rawRowId) as { readonly merchant: string } | undefined
    return row?.merchant ?? null
  })
}

function decisionCount(dbFile: string, assumptionGroupId: string): number {
  return withDb(dbFile, (db) => {
    const row = db.prepare("SELECT COUNT(*) AS count FROM mapping_decisions WHERE assumption_group_id = ?")
      .get(assumptionGroupId) as { readonly count: number }
    return row.count
  })
}
