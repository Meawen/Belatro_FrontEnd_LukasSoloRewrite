import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Boja, Rank } from '../types/game'
import { CARD_ART_BASE_URL as R2 } from '../config'

// jsdom never fetches or decodes images: a stand-in records each Image and answers decode().
const created: FakeImage[] = []
class FakeImage {
    src = ''
    decoding = ''
    constructor() {
        created.push(this)
    }
    decode(): Promise<void> {
        return this.src.endsWith('/Pik%207.png') ? Promise.reject(new Error('EncodingError')) : Promise.resolve()
    }
}

beforeEach(() => {
    created.length = 0
    vi.stubGlobal('Image', FakeImage)
    vi.resetModules()
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('card art URLs (spec §3.6)', () => {
    test('a face is "<Suit> <Rank>.png" in the bucket, with the Croatian names of the art', async () => {
        const { faceUrl } = await import('./cardArt')
        expect(faceUrl({ boja: 'HERC', rank: 'AS' })).toBe(`${R2}/Herc%20As.png`)
        expect(faceUrl({ boja: 'KARA', rank: 'DESETKA' })).toBe(`${R2}/Karo%2010.png`)
        expect(faceUrl({ boja: 'PIK', rank: 'SEDMICA' })).toBe(`${R2}/Pik%207.png`)
        expect(faceUrl({ boja: 'TREF', rank: 'DECKO' })).toBe(`${R2}/Tref%20Decko.png`)
        expect(faceUrl({ boja: 'TREF', rank: 'BABA' })).toBe(`${R2}/Tref%20Baba.png`)
        expect(faceUrl({ boja: 'HERC', rank: 'KRALJ' })).toBe(`${R2}/Herc%20Kralj.png`)
        expect(faceUrl({ boja: 'HERC', rank: 'OSMICA' })).toBe(`${R2}/Herc%208.png`)
        expect(faceUrl({ boja: 'HERC', rank: 'DEVETKA' })).toBe(`${R2}/Herc%209.png`)
    })

    test('backs are CardBack1–3 (1 by default) and suit icons are {herc,kara,pik,tref}Icon', async () => {
        const { backUrl, suitIconUrl } = await import('./cardArt')
        expect(backUrl()).toBe(`${R2}/CardBack1.png`)
        expect([1, 2, 3].map((n) => backUrl(n as 1 | 2 | 3))).toEqual([`${R2}/CardBack1.png`, `${R2}/CardBack2.png`, `${R2}/CardBack3.png`])
        const boje: Boja[] = ['HERC', 'KARA', 'PIK', 'TREF']
        expect(boje.map(suitIconUrl)).toEqual([`${R2}/hercIcon.png`, `${R2}/karaIcon.png`, `${R2}/pikIcon.png`, `${R2}/trefIcon.png`])
    })

    test('cardArtUrls lists all 39 files once: 32 faces, 3 backs, 4 icons', async () => {
        const { cardArtUrls, faceUrl } = await import('./cardArt')
        const urls = cardArtUrls()
        expect(urls).toHaveLength(39)
        expect(new Set(urls).size).toBe(39)
        const ranks: Rank[] = ['SEDMICA', 'OSMICA', 'DEVETKA', 'DESETKA', 'DECKO', 'BABA', 'KRALJ', 'AS']
        for (const boja of ['HERC', 'KARA', 'PIK', 'TREF'] as Boja[]) {
            for (const rank of ranks) expect(urls).toContain(faceUrl({ boja, rank }))
        }
        expect(urls.every((url) => url.startsWith(`${R2}/`))).toBe(true)
    })
})

describe('preloadCardArt (spec §3.6)', () => {
    test('decodes each of the 39 images once, and every later call returns the same promise', async () => {
        const { preloadCardArt, cardArtUrls, isArtDecoded } = await import('./cardArt')
        expect(isArtDecoded(`${R2}/Herc%20As.png`)).toBe(false)
        const first = preloadCardArt()
        expect(preloadCardArt()).toBe(first)
        await expect(first).resolves.toBeUndefined()
        expect(isArtDecoded(`${R2}/Herc%20As.png`)).toBe(true)
        expect(isArtDecoded(`${R2}/Pik%207.png`)).toBe(false) // its decode failed
        expect(created.map((img) => img.src).sort()).toEqual([...cardArtUrls()].sort())
        expect(created.every((img) => img.decoding === 'async')).toBe(true)
        await preloadCardArt()
        expect(created).toHaveLength(39)
    })

    test('a failed image or a browser without decode() never rejects it; a card that loaded its art records it', async () => {
        const { preloadCardArt, isArtDecoded, markArtDecoded } = await import('./cardArt')
        await expect(preloadCardArt()).resolves.toBeUndefined() // Pik 7 fails to decode
        markArtDecoded(`${R2}/Pik%207.png`)
        expect(isArtDecoded(`${R2}/Pik%207.png`)).toBe(true)
        vi.resetModules()
        vi.stubGlobal('Image', class { src = ''; decoding = '' })
        const again = await import('./cardArt')
        await expect(again.preloadCardArt()).resolves.toBeUndefined()
    })
})
