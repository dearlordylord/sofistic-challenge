import { useEffect, useMemo, useState } from "react"

import type { TransactionFeedItem } from "@sofistic/api"

import { makeTransactionsApi } from "./transactions-api.js"

const SEARCH_DEBOUNCE_MS = 250

type LoadState =
  | { readonly _tag: "Loading" }
  | { readonly _tag: "Loaded"; readonly items: ReadonlyArray<TransactionFeedItem> }
  | { readonly _tag: "Failed"; readonly message: string }

export function TransactionsFeed() {
  const api = useMemo(() => makeTransactionsApi(), [])
  const [query, setQuery] = useState("")
  const [state, setState] = useState<LoadState>({ _tag: "Loading" })

  useEffect(() => {
    const abortController = new AbortController()
    const timeout = window.setTimeout(() => {
      setState({ _tag: "Loading" })
      api.listTransactions(query, abortController.signal)
        .then((response) => {
          setState({ _tag: "Loaded", items: response.items })
        })
        .catch((error: unknown) => {
          if (!abortController.signal.aborted) {
            setState({
              _tag: "Failed",
              message: error instanceof Error ? error.message : "Unable to load transactions"
            })
          }
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
      abortController.abort()
    }
  }, [api, query])

  return (
    <main style={{ fontFamily: "sans-serif", margin: "2rem auto", maxWidth: 760 }}>
      <h1>Transactions Feed</h1>
      <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
        <span>Search merchants</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder="Amazon, Uber, Shell..."
          style={{ fontSize: 16, padding: "10px 12px" }}
        />
      </label>

      {state._tag === "Loading" ? <p>Loading transactions...</p> : null}
      {state._tag === "Failed" ? <p role="alert">{state.message}</p> : null}
      {state._tag === "Loaded" ? <TransactionTable items={state.items} /> : null}
    </main>
  )
}

function TransactionTable({ items }: { readonly items: ReadonlyArray<TransactionFeedItem> }) {
  if (items.length === 0) {
    return <p>No transactions match this search.</p>
  }

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Merchant</Th>
          <Th>Category</Th>
          <Th align="right">Amount</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((transaction) => (
          <tr key={transaction.id}>
            <Td>{transaction.date}</Td>
            <Td>{transaction.merchant}</Td>
            <Td>{transaction.category}</Td>
            <Td align="right">{formatMoney(transaction.amount, transaction.currency)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Th({ align, children }: { readonly align?: "left" | "right"; readonly children: React.ReactNode }) {
  return (
    <th style={{ borderBottom: "1px solid #ccc", padding: "8px", textAlign: align ?? "left" }}>
      {children}
    </th>
  )
}

function Td({ align, children }: { readonly align?: "left" | "right"; readonly children: React.ReactNode }) {
  return (
    <td style={{ borderBottom: "1px solid #eee", padding: "8px", textAlign: align ?? "left" }}>
      {children}
    </td>
  )
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    currency,
    style: "currency"
  }).format(amount)
}
