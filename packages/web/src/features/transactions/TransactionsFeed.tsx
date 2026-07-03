import { useEffect, useMemo, useReducer } from "react"

import type { TransactionFeedItem } from "@sofistic/api"
import { useQueryClient } from "@tanstack/react-query"
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { parseAsString, useQueryState } from "nuqs"

import { makeTransactionsApi, type TransactionsApi } from "./transactions-api.js"

const MERCHANT_QUERY_PARAM = "merchantQuery"
const MINOR_UNITS_PER_MAJOR_UNIT = 100
const SEARCH_DEBOUNCE_MS = 250
const transactionSearchKey = (query: string): readonly ["transactions", string] => ["transactions", query]

type SearchState =
  | {
    readonly _tag: "Debouncing"
    readonly input: string
    readonly requestId: number
    readonly rows: ReadonlyArray<TransactionFeedItem>
  }
  | {
    readonly _tag: "Empty"
    readonly input: string
    readonly query: string
    readonly requestId: number
  }
  | {
    readonly _tag: "Failed"
    readonly input: string
    readonly message: string
    readonly query: string
    readonly requestId: number
    readonly rows: ReadonlyArray<TransactionFeedItem>
  }
  | {
    readonly _tag: "Fetching"
    readonly input: string
    readonly query: string
    readonly requestId: number
    readonly rows: ReadonlyArray<TransactionFeedItem>
  }
  | {
    readonly _tag: "Ready"
    readonly input: string
    readonly query: string
    readonly requestId: number
    readonly rows: ReadonlyArray<TransactionFeedItem>
  }

type SearchEvent =
  | { readonly _tag: "DebounceElapsed"; readonly query: string; readonly requestId: number }
  | { readonly _tag: "FetchFailed"; readonly message: string; readonly query: string; readonly requestId: number }
  | {
    readonly _tag: "FetchSucceeded"
    readonly query: string
    readonly requestId: number
    readonly rows: ReadonlyArray<TransactionFeedItem>
  }
  | { readonly _tag: "InputChanged"; readonly value: string }

type SearchView = {
  readonly input: string
  readonly isWorking: boolean
  readonly resultText: string
  readonly rows: ReadonlyArray<TransactionFeedItem>
}

export function TransactionsFeed() {
  const api = useMemo(() => makeTransactionsApi(), [])
  const [merchantQuery, setMerchantQuery] = useQueryState(
    MERCHANT_QUERY_PARAM,
    parseAsString.withDefault("").withOptions({ clearOnDefault: true, history: "replace" })
  )
  const search = useTransactionSearch(api, merchantQuery)

  return (
    <main className="transactions-page">
      <h1>Transactions</h1>
      <label className="search-field">
        <span>Search merchants</span>
        <span className="search-input-wrap">
          <input
            autoComplete="off"
            onChange={(event) => {
              const value = event.target.value
              search.dispatch({ _tag: "InputChanged", value })
              void setMerchantQuery(value)
            }}
            placeholder="Amazon, Uber, Shell..."
            value={search.view.input}
          />
          {search.view.isWorking ? <span aria-hidden="true" className="search-spinner" /> : null}
        </span>
      </label>

      <TransactionTable items={search.view.rows} />
      <p
        aria-live={search.state._tag === "Failed" ? "assertive" : "polite"}
        className="results-summary"
        role={search.state._tag === "Failed" ? "alert" : "status"}
      >
        {search.view.resultText}
      </p>
    </main>
  )
}

function useTransactionSearch(api: TransactionsApi, merchantQuery: string) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(
    searchReducer,
    {
      _tag: "Fetching",
      input: merchantQuery,
      query: normalizeQuery(merchantQuery),
      requestId: 0,
      rows: []
    } satisfies SearchState
  )

  useEffect(() => {
    if (merchantQuery !== state.input) {
      dispatch({ _tag: "InputChanged", value: merchantQuery })
    }
  }, [merchantQuery, state.input])

  useEffect(() => {
    if (state._tag !== "Debouncing") {
      return
    }

    const requestId = state.requestId
    const query = normalizeQuery(state.input)
    const timeout = window.setTimeout(() => {
      dispatch({ _tag: "DebounceElapsed", query, requestId })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [state])

  useEffect(() => {
    if (state._tag !== "Fetching") {
      return
    }

    let ignore = false
    const requestId = state.requestId
    const query = state.query

    void queryClient
      .fetchQuery({
        queryFn: ({ signal }) => api.listTransactions(query, signal),
        queryKey: transactionSearchKey(query)
      })
      .then((response) => {
        if (!ignore) {
          dispatch({ _tag: "FetchSucceeded", query, requestId, rows: response.items })
        }
      })
      .catch((error: unknown) => {
        if (!ignore) {
          dispatch({
            _tag: "FetchFailed",
            message: error instanceof Error ? error.message : "Unable to load transactions",
            query,
            requestId
          })
        }
      })

    return () => {
      ignore = true
    }
  }, [api, queryClient, state])

  return {
    dispatch,
    state,
    view: toSearchView(state)
  }
}

export function searchReducer(state: SearchState, event: SearchEvent): SearchState {
  switch (event._tag) {
    case "InputChanged":
      return {
        _tag: "Debouncing",
        input: event.value,
        requestId: state.requestId + 1,
        rows: rowsForState(state)
      }

    case "DebounceElapsed":
      if (state._tag !== "Debouncing" || state.requestId !== event.requestId) {
        return state
      }

      return {
        _tag: "Fetching",
        input: state.input,
        query: event.query,
        requestId: state.requestId,
        rows: state.rows
      }

    case "FetchSucceeded":
      if (state._tag !== "Fetching" || state.requestId !== event.requestId || state.query !== event.query) {
        return state
      }

      if (event.rows.length === 0) {
        return {
          _tag: "Empty",
          input: state.input,
          query: state.query,
          requestId: state.requestId
        }
      }

      return {
        _tag: "Ready",
        input: state.input,
        query: state.query,
        requestId: state.requestId,
        rows: event.rows
      }

    case "FetchFailed":
      if (state._tag !== "Fetching" || state.requestId !== event.requestId || state.query !== event.query) {
        return state
      }

      return {
        _tag: "Failed",
        input: state.input,
        message: event.message,
        query: state.query,
        requestId: state.requestId,
        rows: state.rows
      }
  }
}

export function toSearchView(state: SearchState): SearchView {
  switch (state._tag) {
    case "Debouncing":
      return {
        input: state.input,
        isWorking: true,
        resultText: resultCountText(state.rows, "Updating results"),
        rows: state.rows
      }

    case "Empty":
      return {
        input: state.input,
        isWorking: false,
        resultText: "No transactions found",
        rows: []
      }

    case "Failed":
      return {
        input: state.input,
        isWorking: false,
        resultText: state.message,
        rows: []
      }

    case "Fetching":
      return {
        input: state.input,
        isWorking: true,
        resultText: resultCountText(state.rows, state.rows.length === 0 ? "Loading transactions" : "Updating results"),
        rows: state.rows
      }

    case "Ready":
      return {
        input: state.input,
        isWorking: false,
        resultText: resultCountText(state.rows, "Showing"),
        rows: state.rows
      }
  }
}

function rowsForState(state: SearchState): ReadonlyArray<TransactionFeedItem> {
  switch (state._tag) {
    case "Empty":
    case "Failed":
      return []
    case "Debouncing":
    case "Fetching":
    case "Ready":
      return state.rows
  }
}

function TransactionTable({ items }: { readonly items: ReadonlyArray<TransactionFeedItem> }) {
  const data = useMemo(() => [...items], [items])
  const columns = useMemo<Array<ColumnDef<TransactionFeedItem>>>(() => [
    {
      accessorKey: "transactionDate",
      header: "Date"
    },
    {
      accessorKey: "merchant",
      header: "Merchant"
    },
    {
      accessorKey: "category",
      header: "Category"
    },
    {
      cell: ({ row }) => formatMoney(row.original.amountMinor, row.original.currency),
      header: "Amount",
      id: "amount",
      meta: {
        align: "right"
      }
    }
  ], [])

  const table = useReactTable({
    columns,
    data,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel()
  })

  if (items.length === 0) {
    return null
  }

  return (
    <div className="transactions-table-wrap">
      <table className="transactions-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th className={columnAlignClass(header.column.columnDef.meta)} key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td className={columnAlignClass(cell.column.columnDef.meta)} key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function columnAlignClass(meta: unknown): string {
  if (typeof meta === "object" && meta !== null && "align" in meta && meta.align === "right") {
    return "align-right"
  }

  return ""
}

function resultCountText(items: ReadonlyArray<TransactionFeedItem>, prefix: string): string {
  const noun = items.length === 1 ? "transaction" : "transactions"
  return `${prefix} ${items.length} ${noun}`
}

function normalizeQuery(query: string): string {
  return query.trim()
}

function formatMoney(amountMinor: string, currency: string): string {
  const amount = Number.parseInt(amountMinor, 10) / MINOR_UNITS_PER_MAJOR_UNIT
  return new Intl.NumberFormat("en-CA", {
    currency,
    style: "currency"
  }).format(amount)
}
