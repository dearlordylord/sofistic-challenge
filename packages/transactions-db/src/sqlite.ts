import { Context, Effect, Layer, Schema } from "effect"
import { DatabaseSync } from "node:sqlite"

import { StoredRawTransaction, TransactionCount } from "@sofistic/transactions-shared"

const CountRow = Schema.Struct({
  count: TransactionCount
})

const StoredRawTransactionList = Schema.Array(StoredRawTransaction)

export class TransactionStorageError extends Error {
  override readonly name = "TransactionStorageError"

  constructor(message: string, cause: unknown) {
    super(message, { cause })
  }
}

export type TransactionRepository = {
  readonly count: Effect.Effect<TransactionCount, TransactionStorageError>
  readonly findAll: Effect.Effect<ReadonlyArray<StoredRawTransaction>, TransactionStorageError>
}

export class TransactionRepositoryService extends Context.Tag("@sofistic/TransactionRepositoryService")<
  TransactionRepositoryService,
  TransactionRepository
>() {}

export function sqliteTransactionRepositoryLayer(
  dbFile: string
): Layer.Layer<TransactionRepositoryService, TransactionStorageError> {
  return Layer.effect(TransactionRepositoryService, makeSqliteTransactionRepository(dbFile))
}

export function makeSqliteTransactionRepository(
  dbFile: string
): Effect.Effect<TransactionRepository, TransactionStorageError> {
  return Effect.try({
    catch: (cause) => new TransactionStorageError(`Could not open transaction database at ${dbFile}`, cause),
    try: () => new DatabaseSync(dbFile)
  }).pipe(Effect.map(makeRepository))
}

function makeRepository(db: DatabaseSync): TransactionRepository {
  return {
    count: Effect.try({
      catch: (cause) => new TransactionStorageError("Could not count transactions", cause),
      try: () => db.prepare("SELECT COUNT(*) AS count FROM transactions").get()
    }).pipe(
      Effect.flatMap((row) => decodeDbValue(CountRow, row)),
      Effect.map((row) => row.count)
    ),
    findAll: Effect.try({
      catch: (cause) => new TransactionStorageError("Could not read transactions", cause),
      try: () =>
        db.prepare(`
          SELECT id, external_id, date, merchant, amount, currency, category
          FROM transactions
          ORDER BY id ASC
        `).all()
    }).pipe(
      Effect.flatMap((rows) => decodeDbValue(StoredRawTransactionList, rows))
    )
  }
}

function decodeDbValue<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: unknown
): Effect.Effect<A, TransactionStorageError> {
  return Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((cause) => new TransactionStorageError("Database returned an unexpected shape", cause))
  )
}
