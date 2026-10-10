import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PixelIcon } from './PixelIcon'
import { SuitIcon } from './SuitIcon'
import { ICONS, type IconName } from './icons'
import { CARD_ART_BASE_URL } from '../../config'

// spec §3.5: the prototypes' 15 icons plus the 14 added ones
const SPEC_ICONS: IconName[] = [
    'lock', 'crown', 'door', 'trash', 'x', 'plus', 'link', 'check', 'back', 'chevron', 'more', 'user', 'eye', 'play', 'refresh',
    'home', 'cards', 'list', 'people', 'trophy', 'gear', 'book', 'shield', 'search', 'copy', 'logout', 'mail', 'warning', 'info',
]

describe('PixelIcon (spec §3.5)', () => {
    test('the set holds every icon the spec lists, each a pixel grid of at most 9×9', () => {
        expect(Object.keys(ICONS).sort()).toEqual([...SPEC_ICONS].sort())
        for (const name of SPEC_ICONS) {
            const rows = ICONS[name]
            expect(rows.length, name).toBeGreaterThan(0)
            expect(rows.length, name).toBeLessThanOrEqual(9)
            for (const row of rows) expect(row, name).toMatch(/^[.#]{1,9}$/)
            expect(rows.join('').includes('#'), name).toBe(true)
        }
    })

    test('draws exactly the filled pixels as crisp rects in the current colour, scaled ×2 by default', () => {
        const { container } = render(<PixelIcon name="lock" />)
        const svg = container.querySelector('svg')!
        expect(svg).toHaveAttribute('width', '16')
        expect(svg).toHaveAttribute('height', '16')
        expect(svg).toHaveAttribute('viewBox', '0 0 8 8')
        expect(svg).toHaveAttribute('fill', 'currentColor')
        expect(svg).toHaveAttribute('shape-rendering', 'crispEdges')
        const filled = ICONS.lock.join('').split('').filter((c) => c === '#').length
        const drawn = [...svg.querySelectorAll('rect')].reduce((sum, rect) => sum + Number(rect.getAttribute('width')), 0)
        expect(drawn).toBe(filled)
        const { container: big } = render(<PixelIcon name="x" scale={3} />)
        expect(big.querySelector('svg')).toHaveAttribute('width', '21')
    })

    test('is hidden from assistive tech beside text, and named when it stands alone', () => {
        const { container } = render(<PixelIcon name="crown" />)
        expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
        render(<PixelIcon name="crown" label="won the trick" />)
        expect(screen.getByRole('img', { name: 'won the trick' })).toBeInTheDocument()
    })
})

describe('SuitIcon (spec §3.5)', () => {
    test("is the art's own PNG, pixelated, at 17×16 or 34×32", () => {
        const { container } = render(<><SuitIcon boja="KARA" /><SuitIcon boja="PIK" size={2} /></>)
        const [karo, pik] = [...container.querySelectorAll('img')]
        expect(karo).toHaveAttribute('src', `${CARD_ART_BASE_URL}/karaIcon.png`)
        expect(karo).toHaveAttribute('width', '17')
        expect(karo).toHaveAttribute('height', '16')
        expect(karo).toHaveClass('pixelated')
        expect(karo).toHaveAttribute('alt', '')
        expect(pik).toHaveAttribute('width', '34')
        expect(pik).toHaveAttribute('height', '32')
    })

    test('carries a name when it stands for the suit on its own', () => {
        render(<SuitIcon boja="HERC" label="Herc" />)
        expect(screen.getByRole('img', { name: 'Herc' })).toHaveAttribute('src', `${CARD_ART_BASE_URL}/hercIcon.png`)
    })
})
