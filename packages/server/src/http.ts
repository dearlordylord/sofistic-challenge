import { HttpApiBuilder, HttpServerResponse } from "@effect/platform"
import { Effect, Layer } from "effect"

import type { HealthResponse, TransactionsResponse } from "@sofistic/api"
import { SofisticHttpApi } from "@sofistic/api"
import { listCleanTransactions } from "@sofistic/transactions-clean"
import { TransactionRepositoryService } from "@sofistic/transactions-db"
import { MerchantSearchQuery as InternalMerchantSearchQuery } from "@sofistic/transactions-shared"

import { toTransactionFeedItem } from "./feed-mapping.js"

const transactionsGroupLive = HttpApiBuilder.group(SofisticHttpApi, "transactions", (handlers) =>
  handlers
    .handle("health", () =>
      Effect.gen(function*() {
        const repository = yield* TransactionRepositoryService
        const transactionsInDb = yield* repository.count
        const response: HealthResponse = {
          status: "ok",
          transactionsInDb
        }
        return response
      }).pipe(Effect.catchAll(storageFailure)))
    .handle("listTransactions", ({ urlParams }) =>
      Effect.gen(function*() {
        const repository = yield* TransactionRepositoryService
        const rows = yield* repository.findAll
        const items = listCleanTransactions(rows, toInternalMerchantSearchQuery(urlParams.merchantQuery)).map(
          toTransactionFeedItem
        )
        return { items } satisfies TransactionsResponse
      }).pipe(Effect.catchAll(storageFailure))))

export const SofisticHttpApiLive = HttpApiBuilder.api(SofisticHttpApi).pipe(
  Layer.provide(transactionsGroupLive)
)

function storageFailure(error: unknown) {
  return Effect.logError(error).pipe(
    Effect.as(HttpServerResponse.empty({ status: 500 }))
  )
}

function toInternalMerchantSearchQuery(query: string | undefined): InternalMerchantSearchQuery | "" {
  const trimmed = query?.trim() ?? ""
  return trimmed === "" ? "" : InternalMerchantSearchQuery.make(trimmed)
}
