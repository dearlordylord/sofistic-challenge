import { describe, expect, it } from "vitest"

import { makeTransactionsApi } from "./transactions-api.js"

describe("transactions api client", () => {
  it("sends merchantQuery and decodes amountMinor responses", async () => {
    let requestedUrl = ""
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrl = input.toString()
      return new Response(
        JSON.stringify({
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
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      )
    }

    const response = await makeTransactionsApi(fetchImpl).listTransactions(" Amazon ", new AbortController().signal)

    expect(requestedUrl).toBe("/api/transactions?merchantQuery=Amazon")
    expect(response.items[0]?.amountMinor).toBe("-1798")
  })

  it("rejects old floating amount responses", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              amount: -17.98,
              category: "Shopping",
              currency: "CAD",
              date: "2026-06-18",
              id: "tx_1",
              merchant: "Amazon"
            }
          ]
        }),
        { status: 200 }
      )

    await expect(makeTransactionsApi(fetchImpl).listTransactions("", new AbortController().signal)).rejects.toThrow()
  })
})
