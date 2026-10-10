import { describe, test, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PlayingCard, crispCardWidth, intendedCardWidth } from './PlayingCard'
import { CARD_ART_BASE_URL } from '../../config'

const realWidth = window.innerWidth
const realDpr = window.devicePixelRatio

function viewport(width: number, dpr: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: dpr })
}

afterEach(() => {
    viewport(realWidth, realDpr)
    vi.unstubAllGlobals()
})

describe('card sizes (spec §3.6; D-23)', () => {
    test('the intended CSS widths per size, screen width and density', () => {
        const phone = { width: 375, dpr: 3 }
        const landscape = { width: 812, dpr: 3 }
        const retina = { width: 1440, dpr: 2 }
        const plain = { width: 1440, dpr: 1 }
        expect([phone, landscape, retina, plain].map((v) => intendedCardWidth('hand', v))).toEqual([71, 71, 106.5, 142])
        expect([phone, landscape, retina, plain].map((v) => intendedCardWidth('trick', v))).toEqual([71, 71, 106.5, 71])
        expect(intendedCardWidth('thumb', { width: 420, dpr: 3 })).toBeCloseTo(47.33, 2)
        expect(intendedCardWidth('thumb', { width: 800, dpr: 2 })).toBe(71)
        expect(intendedCardWidth('sheet', retina)).toBe(35.5)
    })

    test('a whole number of device pixels per art pixel: integer DPRs keep the intended size, others snap near it', () => {
        expect(crispCardWidth(71, 3)).toBe(71)
        expect(crispCardWidth(106.5, 2)).toBe(106.5)
        expect(crispCardWidth(142, 1)).toBe(142)
        expect(crispCardWidth(71, 2.625)).toBeCloseTo(81.14, 2)
        expect(crispCardWidth(71, 1.25)).toBeCloseTo(56.8, 2)
        expect(crispCardWidth(106.5, 1.25)).toBeCloseTo(113.6, 2)
        expect(crispCardWidth(35.5, 1)).toBe(35.5)
    })
})

describe('PlayingCard (spec §3.6, §3.7)', () => {
    test('a face is the pixelated art, named like the hand cards, at the crisp size for the screen', () => {
        viewport(1440, 1)
        render(<><PlayingCard card={{ boja: 'HERC', rank: 'AS' }} size="hand" /><PlayingCard card={{ boja: 'KARA', rank: 'DESETKA' }} /></>)
        const as = screen.getByRole('img', { name: 'As Herc' })
        expect(as).toHaveAttribute('src', `${CARD_ART_BASE_URL}/Herc%20As.png`)
        expect(as).toHaveClass('pixelated')
        expect(as.closest('.ui-card')).toHaveStyle({ width: '142px', height: '190px' })
        expect(screen.getByRole('img', { name: '10 Karo' }).closest('.ui-card')).toHaveStyle({ width: '71px', height: '95px' })
    })

    test('it follows the viewport: a phone gets 71×95 for the hand', () => {
        viewport(1440, 1)
        render(<PlayingCard card={{ boja: 'PIK', rank: 'KRALJ' }} size="hand" />)
        viewport(375, 3)
        fireEvent(window, new Event('resize'))
        expect(screen.getByRole('img', { name: 'Kralj Pik' }).closest('.ui-card')).toHaveStyle({ width: '71px', height: '95px' })
    })

    test('a back is decorative, CardBack1 unless told otherwise; an intended width is snapped crisp', () => {
        viewport(375, 3)
        const { container } = render(<><PlayingCard /><PlayingCard back={3} width={90} /></>)
        const [red, purple] = [...container.querySelectorAll('img')]
        expect(red).toHaveAttribute('src', `${CARD_ART_BASE_URL}/CardBack1.png`)
        expect(red).toHaveAttribute('alt', '')
        expect(purple).toHaveAttribute('src', `${CARD_ART_BASE_URL}/CardBack3.png`)
        expect(parseFloat((purple.closest('.ui-card') as HTMLElement).style.width)).toBeCloseTo((71 * 4) / 3, 3) // 90 at 3× snaps to 4 px per art pixel
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    test('until its art has decoded a face shows its name card in the same box; then the art', () => {
        viewport(375, 3)
        const { container } = render(<PlayingCard card={{ boja: 'TREF', rank: 'BABA' }} />)
        const art = screen.getByRole('img', { name: 'Baba Tref' })
        const box = container.querySelector('.ui-card')
        expect(art).toHaveClass('opacity-0')
        expect(screen.getByText('Baba Tref')).toHaveAttribute('aria-hidden', 'true')
        expect(box).toHaveStyle({ width: '71px', height: '95px' })
        fireEvent.load(art)
        expect(art).not.toHaveClass('opacity-0')
        expect(screen.queryByText('Baba Tref')).not.toBeInTheDocument()
        expect(box).toHaveStyle({ width: '71px', height: '95px' })
    })

    test('art the preload has already decoded shows at once, without the name card first', async () => {
        vi.resetModules()
        vi.stubGlobal('Image', class { src = ''; decoding = ''; decode() { return Promise.resolve() } })
        const { preloadCardArt } = await import('../../services/cardArt')
        await preloadCardArt()
        vi.unstubAllGlobals()
        const { PlayingCard: Fresh } = await import('./PlayingCard')
        render(<Fresh card={{ boja: 'KARA', rank: 'AS' }} />)
        expect(screen.getByRole('img', { name: 'As Karo' })).not.toHaveClass('opacity-0')
        expect(screen.queryByText('As Karo')).not.toBeInTheDocument()
    })

    test('a failed image becomes a pixel-framed text card of the same size, never a broken image', () => {
        viewport(375, 3)
        const { container } = render(<><PlayingCard card={{ boja: 'HERC', rank: 'AS' }} /><PlayingCard /></>)
        fireEvent.error(screen.getByRole('img', { name: 'As Herc' }))
        const text = screen.getByRole('img', { name: 'As Herc' })
        expect(text.tagName).toBe('SPAN')
        expect(text).toHaveTextContent('As Herc')
        expect(text.closest('.ui-card')).toHaveStyle({ width: '71px', height: '95px' })
        fireEvent.error(container.querySelector('img')!)
        expect(container.querySelector('img')).toBeNull()
        expect(container.querySelectorAll('.ui-card')[1].firstElementChild).toHaveAttribute('aria-hidden', 'true')
    })
})
