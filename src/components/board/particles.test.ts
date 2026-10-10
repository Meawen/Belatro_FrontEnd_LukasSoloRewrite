import { describe, test, expect, vi } from 'vitest'
import { BUDGET, BURST, ParticleField, drawWheat, type Painter } from './particles'

/** A deterministic random source (a small LCG). */
function seeded(seed = 1) {
    let s = seed
    return () => {
        s = (s * 16807) % 2147483647
        return s / 2147483647
    }
}

function painter(): Painter & { fillRect: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn> } {
    return { clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: true }
}

/** Runs the field for `seconds` at 60 fps from `start`, returning the most sprites seen at once. */
function run(field: ParticleField, start: number, seconds: number): number {
    let most = 0
    for (let t = 0; t < seconds * 1000; t += 16) {
        field.step(0.016, start + t, 375, 812)
        most = Math.max(most, field.sprites.length)
    }
    return most
}

describe('the arena particles (spec §5.7, §3.8)', () => {
    test('Full stays within 52 sprites, Calm within 14, Off and the neutral felt draw none', () => {
        const full = new ParticleField(seeded(3))
        full.setSeason('spring', 0, false)
        expect(run(full, 0, 60)).toBeLessThanOrEqual(BUDGET.full)
        expect(full.sprites.length).toBeGreaterThan(0)
        const calm = new ParticleField(seeded(4))
        calm.setMode('calm')
        calm.setSeason('winter', 0, false)
        expect(run(calm, 0, 60)).toBeLessThanOrEqual(BUDGET.calm)
        const off = new ParticleField(seeded(5))
        off.setMode('off')
        off.setSeason('autumn', 0, false)
        expect(run(off, 0, 20)).toBe(0)
        const neutral = new ParticleField(seeded(6))
        expect(run(neutral, 0, 20)).toBe(0)
    })

    test('a trump call allows ×1.6 for 1.6 s, then the field shrinks back to its budget', () => {
        const field = new ParticleField(seeded(7))
        field.setSeason('summer', 1000, true)
        expect(field.budget(1000)).toBe(Math.floor(BUDGET.full * BURST.factor))
        expect(field.budget(1000 + BURST.ms)).toBe(BUDGET.full)
        run(field, 1000, 1.5)
        field.step(0.016, 1000 + BURST.ms, 375, 812)
        expect(field.sprites.length).toBeLessThanOrEqual(BUDGET.full)
        field.setSeason('winter', 5000, false)
        expect(field.sprites).toEqual([])
    })

    test('summer draws its wheat on both bottom edges, swaying only when asked; icons once loaded', () => {
        const field = new ParticleField(seeded(8))
        field.setSeason('summer', 0, false)
        const p = painter()
        field.draw(p, 375, 812, 0, null, false)
        expect(p.fillRect).toHaveBeenCalled()
        expect(p.drawImage).not.toHaveBeenCalled()
        const still = painter()
        drawWheat(still, 375, 812, () => 0)
        const xs = still.fillRect.mock.calls.map((call) => call[0] as number)
        expect(Math.min(...xs)).toBeLessThan(20)
        expect(Math.max(...xs)).toBeGreaterThan(355)
        const spring = new ParticleField(seeded(9))
        spring.setSeason('spring', 0, false)
        run(spring, 0, 30)
        spring.sprites.forEach((s) => { s.life = 1 })
        const drawn = painter()
        spring.draw(drawn, 375, 812, 0, {} as CanvasImageSource, true)
        expect(drawn.drawImage.mock.calls.length).toBe(spring.sprites.filter((s) => s.icon).length)
        const winter = painter()
        new ParticleField().draw(winter, 375, 812, 0, null, true)
        expect(winter.fillRect).not.toHaveBeenCalled()
    })
})
