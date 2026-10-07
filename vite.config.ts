import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { apiBaseForBuild } from './src/apiBase'

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
  },
  optimizeDeps: {
    include: ['sockjs-client']
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