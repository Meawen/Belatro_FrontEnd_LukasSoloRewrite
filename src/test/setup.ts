import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

// Node 26 has a localStorage global of its own, which vitest's jsdom environment leaves in place: without
// --localstorage-file it is unusable and warns once per worker. Every test file gets jsdom's storage instead
// (services/api.test.ts did this per file), emptied before each test; a file may still stub its own.
const { localStorage: jsdomStorage } = new JSDOM('', { url: 'http://localhost' }).window
Object.defineProperty(globalThis, 'localStorage', { value: jsdomStorage, configurable: true, writable: true })
beforeEach(() => jsdomStorage.clear())

// Google sign-in: Vite loads .env.local in test mode too, where a developer keeps a client id (src/config.ts). Every test
// starts with none, so no form loads Google's script unasked; a test that wants Google stubs it after this runs.
beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
})
