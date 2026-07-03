import { Schema } from "effect"

const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER)

const NonEmptyText = Schema.Trim.pipe(Schema.nonEmptyString(), Schema.brand("NonEmptyText"))

export const TransactionCount = Schema.NonNegativeInt.pipe(Schema.brand("TransactionCount")).annotations({
  identifier: "TransactionCount",
  title: "TransactionCount",
  description: "Non-negative count of transaction rows or records."
})
export type TransactionCount = Schema.Schema.Type<typeof TransactionCount>

export const MerchantSearchQuery = Schema.Trim.pipe(Schema.brand("MerchantSearchQuery")).annotations({
  identifier: "MerchantSearchQuery",
  title: "MerchantSearchQuery",
  description: "Merchant search query supplied by the client, trimmed before use."
})
export type MerchantSearchQuery = Schema.Schema.Type<typeof MerchantSearchQuery>

export const Currency = Schema.Literal("CAD").annotations({
  identifier: "Currency",
  title: "Currency",
  description: "Supported transaction currency."
})
export type Currency = Schema.Schema.Type<typeof Currency>

export const AmountMinor = Schema.String.pipe(
  Schema.filter(isSafeMinorUnitText),
  Schema.brand("AmountMinor")
).annotations({
  identifier: "AmountMinor",
  title: "AmountMinor",
  description: "Signed monetary amount in minor units, safe for frontend Number formatting."
})
export type AmountMinor = Schema.Schema.Type<typeof AmountMinor>

export const TransactionDate = Schema.String.pipe(
  Schema.filter(isIsoCalendarDate),
  Schema.brand("TransactionDate")
).annotations({
  identifier: "TransactionDate",
  title: "TransactionDate",
  description: "Valid transaction posting date in YYYY-MM-DD form."
})
export type TransactionDate = Schema.Schema.Type<typeof TransactionDate>

export const CanonicalTransactionId = Schema.String.pipe(
  Schema.filter((value) => /^ctx[-_][a-f0-9]{8,16}$/.test(value)),
  Schema.brand("CanonicalTransactionId")
).annotations({
  identifier: "CanonicalTransactionId",
  title: "CanonicalTransactionId",
  description: "Stable id for a canonical display transaction."
})
export type CanonicalTransactionId = Schema.Schema.Type<typeof CanonicalTransactionId>

export const CategoryDisplayName = NonEmptyText.pipe(Schema.brand("CategoryDisplayName")).annotations({
  identifier: "CategoryDisplayName",
  title: "CategoryDisplayName",
  description: "Display-ready transaction category label."
})
export type CategoryDisplayName = Schema.Schema.Type<typeof CategoryDisplayName>

export const MerchantDisplayName = NonEmptyText.pipe(Schema.brand("MerchantDisplayName")).annotations({
  identifier: "MerchantDisplayName",
  title: "MerchantDisplayName",
  description: "Display-ready merchant or counterparty name."
})
export type MerchantDisplayName = Schema.Schema.Type<typeof MerchantDisplayName>

export const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
  transactionsInDb: TransactionCount
})
export type HealthResponse = Schema.Schema.Type<typeof HealthResponse>

export const TransactionSearchParams = Schema.Struct({
  merchantQuery: Schema.optional(MerchantSearchQuery)
})
export type TransactionSearchParams = Schema.Schema.Type<typeof TransactionSearchParams>

export const TransactionFeedItem = Schema.Struct({
  amountMinor: AmountMinor,
  category: CategoryDisplayName,
  currency: Currency,
  id: CanonicalTransactionId,
  merchant: MerchantDisplayName,
  transactionDate: TransactionDate
})
export type TransactionFeedItem = Schema.Schema.Type<typeof TransactionFeedItem>

export const TransactionsResponse = Schema.Struct({
  items: Schema.Array(TransactionFeedItem)
})
export type TransactionsResponse = Schema.Schema.Type<typeof TransactionsResponse>

function isIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false

  const year = Number.parseInt(match[1] ?? "", 10)
  const month = Number.parseInt(match[2] ?? "", 10)
  const day = Number.parseInt(match[3] ?? "", 10)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false

  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isSafeMinorUnitText(value: string): boolean {
  if (!/^-?\d+$/.test(value)) return false

  const minorUnits = BigInt(value)
  return minorUnits >= -MAX_SAFE_MINOR_UNITS && minorUnits <= MAX_SAFE_MINOR_UNITS
}
