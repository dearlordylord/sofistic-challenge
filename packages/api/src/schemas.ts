import { Schema } from "effect"

export const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
  transactionsInDb: Schema.Number
})
export type HealthResponse = Schema.Schema.Type<typeof HealthResponse>

export const TransactionSearchParams = Schema.Struct({
  q: Schema.optional(Schema.String)
})
export type TransactionSearchParams = Schema.Schema.Type<typeof TransactionSearchParams>

export const TransactionFeedItem = Schema.Struct({
  amount: Schema.Number,
  category: Schema.String,
  currency: Schema.String,
  date: Schema.String,
  id: Schema.String,
  merchant: Schema.String
})
export type TransactionFeedItem = Schema.Schema.Type<typeof TransactionFeedItem>

export const TransactionsResponse = Schema.Struct({
  items: Schema.Array(TransactionFeedItem)
})
export type TransactionsResponse = Schema.Schema.Type<typeof TransactionsResponse>
