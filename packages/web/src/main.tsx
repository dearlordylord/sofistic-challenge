import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App.js"

const mountPoint = document.getElementById("root")

if (mountPoint === null) {
  throw new Error("Missing #root mount point")
}

createRoot(mountPoint).render(
  <StrictMode>
    <App />
  </StrictMode>
)
