import type { CleanTransaction, StoredRawTransaction } from "@sofistic/transactions-shared"

const DEFAULT_CURRENCY = "CAD"
const DEFAULT_CATEGORY = "Uncategorized"
const ISO_DATE_LENGTH = 10
const MIN_SLASH_DATE_PARTS = 3

const merchantAliases: ReadonlyArray<{
  readonly display: string
  readonly needles: ReadonlyArray<string>
}> = [
  { display: "Amazon", needles: ["AMAZON", "AMZN"] },
  { display: "Apple", needles: ["APPLE"] },
  { display: "Loblaws", needles: ["LOBLAWS"] },
  { display: "Netflix", needles: ["NETFLIX"] },
  { display: "Shell", needles: ["SHELL"] },
  { display: "Starbucks", needles: ["STARBUCKS"] },
  { display: "Tim Hortons", needles: ["TIM HORTONS", "TIMHORTONS"] },
  { display: "Uber Eats", needles: ["UBER EATS"] },
  { display: "Uber", needles: ["UBER"] }
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
  searchQuery: string
): ReadonlyArray<CleanTransaction> {
  const byDedupeKey = new Map<string, CleanTransaction>()

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
  const amount = parseAmount(row.amount)
  const date = parseDate(row.date)
  const merchant = normalizeMerchant(row.merchant)

  if (amount === null || date === null || merchant === null) {
    return null
  }

  const currency = normalizeCurrency(row.currency)
  const category = normalizeCategory(row.category)
  const dedupeKey = `${date}|${merchant.toLocaleUpperCase()}|${amount.toFixed(2)}|${currency}`

  return {
    amount,
    category,
    currency,
    date,
    dedupeKey,
    id: row.external_id?.trim() === "" || row.external_id === null ? `row-${row.id}` : row.external_id.trim(),
    merchant,
    sourceRowId: row.id
  }
}

export function normalizeMerchant(rawMerchant: string | null): string | null {
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

  return titleCase(compact.replaceAll(/\b(ON|CA|CANADA|TORONTO)\b/g, "").trim())
}

function parseAmount(rawAmount: number | string | null): number | null {
  if (rawAmount === null) return null
  const amount = typeof rawAmount === "number" ? rawAmount : Number.parseFloat(rawAmount)
  return Number.isFinite(amount) ? amount : null
}

function parseDate(rawDate: string | null): string | null {
  if (rawDate === null) return null
  const value = rawDate.trim()
  if (value === "") return null

  const iso = parseIsoDate(value)
  if (iso !== null) return iso

  const namedMonth = parseNamedMonthDate(value)
  if (namedMonth !== null) return namedMonth

  return parseSlashDate(value)
}

function parseIsoDate(value: string): string | null {
  const dateOnly = value.slice(0, ISO_DATE_LENGTH)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null
}

function parseNamedMonthDate(value: string): string | null {
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

function parseSlashDate(value: string): string | null {
  const parts = value.split("/")
  if (parts.length !== MIN_SLASH_DATE_PARTS) return null

  const dayText = parts[0]
  const monthText = parts[1]
  const yearText = parts[2]
  if (dayText === undefined || monthText === undefined || yearText === undefined) return null

  return formatDateParts(yearText, monthText, dayText)
}

function formatDateParts(yearText: string, monthText: string, dayText: string): string | null {
  const year = Number.parseInt(yearText, 10)
  const month = Number.parseInt(monthText, 10)
  const day = Number.parseInt(dayText, 10)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
}

function normalizeCurrency(rawCurrency: string | null): string {
  const currency = rawCurrency?.trim().toLocaleUpperCase()
  return currency === undefined || currency === "" ? DEFAULT_CURRENCY : currency
}

function normalizeCategory(rawCategory: string | null): string {
  const category = rawCategory?.trim()
  return category === undefined || category === "" ? DEFAULT_CATEGORY : titleCase(category)
}

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((part) => part !== "")
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function matchesSearch(transaction: CleanTransaction, searchQuery: string): boolean {
  const query = searchQuery.trim().toLocaleUpperCase()
  return query === "" || transaction.merchant.toLocaleUpperCase().includes(query)
}

function compareNewestFirst(left: CleanTransaction, right: CleanTransaction): number {
  const dateOrder = right.date.localeCompare(left.date)
  return dateOrder === 0 ? left.sourceRowId - right.sourceRowId : dateOrder
}
