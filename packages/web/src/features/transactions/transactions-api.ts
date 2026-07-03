import { Either } from "effect"

import { apiRoutes, decodeUnknown, TransactionsResponse } from "@sofistic/api"

export type TransactionsApi = {
  readonly listTransactions: (query: string, signal: AbortSignal) => Promise<TransactionsResponse>
}

export function makeTransactionsApi(fetchImpl: typeof fetch = fetch): TransactionsApi {
  return {
    listTransactions: async (query, signal) => {
      const search = new URLSearchParams()
      const trimmed = query.trim()
      if (trimmed !== "") {
        search.set("q", trimmed)
      }

      const url = search.size === 0 ? apiRoutes.transactions : `${apiRoutes.transactions}?${search.toString()}`
      const response = await fetchImpl(url, { signal })
      if (!response.ok) {
        throw new Error(`Transactions request failed with ${response.status}`)
      }

      const decoded = decodeUnknown(TransactionsResponse, await response.json())
      if (Either.isLeft(decoded)) {
        throw decoded.left
      }

      return decoded.right
    }
  }
}
