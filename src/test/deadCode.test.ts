import { describe, test, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shippedSources } from './sourceFiles'

// spec §2.4 X-14: dead code goes with its screens. These files existed at fca13bb and are used by nothing now.
const GONE = [
    'src/App.css',
    'public/vite.svg',
    'src/assets/react.svg',
    'src/hooks/useWebSocket.ts',
    'src/hooks/useRanked.ts',
    'src/hooks/useLocalStorage.ts',
    'src/components/lobby/LobbyCard.tsx',
    'src/components/lobby/JoinLobbyModal.tsx',
    'src/components/auth/AuthGuard.tsx',
    'src/components/game/GameSidebar.tsx',
    'src/components/admin/SystemStatus.tsx',
    'src/components/common/Button.tsx',
    'src/components/common/Checkbox.tsx',
    'src/components/common/Input.tsx',
    'src/components/common/Loading.tsx',
    'src/components/common/Modal.tsx',
    'src/components/common/Select.tsx',
    'src/components/common/PlayingCard.tsx',
]
// An identifier, not a path segment: '../hooks/useMatch' (useAllMatches' module) is fine
const NAMES = /\b(useWebSocket|useRanked|useLocalStorage|useMatch|useMatchByLobby|LobbyCard|JoinLobbyModal|AuthGuard|GameSidebar|SystemStatus)\b(?!['"/.])/

/** A file at the repo root (this file is src/test/deadCode.test.ts). */
// Not new URL(…, import.meta.url): Vite rewrites that form into an import.
const repoFile = (path: string) => join(dirname(fileURLToPath(import.meta.url)), '..', '..', path)

describe('the old screens’ dead code is gone (spec §2.4 X-14)', () => {
    test('every X-14 file is deleted', () => {
        expect(GONE.filter((path) => existsSync(repoFile(path)))).toEqual([])
    })

    test('no shipped source names a removed module or hook', () => {
        const hits = shippedSources()
            .flatMap(({ path, text }) => text.split('\n').map((line, index) => ({ where: `${path}:${index + 1}`, line })))
            .filter(({ line }) => NAMES.test(line))
            .map(({ where, line }) => `${where}: ${line.trim()}`)
        expect(hits).toEqual([])
    })
})
