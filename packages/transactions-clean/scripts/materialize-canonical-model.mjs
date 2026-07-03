import { defaultDatabaseFile, materializeCanonicalTransactionModel } from "../src/canonical-materializer.ts"

const dbFile = process.argv[2] ?? defaultDatabaseFile()
const summary = materializeCanonicalTransactionModel(dbFile)

console.log(JSON.stringify(summary, null, 2))
