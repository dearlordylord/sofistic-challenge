import { Schema } from "effect"

import {
  AmountMinor,
  CanonicalTransactionId,
  CategoryDisplayName,
  Currency,
  DedupeKey,
  MerchantDisplayName,
  MerchantSearchQuery,
  RawAmountValue,
  RawNullableText,
  RawTransactionRowId,
  TransactionDate
} from "./domain.js"

export const NullableString = RawNullableText
export const RawAmount = RawAmountValue

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
  id: RawTransactionRowId,
  merchant: NullableString
})
export type StoredRawTransaction = Schema.Schema.Type<typeof StoredRawTransaction>

export const CleanTransaction = Schema.Struct({
  amountMinor: AmountMinor,
  category: CategoryDisplayName,
  currency: Currency,
  dedupeKey: DedupeKey,
  id: CanonicalTransactionId,
  merchant: MerchantDisplayName,
  sourceRowId: RawTransactionRowId,
  transactionDate: TransactionDate
})
export type CleanTransaction = Schema.Schema.Type<typeof CleanTransaction>

export const TransactionSearch = Schema.Struct({
  query: MerchantSearchQuery
})
export type TransactionSearch = Schema.Schema.Type<typeof TransactionSearch>
