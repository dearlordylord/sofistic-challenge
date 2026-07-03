import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const workspaceAliases = {
  "@sofistic/api": path.resolve(rootDir, "packages/api/src/index.ts"),
  "@sofistic/transactions-clean": path.resolve(rootDir, "packages/transactions-clean/src/index.ts"),
  "@sofistic/transactions-db": path.resolve(rootDir, "packages/transactions-db/src/index.ts"),
  "@sofistic/transactions-shared": path.resolve(rootDir, "packages/transactions-shared/src/index.ts"),
  "@sofistic/server": path.resolve(rootDir, "packages/server/src/index.ts")
}

export default defineConfig({
  resolve: {
    alias: workspaceAliases
  },
  test: {
    coverage: {
      exclude: [
        "**/dist/**",
        "**/*.config.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "packages/*/src/index.ts",
        "packages/server/src/main.ts",
        "packages/web/src/main.tsx"
      ],
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "packages/*/src/**/*.test.ts", "packages/*/src/**/*.test.tsx"],
    passWithNoTests: true
  }
})
