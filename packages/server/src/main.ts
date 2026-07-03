import { createServer } from "node:http"

import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer } from "effect"

import { makeSqliteTransactionRepository, TransactionRepositoryService } from "@sofistic/transactions-db"

import { SofisticHttpApiLive } from "./http.js"

const DEFAULT_PORT = 3000
const DEFAULT_DB_FILE = "../transactions-db/data/app.db"

const TransactionRepositoryLive = Layer.effect(
  TransactionRepositoryService,
  Effect.gen(function*() {
    const dbFile = yield* Config.string("TRANSACTIONS_DB_FILE").pipe(Config.withDefault(DEFAULT_DB_FILE))
    return yield* makeSqliteTransactionRepository(dbFile)
  })
)

const AppLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(SofisticHttpApiLive),
  Layer.provide(TransactionRepositoryLive),
  HttpServer.withLogAddress,
  Layer.provide(
    NodeHttpServer.layerConfig(
      () => createServer(),
      { port: Config.integer("PORT").pipe(Config.withDefault(DEFAULT_PORT)) }
    )
  )
)

const program = Layer.launch(AppLive).pipe(
  Effect.tapErrorCause((cause) => Effect.logError(cause))
)

NodeRuntime.runMain(program)
