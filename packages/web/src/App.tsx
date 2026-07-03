import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"

import { TransactionsFeed } from "./features/transactions/TransactionsFeed.js"

const QUERY_GC_TIME_MS = 300_000
const QUERY_STALE_TIME_MS = 30_000

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: QUERY_GC_TIME_MS,
      retry: false,
      staleTime: QUERY_STALE_TIME_MS
    }
  }
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <TransactionsFeed />
      </NuqsAdapter>
    </QueryClientProvider>
  )
}
