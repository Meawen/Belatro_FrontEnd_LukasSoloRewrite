import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // the English catalog loads on demand in the app (src/i18n/catalog/loadEn.ts); tests get it at once, also after
  // vi.resetModules()
  resolve: {
    alias: [{ find: /^\.\/catalog\/loadEn$/, replacement: fileURLToPath(new URL('./src/i18n/catalog/loadEn.vitest.ts', import.meta.url)) }],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
