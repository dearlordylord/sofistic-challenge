import { describe, expect, it } from "vitest"

import { cleanTransaction, listCleanTransactions, normalizeMerchant } from "./cleaning.js"

describe("transaction cleaning", () => {
  it("normalizes display fields and parses supported date formats", () => {
    const transaction = cleanTransaction({
      amount: "-11.74",
      category: "Transport",
      currency: "cad",
      date: "01/06/2026",
      external_id: "tx_1024",
      id: 1,
      merchant: "UBER *TRIP"
    })

    expect(transaction).toMatchObject({
      amount: -11.74,
      category: "Transport",
      currency: "CAD",
      date: "2026-06-01",
      merchant: "Uber"
    })
  })

  it("dedupes by cleaned transaction identity and searches merchant display names", () => {
    const transactions = listCleanTransactions([
      {
        amount: "-161.17",
        category: "Shopping",
        currency: "CAD",
        date: "07 Apr 2026",
        external_id: "tx_1021",
        id: 1,
        merchant: "AMAZON.CA TORONTO ON"
      },
      {
        amount: -161.17,
        category: "shopping",
        currency: "cad",
        date: "2026-04-07",
        external_id: "tx_duplicate",
        id: 2,
        merchant: "AMZN Mktp CA"
      },
      {
        amount: "-47.95",
        category: "Gas",
        currency: "cad",
        date: "2026-05-11",
        external_id: "tx_1066",
        id: 3,
        merchant: "Shell"
      }
    ], "ama")

    expect(transactions).toHaveLength(1)
    expect(transactions[0]).toMatchObject({
      id: "tx_1021",
      merchant: "Amazon"
    })
  })

  it("drops rows that cannot become trustworthy display transactions", () => {
    const transactions = listCleanTransactions([
      {
        amount: null,
        category: "Coffee",
        currency: "CAD",
        date: "2026-06-18T00:00:00.000Z",
        external_id: "tx_1042",
        id: 1,
        merchant: "STARBUCKS #1042"
      }
    ], "")

    expect(transactions).toEqual([])
  })

  it("uses a generic merchant normalization fallback", () => {
    expect(normalizeMerchant("LOCAL BOOK SHOP TORONTO ON")).toBe("Local Book Shop")
  })
})
