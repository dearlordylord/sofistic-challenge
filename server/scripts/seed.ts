/**
 * Seeds data/app.db from seed/transactions.json.
 *
 * The data is intentionally messy (duplicates, inconsistent merchant names,
 * mixed date formats, missing fields). It is inserted AS-IS — cleaning it up
 * is part of the exercise.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

type RawTransaction = {
  external_id: string | null;
  date: string | null;
  merchant: string | null;
  amount: number | string | null;
  currency: string | null;
  category: string | null;
};

const seedFile = join(__dirname, '..', 'seed', 'transactions.json');
const dataDir = join(__dirname, '..', 'data');
const dbFile = join(dataDir, 'app.db');

const transactions: RawTransaction[] = JSON.parse(
  readFileSync(seedFile, 'utf-8'),
);

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbFile);

db.exec(`
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
`);

const insert = db.prepare(`
  INSERT INTO transactions (external_id, date, merchant, amount, currency, category)
  VALUES (?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN');
for (const tx of transactions) {
  insert.run(
    tx.external_id,
    tx.date,
    tx.merchant,
    tx.amount,
    tx.currency,
    tx.category,
  );
}
db.exec('COMMIT');

console.log(`Seeded ${transactions.length} rows into ${dbFile}`);
db.close();
