import { describe, expect, it } from "vitest"

import { MerchantSearchQuery, RawTransactionRowId, StoredRawTransaction } from "@sofistic/transactions-shared"

import { cleanTransaction, listCleanTransactions, normalizeMerchant } from "./cleaning.js"

describe("transaction cleaning", () => {
  it("normalizes display fields and parses supported date formats", () => {
    const transaction = cleanTransaction(StoredRawTransaction.make({
      amount: "-11.74",
      category: "Transport",
      currency: "cad",
      date: "01/06/2026",
      external_id: "tx_1024",
      id: RawTransactionRowId.make(1),
      merchant: "UBER *TRIP"
    }))

    expect(transaction).toMatchObject({
      amountMinor: "-1174",
      category: "Transport",
      currency: "CAD",
      merchant: "Uber",
      transactionDate: "2026-06-01"
    })
  })

  it("uses a stable canonical id derived from cleaned transaction identity", () => {
    const first = cleanTransaction(StoredRawTransaction.make({
      amount: "-161.17",
      category: "Shopping",
      currency: "CAD",
      date: "07 Apr 2026",
      external_id: "tx_1021",
      id: RawTransactionRowId.make(1),
      merchant: "AMAZON.CA TORONTO ON"
    }))
    const second = cleanTransaction(StoredRawTransaction.make({
      amount: -161.17,
      category: "shopping",
      currency: "cad",
      date: "2026-04-07",
      external_id: "tx_duplicate",
      id: RawTransactionRowId.make(2),
      merchant: "AMZN Mktp CA"
    }))

    expect(first?.id).toMatch(/^ctx-[a-f0-9]{8}$/)
    expect(second?.id).toBe(first?.id)
  })

  it("dedupes by cleaned transaction identity and searches merchant display names", () => {
    const transactions = listCleanTransactions([
      StoredRawTransaction.make({
        amount: "-161.17",
        category: "Shopping",
        currency: "CAD",
        date: "07 Apr 2026",
        external_id: "tx_1021",
        id: RawTransactionRowId.make(1),
        merchant: "AMAZON.CA TORONTO ON"
      }),
      StoredRawTransaction.make({
        amount: -161.17,
        category: "shopping",
        currency: "cad",
        date: "2026-04-07",
        external_id: "tx_duplicate",
        id: RawTransactionRowId.make(2),
        merchant: "AMZN Mktp CA"
      }),
      StoredRawTransaction.make({
        amount: "-47.95",
        category: "Gas",
        currency: "cad",
        date: "2026-05-11",
        external_id: "tx_1066",
        id: RawTransactionRowId.make(3),
        merchant: "Shell"
      })
    ], MerchantSearchQuery.make("ama"))

    expect(transactions).toHaveLength(1)
    expect(transactions[0]).toMatchObject({
      amountMinor: "-16117",
      currency: "CAD",
      merchant: "Amazon"
    })
  })

  it("drops rows that cannot become trustworthy display transactions", () => {
    const transactions = listCleanTransactions([
      StoredRawTransaction.make({
        amount: null,
        category: "Coffee",
        currency: "CAD",
        date: "2026-06-18T00:00:00.000Z",
        external_id: "tx_1042",
        id: RawTransactionRowId.make(1),
        merchant: "STARBUCKS #1042"
      }),
      StoredRawTransaction.make({
        amount: "-10.00",
        category: "Coffee",
        currency: "USD",
        date: "2026-06-18T00:00:00.000Z",
        external_id: "tx_1043",
        id: RawTransactionRowId.make(2),
        merchant: "STARBUCKS #1043"
      })
    ], "")

    expect(transactions).toEqual([])
  })

  it("drops impossible dates, unsafe amounts, and suffix-only merchant descriptors", () => {
    const transactions = listCleanTransactions([
      StoredRawTransaction.make({
        amount: "-10.00",
        category: "Coffee",
        currency: "CAD",
        date: "2026-02-31",
        external_id: "bad_date",
        id: RawTransactionRowId.make(1),
        merchant: "STARBUCKS #1042"
      }),
      StoredRawTransaction.make({
        amount: "90071992547409.92",
        category: "Coffee",
        currency: "CAD",
        date: "2026-06-18",
        external_id: "unsafe_amount",
        id: RawTransactionRowId.make(2),
        merchant: "STARBUCKS #1043"
      }),
      StoredRawTransaction.make({
        amount: "-10.00",
        category: "Coffee",
        currency: "CAD",
        date: "2026-06-18",
        external_id: "empty_merchant",
        id: RawTransactionRowId.make(3),
        merchant: "CA ON TORONTO"
      })
    ], "")

    expect(transactions).toEqual([])
  })

  it("uses a generic merchant normalization fallback", () => {
    expect(normalizeMerchant("LOCAL BOOK SHOP TORONTO ON")).toBe("Local Book Shop")
  })
})
