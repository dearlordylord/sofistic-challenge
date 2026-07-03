import { Schema } from "effect"

export const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
  transactionsInDb: Schema.Number
})
export type HealthResponse = Schema.Schema.Type<typeof HealthResponse>

export const TransactionSearchParams = Schema.Struct({
  merchantQuery: Schema.optional(Schema.String)
})
export type TransactionSearchParams = Schema.Schema.Type<typeof TransactionSearchParams>

export const Currency = Schema.Literal("CAD")
export type Currency = Schema.Schema.Type<typeof Currency>

export const AmountMinor = Schema.String.pipe(
  Schema.pattern(/^-?\d+$/)
)
export type AmountMinor = Schema.Schema.Type<typeof AmountMinor>

export const TransactionDate = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}$/)
)
export type TransactionDate = Schema.Schema.Type<typeof TransactionDate>

export const TransactionFeedItem = Schema.Struct({
  amountMinor: AmountMinor,
  category: Schema.String,
  currency: Currency,
  id: Schema.String,
  merchant: Schema.String,
  transactionDate: TransactionDate
})
export type TransactionFeedItem = Schema.Schema.Type<typeof TransactionFeedItem>

export const TransactionsResponse = Schema.Struct({
  items: Schema.Array(TransactionFeedItem)
})
export type TransactionsResponse = Schema.Schema.Type<typeof TransactionsResponse>
