import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"

import { API_PREFIX } from "./routes.js"
import { HealthResponse, TransactionSearchParams, TransactionsResponse } from "./schemas.js"

export const transactionsGroup = HttpApiGroup.make("transactions")
  .add(HttpApiEndpoint.get("health", "/health").addSuccess(HealthResponse))
  .add(
    HttpApiEndpoint.get("listTransactions", "/transactions")
      .setUrlParams(TransactionSearchParams)
      .addSuccess(TransactionsResponse)
  )
  .prefix(API_PREFIX)

export const SofisticHttpApi = HttpApi.make("sofistic").add(transactionsGroup)
