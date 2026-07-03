import { join } from "node:path"

import { materializeCanonicalTransactionModel } from "../src/canonical-materializer.js"

const dbFile = process.argv[2] ?? join(process.cwd(), "packages", "transactions-db", "data", "app.db")
const summary = materializeCanonicalTransactionModel(dbFile)

console.log(JSON.stringify(summary, null, 2))
