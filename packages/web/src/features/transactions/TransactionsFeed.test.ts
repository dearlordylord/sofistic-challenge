import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { TransactionFeedItem } from "@sofistic/api"

import { searchReducer, toSearchView, TransactionsFeed, TransactionTable } from "./TransactionsFeed.js"

const FIRST_REQUEST_ID = 1
const SECOND_REQUEST_ID = 2

const amazonTransaction: TransactionFeedItem = {
  amountMinor: "-10348",
  category: "Shopping",
  currency: "CAD",
  id: "ctx-amazon",
  merchant: "Amazon",
  transactionDate: "2026-05-20"
}

const shellTransaction: TransactionFeedItem = {
  amountMinor: "-5412",
  category: "Fuel",
  currency: "CAD",
  id: "ctx-shell",
  merchant: "Shell",
  transactionDate: "2026-05-19"
}

describe("transaction search state machine", () => {
  it("debounces input changes while preserving current rows", () => {
    const state = {
      _tag: "Ready",
      input: "",
      query: "",
      requestId: 0,
      rows: [amazonTransaction]
    } satisfies Parameters<typeof searchReducer>[0]

    const next = searchReducer(state, { _tag: "InputChanged", value: "shell" })

    expect(next).toEqual({
      _tag: "Debouncing",
      input: "shell",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    })
  })

  it("ignores stale debounce events", () => {
    const state = {
      _tag: "Debouncing",
      input: "shell",
      requestId: SECOND_REQUEST_ID,
      rows: [amazonTransaction]
    } satisfies Parameters<typeof searchReducer>[0]

    const next = searchReducer(state, {
      _tag: "DebounceElapsed",
      query: "amazon",
      requestId: FIRST_REQUEST_ID
    })

    expect(next).toBe(state)
  })

  it("moves from debouncing to fetching for the current request", () => {
    const state = {
      _tag: "Debouncing",
      input: "shell",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    } satisfies Parameters<typeof searchReducer>[0]

    const next = searchReducer(state, {
      _tag: "DebounceElapsed",
      query: "shell",
      requestId: FIRST_REQUEST_ID
    })

    expect(next).toEqual({
      _tag: "Fetching",
      input: "shell",
      query: "shell",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    })
  })

  it("ignores stale fetch responses", () => {
    const state = {
      _tag: "Fetching",
      input: "shell",
      query: "shell",
      requestId: SECOND_REQUEST_ID,
      rows: [amazonTransaction]
    } satisfies Parameters<typeof searchReducer>[0]

    const next = searchReducer(state, {
      _tag: "FetchSucceeded",
      query: "amazon",
      requestId: FIRST_REQUEST_ID,
      rows: [shellTransaction]
    })

    expect(next).toBe(state)
  })

  it("moves to ready when the current fetch has results", () => {
    const state = {
      _tag: "Fetching",
      input: "shell",
      query: "shell",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    } satisfies Parameters<typeof searchReducer>[0]

    const next = searchReducer(state, {
      _tag: "FetchSucceeded",
      query: "shell",
      requestId: FIRST_REQUEST_ID,
      rows: [shellTransaction]
    })

    expect(next).toEqual({
      _tag: "Ready",
      input: "shell",
      query: "shell",
      requestId: FIRST_REQUEST_ID,
      rows: [shellTransaction]
    })
  })

  it("represents empty results without stale rows", () => {
    const state = {
      _tag: "Fetching",
      input: "missing",
      query: "missing",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    } satisfies Parameters<typeof searchReducer>[0]

    const next = searchReducer(state, {
      _tag: "FetchSucceeded",
      query: "missing",
      requestId: FIRST_REQUEST_ID,
      rows: []
    })

    expect(next).toEqual({
      _tag: "Empty",
      input: "missing",
      query: "missing",
      requestId: FIRST_REQUEST_ID
    })
    expect(toSearchView(next).rows).toEqual([])
  })

  it("keeps failed state details but does not render stale rows", () => {
    const state = {
      _tag: "Fetching",
      input: "shell",
      query: "shell",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    } satisfies Parameters<typeof searchReducer>[0]

    const next = searchReducer(state, {
      _tag: "FetchFailed",
      message: "Unable to load transactions",
      query: "shell",
      requestId: FIRST_REQUEST_ID
    })

    expect(next).toEqual({
      _tag: "Failed",
      input: "shell",
      message: "Unable to load transactions",
      query: "shell",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    })
    expect(toSearchView(next)).toEqual({
      input: "shell",
      isWorking: false,
      resultText: "Unable to load transactions",
      rows: []
    })
  })

  it("ignores stale fetch failures", () => {
    const state = {
      _tag: "Fetching",
      input: "shell",
      query: "shell",
      requestId: SECOND_REQUEST_ID,
      rows: [amazonTransaction]
    } satisfies Parameters<typeof searchReducer>[0]

    const next = searchReducer(state, {
      _tag: "FetchFailed",
      message: "Unable to load transactions",
      query: "amazon",
      requestId: FIRST_REQUEST_ID
    })

    expect(next).toBe(state)
  })

  it("does not reintroduce failed search stale rows on the next input change", () => {
    const state = {
      _tag: "Failed",
      input: "shell",
      message: "Unable to load transactions",
      query: "shell",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    } satisfies Parameters<typeof searchReducer>[0]

    const next = searchReducer(state, { _tag: "InputChanged", value: "shells" })

    expect(next).toEqual({
      _tag: "Debouncing",
      input: "shells",
      requestId: SECOND_REQUEST_ID,
      rows: []
    })
  })

  it("summarizes a ready state", () => {
    expect(toSearchView({
      _tag: "Ready",
      input: "amazon",
      query: "amazon",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    })).toEqual({
      input: "amazon",
      isWorking: false,
      resultText: "Showing 1 transaction",
      rows: [amazonTransaction]
    })
  })

  it("summarizes debouncing and populated fetching states", () => {
    expect(toSearchView({
      _tag: "Debouncing",
      input: "amazon",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction]
    })).toEqual({
      input: "amazon",
      isWorking: true,
      resultText: "Updating results 1 transaction",
      rows: [amazonTransaction]
    })

    expect(toSearchView({
      _tag: "Fetching",
      input: "amazon",
      query: "amazon",
      requestId: FIRST_REQUEST_ID,
      rows: [amazonTransaction, shellTransaction]
    })).toEqual({
      input: "amazon",
      isWorking: true,
      resultText: "Updating results 2 transactions",
      rows: [amazonTransaction, shellTransaction]
    })
  })
})

describe("transaction feed rendering", () => {
  it("renders the transaction table with formatted minor-unit amounts", () => {
    const html = renderToStaticMarkup(createElement(TransactionTable, { items: [amazonTransaction, shellTransaction] }))

    expect(html).toContain("<th class=\"\">Date</th>")
    expect(html).toContain("<td class=\"\">2026-05-20</td>")
    expect(html).toContain("<td class=\"\">Amazon</td>")
    expect(html).toContain("<td class=\"align-right\">-$103.48</td>")
  })

  it("omits the table when there are no rows", () => {
    expect(renderToStaticMarkup(createElement(TransactionTable, { items: [] }))).toBe("")
  })

  it("renders the page shell with the merchant query from the URL", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    })

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          NuqsTestingAdapter,
          {
            children: createElement(TransactionsFeed),
            searchParams: "?merchantQuery=Shell"
          }
        )
      )
    )

    expect(html).toContain("<h1>Transactions</h1>")
    expect(html).toContain("value=\"Shell\"")
    expect(html).toContain("Loading transactions")
  })
})
