import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath } from "node:url"

import { Either, Schema } from "effect"

import { RawTransaction } from "@sofistic/transactions-shared"

const RawTransactionList = Schema.Array(RawTransaction)

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const seedFile = join(packageDir, "seed", "transactions.json")
const dataDir = join(packageDir, "data")
const dbFile = join(dataDir, "app.db")

const rawSeed: unknown = JSON.parse(readFileSync(seedFile, "utf-8"))
const transactions = Schema.decodeUnknownEither(RawTransactionList)(rawSeed).pipe(
  Either.getOrThrowWith((error) => new Error(String(error)))
)

mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(dbFile)

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
  DROP TABLE IF EXISTS transactions;

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

const insert = db.prepare(`
  INSERT INTO transactions (external_id, date, merchant, amount, currency, category)
  VALUES (?, ?, ?, ?, ?, ?)
`)

db.exec("BEGIN")
for (const tx of transactions) {
  insert.run(
    tx.external_id,
    tx.date,
    tx.merchant,
    tx.amount,
    tx.currency,
    tx.category
  )
}
db.exec("COMMIT")

console.log(`Seeded ${transactions.length} rows into ${dbFile}`)
db.close()
