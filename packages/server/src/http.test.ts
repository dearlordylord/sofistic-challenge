import { describe, expect, it } from "vitest"

import { toTransactionFeedItem } from "./feed-mapping.js"

describe("transaction http mapping", () => {
  it("keeps cleanup/provenance fields out of feed items", () => {
    const cleanTransaction = {
      amountMinor: "-1798",
      category: "Shopping",
      currency: "CAD",
      dedupeKey: "2026-06-18|AMAZON|-1798|CAD",
      id: "ctx-12345678",
      merchant: "Amazon",
      sourceRowId: 42,
      transactionDate: "2026-06-18"
    } as const

    expect(toTransactionFeedItem(cleanTransaction)).toEqual({
      amountMinor: "-1798",
      category: "Shopping",
      currency: "CAD",
      id: "ctx-12345678",
      merchant: "Amazon",
      transactionDate: "2026-06-18"
    })
  })
})
