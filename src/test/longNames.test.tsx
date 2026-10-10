import { describe, test, expect } from 'vitest'
import { LONG_NAMES, devTable, parseDevOptions, seatId } from '../dev/devTable'

// Review focus: the longest real names (20-character usernames, 50-character lobby names) never overflow.
// e2e/visual/checks/names.mjs proves it in Chromium; these pin the rules that make it so.

describe('the longest names', () => {
    test('/dev/board?names=long names every seat by a 20-character name in every frame; the labels stay', () => {
        const options = { ...parseDevOptions('?seat=carol&names=long'), hands: 1 }
        const short = devTable({ ...options, names: false }, 0)
        const long = devTable(options, 0)
        expect(seatId(options)).toBe(LONG_NAMES.carol)
        expect(Object.values(LONG_NAMES).every((name) => /^[A-Za-z0-9_]{20}$/.test(name))).toBe(true)
        expect(long[0].public.teamA.map((seat) => seat.id)).toEqual([LONG_NAMES.alice, LONG_NAMES.carol])
        expect(Object.keys(long[0].private).sort()).toEqual(Object.values(LONG_NAMES).sort())
        expect(JSON.stringify(long)).not.toMatch(/"(alice|bob|carol|dave)"/)
        expect(long.map((f) => f.label)).toEqual(short.map((f) => f.label))
    })
})
