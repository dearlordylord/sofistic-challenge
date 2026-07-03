# Frontend Notes

## Goal

The exercise asks for merchant search where results update as the user types, with no submit button. That makes this a live search table, not an autocomplete picker or row-selection component.

## Library Decisions

Initial exploration compared common React typeahead options:

- `react-select`: mature and convenient for select/picker UI, but too selection-oriented for this requirement.
- `downshift`: strong headless combobox primitives, but still primarily useful when keyboard-highlighted suggestions can be selected.
- `@tanstack/react-virtual`: useful for rendering only visible rows, but not a table component.
- `@tanstack/react-table`: good fit for transaction results because it models columns, rows, cells, and stable row ids without imposing visual styling.

The final implementation uses `@tanstack/react-table` for the results table and avoids picker behavior entirely.

## State Architecture

Search state is modeled as a reducer-backed discriminated union:

- `Debouncing`
- `Fetching`
- `Ready`
- `Empty`
- `Failed`

The reducer owns UI lifecycle transitions and uses `requestId` to ignore stale debounce/fetch events. This keeps invalid states hard to represent: for example, `Empty` carries no rows, and `Failed` renders no stale rows even though it preserves diagnostic context internally.

React Query is used beneath the reducer through `queryClient.fetchQuery`. It provides caching, request de-duplication, stale-time behavior, and `AbortSignal` integration while leaving the user-visible state machine explicit.

## URL State

Merchant search text is stored in the URL with `nuqs` using:

```text
merchantQuery=<query>
```

The input dispatches immediately to the reducer for responsiveness, and also updates `merchantQuery`. Loading a URL with `merchantQuery` or using browser navigation syncs the URL value back into the reducer. Empty input clears the query parameter.

## UX Choices

The rendered UI is intentionally minimal:

- Page title
- Merchant search field
- Transaction table
- Small result summary below the table

Implementation details such as reducer state, raw input, committed query, cache state, and state-machine panels were removed because they were useful for the prototype but noisy for the product UI.

During debounce and fetch, previous rows remain visible to avoid table flicker. If a request fails, rows are hidden and the error is announced instead, so stale results are not mistaken for matches to the current query.

## Review Fixes

Self-review with a subagent found and fixed:

- Failed searches initially rendered stale rows.
- Editing after a failed search could reintroduce stale rows during debounce.
- The spinner was announced as part of the input label.
- Result updates were not consistently announced to assistive technology.
- TanStack Table initially used index-based row ids instead of transaction ids.
- The reducer state machine had no tests.

The current tests cover debounce transitions, stale event suppression, empty results, failure behavior, and the post-failure stale-row regression.

## Operational Note

The backend requires Node 22 because it uses `node:sqlite`. In this container, the global Node is 20, so backend seed/server commands were run through a Node 22 npm shim during manual verification.

An existing package export mismatch also blocked the server: `@sofistic/transactions-db` builds `dist/src/index.js`, so its package export was corrected from `dist/index.js` to `dist/src/index.js`.
