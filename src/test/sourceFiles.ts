import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repo's src/ folder (this file is src/test/sourceFiles.ts). */
// Not new URL('..', import.meta.url): Vite rewrites that form into an import of the directory.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Every .ts/.tsx file under src/ that goes into the bundle, for grep-style tests. Test files
 * (*.test.ts, *.test.tsx) and the helpers under src/test/ are left out.
 */
export function shippedSources(): { path: string; text: string }[] {
    return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
        .map((relative) => relative.split('\\').join('/'))
        .filter((relative) => /\.tsx?$/.test(relative))
        .filter((relative) => !/\.test\.tsx?$/.test(relative) && !relative.startsWith('test/'))
        .map((relative) => ({ path: `src/${relative}`, text: readFileSync(join(SRC, relative), 'utf8') }))
}
