import { Either } from "effect"
import { describe, expect, it } from "vitest"

import { decodeUnknown, TransactionSearchParams, TransactionsResponse } from "./index.js"

describe("transaction api schemas", () => {
  it("decodes the first-version transactions response contract", () => {
    const decoded = decodeUnknown(TransactionsResponse, {
      items: [
        {
          amountMinor: "-1798",
          category: "Shopping",
          currency: "CAD",
          id: "ctx-12345678",
          merchant: "Amazon",
          transactionDate: "2026-06-18"
        }
      ]
    })

    expect(Either.isRight(decoded)).toBe(true)
  })

  it("rejects floating money, arbitrary currency, and timestamp dates", () => {
    const decoded = decodeUnknown(TransactionsResponse, {
      items: [
        {
          amountMinor: -17.98,
          category: "Shopping",
          currency: "USD",
          id: "ctx-12345678",
          merchant: "Amazon",
          transactionDate: "2026-06-18T00:00:00.000Z"
        }
      ]
    })

    expect(Either.isLeft(decoded)).toBe(true)
  })

  it("rejects impossible calendar dates and unsafe minor-unit amounts", () => {
    const impossibleDate = decodeUnknown(TransactionsResponse, {
      items: [
        {
          amountMinor: "-1798",
          category: "Shopping",
          currency: "CAD",
          id: "ctx-12345678",
          merchant: "Amazon",
          transactionDate: "2026-02-31"
        }
      ]
    })
    const unsafeAmount = decodeUnknown(TransactionsResponse, {
      items: [
        {
          amountMinor: "9007199254740992",
          category: "Shopping",
          currency: "CAD",
          id: "ctx-12345678",
          merchant: "Amazon",
          transactionDate: "2026-06-18"
        }
      ]
    })

    expect(Either.isLeft(impossibleDate)).toBe(true)
    expect(Either.isLeft(unsafeAmount)).toBe(true)
  })

  it("uses explicit merchantQuery search params", () => {
    const decoded = decodeUnknown(TransactionSearchParams, {
      merchantQuery: "Amazon"
    })

    expect(decoded).toEqual(Either.right({ merchantQuery: "Amazon" }))
  })

  it("accepts empty merchantQuery as an all-transactions search", () => {
    const decoded = decodeUnknown(TransactionSearchParams, {
      merchantQuery: "   "
    })

    expect(decoded).toEqual(Either.right({ merchantQuery: "" }))
  })
})
