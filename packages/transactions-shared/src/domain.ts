import { Schema } from "effect"

const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER)

export const NonEmptyText = Schema.Trim.pipe(Schema.nonEmptyString(), Schema.brand("NonEmptyText")).annotations({
  identifier: "NonEmptyText",
  title: "NonEmptyText",
  description: "Trimmed non-empty display text."
})
export type NonEmptyText = Schema.Schema.Type<typeof NonEmptyText>

export const TransactionCount = Schema.NonNegativeInt.pipe(Schema.brand("TransactionCount")).annotations({
  identifier: "TransactionCount",
  title: "TransactionCount",
  description: "Non-negative count of transaction rows or records."
})
export type TransactionCount = Schema.Schema.Type<typeof TransactionCount>

export const RawTransactionRowId = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand("RawTransactionRowId")
).annotations({
  identifier: "RawTransactionRowId",
  title: "RawTransactionRowId",
  description: "SQLite row id for an immutable raw transaction."
})
export type RawTransactionRowId = Schema.Schema.Type<typeof RawTransactionRowId>

export const ExternalTransactionId = NonEmptyText.pipe(Schema.brand("ExternalTransactionId")).annotations({
  identifier: "ExternalTransactionId",
  title: "ExternalTransactionId",
  description: "Source-system transaction identifier from the raw feed."
})
export type ExternalTransactionId = Schema.Schema.Type<typeof ExternalTransactionId>

export const CanonicalTransactionId = Schema.String.pipe(
  Schema.pattern(/^ctx[-_][a-f0-9]{8,16}$/),
  Schema.brand("CanonicalTransactionId")
).annotations({
  identifier: "CanonicalTransactionId",
  title: "CanonicalTransactionId",
  description: "Stable id for a canonical display transaction."
})
export type CanonicalTransactionId = Schema.Schema.Type<typeof CanonicalTransactionId>

export const DedupeKey = NonEmptyText.pipe(Schema.brand("DedupeKey")).annotations({
  identifier: "DedupeKey",
  title: "DedupeKey",
  description: "Normalized business identity used to suppress duplicate raw transactions."
})
export type DedupeKey = Schema.Schema.Type<typeof DedupeKey>

export const MerchantDisplayName = NonEmptyText.pipe(Schema.brand("MerchantDisplayName")).annotations({
  identifier: "MerchantDisplayName",
  title: "MerchantDisplayName",
  description: "Display-ready merchant or counterparty name."
})
export type MerchantDisplayName = Schema.Schema.Type<typeof MerchantDisplayName>

export const MerchantSearchQuery = NonEmptyText.pipe(Schema.brand("MerchantSearchQuery")).annotations({
  identifier: "MerchantSearchQuery",
  title: "MerchantSearchQuery",
  description: "Non-empty merchant search query supplied by the client."
})
export type MerchantSearchQuery = Schema.Schema.Type<typeof MerchantSearchQuery>

export const AmountMinor = Schema.String.pipe(
  Schema.pattern(/^-?\d+$/),
  Schema.filter(isSafeAmountMinor),
  Schema.brand("AmountMinor")
).annotations({
  identifier: "AmountMinor",
  title: "AmountMinor",
  description: "Signed monetary amount in minor units, safe for frontend Number formatting."
})
export type AmountMinor = Schema.Schema.Type<typeof AmountMinor>

export const AmountCents = Schema.Number.pipe(Schema.int(), Schema.brand("AmountCents")).annotations({
  identifier: "AmountCents",
  title: "AmountCents",
  description: "Signed monetary amount in CAD cents for canonical SQLite storage."
})
export type AmountCents = Schema.Schema.Type<typeof AmountCents>

export const TransactionDate = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}$/),
  Schema.filter(isIsoCalendarDate),
  Schema.brand("TransactionDate")
).annotations({
  identifier: "TransactionDate",
  title: "TransactionDate",
  description: "Valid transaction posting date in YYYY-MM-DD form."
})
export type TransactionDate = Schema.Schema.Type<typeof TransactionDate>

export const Currency = Schema.Literal("CAD").annotations({
  identifier: "Currency",
  title: "Currency",
  description: "Supported transaction currency."
})
export type Currency = Schema.Schema.Type<typeof Currency>

export const CategoryId = Schema.Literal(
  "coffee",
  "food_delivery",
  "gas",
  "groceries",
  "home",
  "income",
  "restaurants",
  "shopping",
  "subscriptions",
  "transport",
  "uncategorized"
).annotations({
  identifier: "CategoryId",
  title: "CategoryId",
  description: "Controlled canonical transaction category id."
})
export type CategoryId = Schema.Schema.Type<typeof CategoryId>

export const CategoryDisplayName = NonEmptyText.pipe(Schema.brand("CategoryDisplayName")).annotations({
  identifier: "CategoryDisplayName",
  title: "CategoryDisplayName",
  description: "Display-ready transaction category label."
})
export type CategoryDisplayName = Schema.Schema.Type<typeof CategoryDisplayName>

export const CompanyId = NonEmptyText.pipe(Schema.brand("CompanyId")).annotations({
  identifier: "CompanyId",
  title: "CompanyId",
  description: "Stable canonical company or counterparty id."
})
export type CompanyId = Schema.Schema.Type<typeof CompanyId>

export const CompanyDisplayName = NonEmptyText.pipe(Schema.brand("CompanyDisplayName")).annotations({
  identifier: "CompanyDisplayName",
  title: "CompanyDisplayName",
  description: "Display-ready company or counterparty name."
})
export type CompanyDisplayName = Schema.Schema.Type<typeof CompanyDisplayName>

export const CompanyType = Schema.Literal(
  "employer",
  "financial_transfer_counterparty",
  "merchant",
  "unknown"
).annotations({
  identifier: "CompanyType",
  title: "CompanyType",
  description: "Canonical company classification used by raw-to-canonical mapping."
})
export type CompanyType = Schema.Schema.Type<typeof CompanyType>

export const TransactionDirection = Schema.Literal("credit", "debit").annotations({
  identifier: "TransactionDirection",
  title: "TransactionDirection",
  description: "Money movement direction from the user's perspective."
})
export type TransactionDirection = Schema.Schema.Type<typeof TransactionDirection>

export const TransactionStatus = Schema.Literal("pending", "posted").annotations({
  identifier: "TransactionStatus",
  title: "TransactionStatus",
  description: "Canonical transaction posting status."
})
export type TransactionStatus = Schema.Schema.Type<typeof TransactionStatus>

export const Confidence = Schema.Number.pipe(Schema.between(0, 1), Schema.brand("Confidence")).annotations({
  identifier: "Confidence",
  title: "Confidence",
  description: "Mapping confidence from zero through one."
})
export type Confidence = Schema.Schema.Type<typeof Confidence>

export const MappingRunId = NonEmptyText.pipe(Schema.brand("MappingRunId")).annotations({
  identifier: "MappingRunId",
  title: "MappingRunId",
  description: "Identifier for a deterministic raw-to-canonical mapping run."
})
export type MappingRunId = Schema.Schema.Type<typeof MappingRunId>

export const AssumptionCode = Schema.Literal(
  "AMOUNT_TEXT_PARSED",
  "CATEGORY_CASE_NORMALIZED",
  "DATE_FORMAT_SLASH_DD_MM",
  "DATE_ISO_TIMESTAMP_TRUNCATED",
  "DATE_TEXT_MONTH_PARSED",
  "DUPLICATE_SUPPRESSED",
  "LLM_MERCHANT_SEMANTIC_MAPPING",
  "LLM_SUGGESTION_REJECTED",
  "LOWERCASE_CURRENCY_UPPERCASED",
  "MISSING_CATEGORY_UNCATEGORIZED",
  "MISSING_CURRENCY_DEFAULT_CAD",
  "MISSING_EXTERNAL_ID_FINGERPRINTED",
  "PENDING_STATUS_EXTRACTED",
  "REPRESENTATIVE_SELECTED"
).annotations({
  identifier: "AssumptionCode",
  title: "AssumptionCode",
  description: "Stable code for a materialized raw-to-canonical mapping assumption."
})
export type AssumptionCode = Schema.Schema.Type<typeof AssumptionCode>

export const RawNullableText = Schema.NullOr(Schema.String).annotations({
  identifier: "RawNullableText",
  title: "RawNullableText",
  description: "Raw nullable text from the ingestion seam. Decode to a named domain type before use."
})
export type RawNullableText = Schema.Schema.Type<typeof RawNullableText>

export const RawAmountValue = Schema.NullOr(Schema.Union(Schema.Number, Schema.String)).annotations({
  identifier: "RawAmountValue",
  title: "RawAmountValue",
  description: "Raw amount value exactly as SQLite or the seed feed provides it."
})
export type RawAmountValue = Schema.Schema.Type<typeof RawAmountValue>

export function isIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false

  const year = Number.parseInt(match[1] ?? "", 10)
  const month = Number.parseInt(match[2] ?? "", 10)
  const day = Number.parseInt(match[3] ?? "", 10)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false

  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isSafeAmountMinor(value: string): boolean {
  if (!/^-?\d+$/.test(value)) return false

  const minorUnits = BigInt(value)
  return minorUnits >= -MAX_SAFE_MINOR_UNITS && minorUnits <= MAX_SAFE_MINOR_UNITS
}
