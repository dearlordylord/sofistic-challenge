import { Schema } from "effect"

export const NullableString = Schema.NullOr(Schema.String)
export const RawAmount = Schema.NullOr(Schema.Union(Schema.Number, Schema.String))

export const RawTransaction = Schema.Struct({
  amount: RawAmount,
  category: NullableString,
  currency: NullableString,
  date: NullableString,
  external_id: NullableString,
  merchant: NullableString
})
export type RawTransaction = Schema.Schema.Type<typeof RawTransaction>

export const StoredRawTransaction = Schema.Struct({
  amount: RawAmount,
  category: NullableString,
  currency: NullableString,
  date: NullableString,
  external_id: NullableString,
  id: Schema.Number,
  merchant: NullableString
})
export type StoredRawTransaction = Schema.Schema.Type<typeof StoredRawTransaction>

export type CleanTransaction = {
  readonly amountMinor: string
  readonly category: string
  readonly currency: "CAD"
  readonly dedupeKey: string
  readonly id: string
  readonly merchant: string
  readonly sourceRowId: number
  readonly transactionDate: string
}

export type TransactionSearch = {
  readonly query: string
}
