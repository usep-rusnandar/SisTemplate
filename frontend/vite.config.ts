import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const ENTRIES: Record<string, string> = {
  internal: fileURLToPath(new URL('./index.html', import.meta.url)),
  external: fileURLToPath(new URL('./vendor.html', import.meta.url)),
  'vendor-onboarding': fileURLToPath(new URL('./vendor-onboarding.html', import.meta.url)),
  'proposal-tracker': fileURLToPath(new URL('./proposal-tracker.html', import.meta.url)),
  'contract-monitoring': fileURLToPath(new URL('./contract-monitoring.html', import.meta.url)),
}

const PORTAL_MODES = new Set(Object.keys(ENTRIES))

// Suite (internal) and vendor (external) plus one artifact per module portal.
// `--mode <target>` writes dist/<target>. Dev server keeps every HTML entry.
export default defineConfig(({ mode }) => {
  const target = PORTAL_MODES.has(mode) ? mode : null
  const input: Record<string, string> = target
    ? { [target]: ENTRIES[target] }
    : { ...ENTRIES }
  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 10240,
      outDir: target ? `dist/${target}` : 'dist',
      rolldownOptions: {
        checks: {
          pluginTimings: false,
        },
        input,
      },
    },
    server: {
      port: 8008,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:5055',
          changeOrigin: true,
        },
      },
    },
  }
})
