import { describe, test, expect } from 'vitest'
import { safeReturnPath } from './returnPath'

describe('safeReturnPath (spec §4.1, D-20)', () => {
    test('an in-app path comes back with its query and hash', () => {
        expect(safeReturnPath('/lobby/abc')).toBe('/lobby/abc')
        expect(safeReturnPath('/matches?page=2')).toBe('/matches?page=2')
        expect(safeReturnPath('/rules#cards')).toBe('/rules#cards')
        expect(safeReturnPath(`${window.location.origin}/lobby/abc`)).toBe('/lobby/abc')
    })

    test('a path that names another host goes to /dashboard', () => {
        for (const from of ['//evil.example', '/\\evil.example', '//evil.example/lobby/abc', 'https://evil.example/lobby/abc', 'javascript:alert(1)']) {
            expect(safeReturnPath(from), from).toBe('/dashboard')
        }
    })

    test('anything but a string goes to /dashboard', () => {
        for (const from of [undefined, null, 42, { pathname: '/lobby/abc' }, ['/lobby/abc']]) {
            expect(safeReturnPath(from)).toBe('/dashboard')
        }
    })
})
