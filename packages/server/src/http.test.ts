import { describe, expect, it } from "vitest"

import {
  AmountMinor,
  CanonicalTransactionId,
  CategoryDisplayName,
  CleanTransaction,
  DedupeKey,
  MerchantDisplayName,
  RawTransactionRowId,
  TransactionDate
} from "@sofistic/transactions-shared"

import { toTransactionFeedItem } from "./feed-mapping.js"

describe("transaction http mapping", () => {
  it("keeps cleanup/provenance fields out of feed items", () => {
    const cleanTransaction = CleanTransaction.make({
      amountMinor: AmountMinor.make("-1798"),
      category: CategoryDisplayName.make("Shopping"),
      currency: "CAD",
      dedupeKey: DedupeKey.make("2026-06-18|AMAZON|-1798|CAD"),
      id: CanonicalTransactionId.make("ctx-12345678"),
      merchant: MerchantDisplayName.make("Amazon"),
      sourceRowId: RawTransactionRowId.make(42),
      transactionDate: TransactionDate.make("2026-06-18")
    })

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
