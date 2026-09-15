import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"

const INTERNAL_ENTRY = fileURLToPath(new URL("./index.html", import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 10240,
    outDir: "dist",
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
      input: {
        internal: INTERNAL_ENTRY,
      },
    },
  },
  server: {
    port: 8008,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:5055",
        changeOrigin: true,
      },
    },
  },
})
