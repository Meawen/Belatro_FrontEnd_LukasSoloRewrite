import { describe, test, expect } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClimbChart } from './ClimbChart'
import { history } from '../../test/fixtures/ranks'
import type { ClimbBand } from './climbGeometry'

const BANDS: ClimbBand[] = [
    { key: 'PAJDAS', name: 'Pajdaš', min: 1200, max: 1400 },
    { key: 'GOSPON', name: 'Gospon', min: 1400, max: 1600 },
    { key: 'MAJSTER', name: 'Majster', min: 1600, max: 1800 },
]

const group = () => screen.getByRole('group', { name: 'Your climb: rating over your ranked games' })
const tooltip = () => screen.queryByTestId('chart-tooltip')

// ranks spec §8.3–8.6
describe('ClimbChart', () => {
    test('the history line, one dot at the current point, the dashed forecast over its band; hidden from screen readers', () => {
        const { container } = render(<ClimbChart history={history()} bands={BANDS} nextMinRating={1600} />)
        expect(container.querySelector('[data-history]')).toBeInTheDocument()
        expect(container.querySelectorAll('[data-dot]')).toHaveLength(1)
        expect(container.querySelector('[data-forecast-line]')).toHaveAttribute('stroke-dasharray', '4 3')
        expect(container.querySelector('[data-forecast-band]')).toBeInTheDocument()
        expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    })

    test('placement (no pace): a dot per point, no forecast', () => {
        const { container } = render(<ClimbChart history={history({ games: 3, rating: 1256, pace: null, paceGames: 0 })} bands={BANDS} nextMinRating={null} />)
        expect(container.querySelectorAll('[data-dot]')).toHaveLength(3)
        expect(container.querySelector('[data-forecast-line]')).toBeNull()
        expect(container.querySelector('[data-forecast-band]')).toBeNull()
    })

    test('keyboard: the first arrow lands on the current game; right steps into the forecast; Home and Escape (C-10)', async () => {
        const user = userEvent.setup()
        render(<ClimbChart history={history({ rating: 1452, pace: 4.2, step: 31 })} bands={BANDS} nextMinRating={1600} />)
        await user.tab()
        expect(group()).toHaveFocus()
        await user.keyboard('{ArrowLeft}')
        expect(tooltip()).toHaveTextContent('1452')
        expect(tooltip()).toHaveTextContent('Game 57')
        await user.keyboard('{ArrowRight}')
        expect(tooltip()).toHaveTextContent('In 1 game')
        expect(tooltip()).toHaveTextContent('about 1456 ± 31')
        expect(screen.getByTestId('chart-live')).toHaveTextContent('In 1 game: about 1456 ± 31')
        await user.keyboard('{End}')
        expect(tooltip()).toHaveTextContent('In 20 games')
        await user.keyboard('{Home}')
        expect(tooltip()).toHaveTextContent('Start')
        expect(tooltip()).toHaveTextContent('1200')
        await user.keyboard('{ArrowRight}')
        expect(tooltip()).toHaveTextContent('Game 1')
        await user.keyboard('{Escape}')
        expect(tooltip()).toBeNull()
    })

    test('pointer: the crosshair snaps to the nearest game', () => {
        const { container } = render(<ClimbChart history={history()} bands={BANDS} nextMinRating={1600} />)
        const svg = container.querySelector('svg')!
        // jsdom has no layout: the chart is drawn 640 px wide from x 0, the plot from x 36 over 596 px for games 0…77
        fireEvent.pointerMove(svg, { clientX: 36 + (596 * 10) / 77 })
        expect(tooltip()).toHaveTextContent('Game 10')
        expect(container.querySelector('[data-crosshair]')).toBeInTheDocument()
        fireEvent.pointerLeave(group())
        expect(tooltip()).toBeNull()
    })

    test('the hidden table lists every point', () => {
        render(<ClimbChart history={history()} bands={BANDS} nextMinRating={1600} />)
        const table = screen.getByRole('table', { name: 'Your rating after each ranked game' })
        expect(within(table).getAllByRole('row')).toHaveLength(1 + 57)
        expect(within(table).getByRole('row', { name: 'Game 57 1452' })).toBeInTheDocument()
    })
})
