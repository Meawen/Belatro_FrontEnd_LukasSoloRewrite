import { describe, test, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shippedSources } from './sourceFiles'

// open beta §1.2, §10 (S6): Rules, Privacy and Terms keep their text in per-language documents, each its own chunk,
// fetched only when shown in that language; none of them is in the entry chunk

/** src/ (this file is src/test/docsChunk.test.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

const DOCS = ['rules', 'privacy', 'terms'] as const
const LANGS = ['hr', 'en'] as const

/** A static import or re-export (not an import() call) of a document module, e.g. `from '../../i18n/docs/rules.hr'`. */
const STATIC_DOC_IMPORT = /^\s*(?:import(?!\s*\()|export)\b[^;]*?['"](?:[^'"]*\/)?(?:rules|privacy|terms)\.(?:hr|en)['"]/m

/** Each page's file under src/components/info. */
const PAGE = { rules: 'RulesPage.tsx', privacy: 'PrivacyPage.tsx', terms: 'TermsPage.tsx' } as const

describe('the documents load on demand, one chunk per language (open beta §1.2, §10)', () => {
    test('every document exists in both languages', () => {
        const missing = DOCS.flatMap((doc) => LANGS.map((lang) => `i18n/docs/${doc}.${lang}.tsx`)).filter((path) => !existsSync(join(SRC, path)))
        expect(missing).toEqual([])
    })

    test('no shipped module imports a document statically', () => {
        // the check itself, so it can't pass by matching nothing
        expect(STATIC_DOC_IMPORT.test("import { doc } from '../../i18n/docs/rules.hr';")).toBe(true)
        expect(STATIC_DOC_IMPORT.test("import type { LegalDoc } from './privacy.en';")).toBe(true)
        expect(STATIC_DOC_IMPORT.test("    hr: () => import('../../i18n/docs/rules.hr').then((module) => module.doc),")).toBe(false)

        const hits = shippedSources().filter(({ text }) => STATIC_DOC_IMPORT.test(text)).map(({ path }) => path)
        expect(hits).toEqual([])
    })

    test('each page reaches its two documents only through import()', () => {
        for (const doc of DOCS) {
            const source = readFileSync(join(SRC, 'components', 'info', PAGE[doc]), 'utf8')
            for (const lang of LANGS) expect(source, `${PAGE[doc]}: ${doc}.${lang}`).toContain(`import('../../i18n/docs/${doc}.${lang}')`)
        }
    })
})
