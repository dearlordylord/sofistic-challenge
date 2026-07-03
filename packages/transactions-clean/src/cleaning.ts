import {
  AmountMinor,
  CanonicalTransactionId,
  CategoryDisplayName,
  type CleanTransaction,
  type Currency,
  DedupeKey,
  isIsoCalendarDate,
  isSafeAmountMinor,
  MerchantDisplayName,
  type MerchantSearchQuery,
  type RawAmountValue,
  type StoredRawTransaction,
  TransactionDate
} from "@sofistic/transactions-shared"

const DEFAULT_CURRENCY: Currency = "CAD"
const DEFAULT_CATEGORY = CategoryDisplayName.make("Uncategorized")
const MINOR_UNITS_PER_MAJOR_UNIT = 100
const ISO_DATE_LENGTH = 10
const MIN_SLASH_DATE_PARTS = 3

const merchantAliases: ReadonlyArray<{
  readonly display: MerchantDisplayName
  readonly needles: ReadonlyArray<string>
}> = [
  { display: MerchantDisplayName.make("Amazon"), needles: ["AMAZON", "AMZN"] },
  { display: MerchantDisplayName.make("Apple"), needles: ["APPLE"] },
  { display: MerchantDisplayName.make("Loblaws"), needles: ["LOBLAWS"] },
  { display: MerchantDisplayName.make("Netflix"), needles: ["NETFLIX"] },
  { display: MerchantDisplayName.make("Shell"), needles: ["SHELL"] },
  { display: MerchantDisplayName.make("Starbucks"), needles: ["STARBUCKS"] },
  { display: MerchantDisplayName.make("Tim Hortons"), needles: ["TIM HORTONS", "TIMHORTONS"] },
  { display: MerchantDisplayName.make("Uber Eats"), needles: ["UBER EATS"] },
  { display: MerchantDisplayName.make("Uber"), needles: ["UBER"] }
]

const monthNumbers = new Map([
  ["JAN", "01"],
  ["FEB", "02"],
  ["MAR", "03"],
  ["APR", "04"],
  ["MAY", "05"],
  ["JUN", "06"],
  ["JUL", "07"],
  ["AUG", "08"],
  ["SEP", "09"],
  ["OCT", "10"],
  ["NOV", "11"],
  ["DEC", "12"]
])

export function listCleanTransactions(
  rows: ReadonlyArray<StoredRawTransaction>,
  searchQuery: MerchantSearchQuery | ""
): ReadonlyArray<CleanTransaction> {
  const byDedupeKey = new Map<DedupeKey, CleanTransaction>()

  for (const row of rows) {
    const transaction = cleanTransaction(row)
    if (transaction !== null && !byDedupeKey.has(transaction.dedupeKey)) {
      byDedupeKey.set(transaction.dedupeKey, transaction)
    }
  }

  return Array.from(byDedupeKey.values())
    .filter((transaction) => matchesSearch(transaction, searchQuery))
    .sort(compareNewestFirst)
}

export function cleanTransaction(row: StoredRawTransaction): CleanTransaction | null {
  const amountMinor = parseAmountMinor(row.amount)
  const date = parseDate(row.date)
  const merchant = normalizeMerchant(row.merchant)

  if (amountMinor === null || date === null || merchant === null) {
    return null
  }

  const currency = normalizeCurrency(row.currency)
  const category = normalizeCategory(row.category)
  if (currency === null) {
    return null
  }

  const dedupeKey = DedupeKey.make(`${date}|${merchant.toLocaleUpperCase()}|${amountMinor}|${currency}`)

  return {
    amountMinor,
    category,
    currency,
    dedupeKey,
    id: CanonicalTransactionId.make(`ctx-${stableId(dedupeKey)}`),
    merchant,
    sourceRowId: row.id,
    transactionDate: date
  }
}

export function normalizeMerchant(rawMerchant: string | null): MerchantDisplayName | null {
  if (rawMerchant === null) return null

  const compact = rawMerchant
    .trim()
    .replaceAll(/[.#*/_-]/g, " ")
    .replaceAll(/\s+/g, " ")
    .toLocaleUpperCase()

  if (compact === "") return null

  for (const alias of merchantAliases) {
    if (alias.needles.some((needle) => compact.includes(needle))) {
      return alias.display
    }
  }

  const fallback = titleCase(compact.replaceAll(/\b(ON|CA|CANADA|TORONTO)\b/g, "").trim())
  return fallback === "" ? null : MerchantDisplayName.make(fallback)
}

function parseAmountMinor(rawAmount: RawAmountValue): AmountMinor | null {
  if (rawAmount === null) return null
  const amount = typeof rawAmount === "number" ? rawAmount.toString() : rawAmount.trim()
  if (amount === "") return null

  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount)
  if (match === null) return null

  const sign = match[1] === "-" ? -1n : 1n
  const major = match[2]
  const fractional = match[3] ?? ""
  if (major === undefined) return null

  const cents = BigInt(major) * BigInt(MINOR_UNITS_PER_MAJOR_UNIT)
    + BigInt(fractional.padEnd(2, "0"))
  const amountMinor = (sign * cents).toString()
  return isSafeAmountMinor(amountMinor) ? AmountMinor.make(amountMinor) : null
}

function parseDate(rawDate: string | null): TransactionDate | null {
  if (rawDate === null) return null
  const value = rawDate.trim()
  if (value === "") return null

  const iso = parseIsoDate(value)
  if (iso !== null) return iso

  const namedMonth = parseNamedMonthDate(value)
  if (namedMonth !== null) return namedMonth

  return parseSlashDate(value)
}

function parseIsoDate(value: string): TransactionDate | null {
  const dateOnly = value.slice(0, ISO_DATE_LENGTH)
  return isIsoCalendarDate(dateOnly) ? TransactionDate.make(dateOnly) : null
}

function parseNamedMonthDate(value: string): TransactionDate | null {
  const parts = value.split(/\s+/)
  if (parts.length !== MIN_SLASH_DATE_PARTS) return null

  const dayText = parts[0]
  const monthText = parts[1]
  const yearText = parts[2]
  if (dayText === undefined || monthText === undefined || yearText === undefined) return null

  const month = monthNumbers.get(monthText.toLocaleUpperCase().slice(0, 3))
  if (month === undefined) return null

  return formatDateParts(yearText, month, dayText)
}

function parseSlashDate(value: string): TransactionDate | null {
  const parts = value.split("/")
  if (parts.length !== MIN_SLASH_DATE_PARTS) return null

  const dayText = parts[0]
  const monthText = parts[1]
  const yearText = parts[2]
  if (dayText === undefined || monthText === undefined || yearText === undefined) return null

  return formatDateParts(yearText, monthText, dayText)
}

function formatDateParts(yearText: string, monthText: string, dayText: string): TransactionDate | null {
  const year = Number.parseInt(yearText, 10)
  const month = Number.parseInt(monthText, 10)
  const day = Number.parseInt(dayText, 10)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${
    day.toString().padStart(2, "0")
  }`
  return isIsoCalendarDate(date) ? TransactionDate.make(date) : null
}

function normalizeCurrency(rawCurrency: string | null): Currency | null {
  const currency = rawCurrency?.trim().toLocaleUpperCase()
  if (currency === undefined || currency === "") return DEFAULT_CURRENCY
  return currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : null
}

function normalizeCategory(rawCategory: string | null): CategoryDisplayName {
  const category = rawCategory?.trim()
  return category === undefined || category === "" ? DEFAULT_CATEGORY : CategoryDisplayName.make(titleCase(category))
}

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((part) => part !== "")
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function matchesSearch(transaction: CleanTransaction, searchQuery: MerchantSearchQuery | ""): boolean {
  const query = searchQuery.trim().toLocaleUpperCase()
  return query === "" || transaction.merchant.toLocaleUpperCase().includes(query)
}

function compareNewestFirst(left: CleanTransaction, right: CleanTransaction): number {
  const dateOrder = right.transactionDate.localeCompare(left.transactionDate)
  return dateOrder === 0 ? left.sourceRowId - right.sourceRowId : dateOrder
}

function stableId(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    hash ^= code
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, "0")
}
