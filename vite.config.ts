import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { apiBaseForBuild, cardArtBaseForBuild } from './src/apiBase'

// Google sign-in P-3: what Cloudflare Pages sends every page, public/_headers' /* rule (not its caching rules), as
// name → value, so `vite preview` answers with production's Referrer-Policy. Read from the working directory, as
// loadEnv(mode, '.') below is.
function everyPageHeaders(): Record<string, string> {
  const rule = readFileSync('public/_headers', 'utf8').trim().split(/\n\s*\n/)
    .map((block) => block.split('\n'))
    .find(([path]) => path === '/*') ?? []
  return Object.fromEntries(rule.slice(1).map((line) => {
    const [name, ...value] = line.trim().split(': ')
    return [name, value.join(': ')]
  }))
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    global: 'globalThis',
    // R-28: a production bundle carries the API origin, checked and without trailing slashes
    // (src/apiBase.ts). Dev and preview keep the proxy below and need no variable.
    ...(command === 'build'
      ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseForBuild(loadEnv(mode, '.', 'VITE_').VITE_API_BASE_URL)) }
      : {}),
    // P-4: the card art's origin, checked the same way. Dev uses the r2.dev bucket (src/config.ts).
    ...(command === 'build'
      ? { 'import.meta.env.VITE_CARD_ART_BASE_URL': JSON.stringify(cardArtBaseForBuild(loadEnv(mode, '.', 'VITE_').VITE_CARD_ART_BASE_URL)) }
      : {}),
  },
  optimizeDeps: {
    include: ['sockjs-client']
  },
  preview: {
    headers: everyPageHeaders(),
  },
  server: {
    proxy: {
      '/backend': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, '')
      },
      '/actuator': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      // WebSocket proxy - keep it simple as per the guide
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true
      }
    }
  }
}))