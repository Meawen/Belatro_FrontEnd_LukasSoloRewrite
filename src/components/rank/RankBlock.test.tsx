import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankBlock } from './RankBlock'
import { rankedUser } from '../../test/fixtures/ranks'

// ranks spec §6.1: under the name, the chip, the tagline and the way to the next rank
describe('RankBlock', () => {
    test('a placed rank with a next one: chip, tagline, a progress bar and "{gap} to {next}"', () => {
        render(<RankBlock player={rankedUser({ key: 'PAJDAS', eloRating: 1290 })} nextName="Gospon" />)
        expect(screen.getByText('Pajdaš').closest('.ui-chip')).toHaveClass('bg-rank-pajdas')
        expect(screen.getByText('Dober pajdaš.')).toBeInTheDocument()
        const bar = screen.getByRole('progressbar', { name: 'Progress to Gospon' })
        expect(bar).toHaveAttribute('aria-valuemin', '1200')
        expect(bar).toHaveAttribute('aria-valuemax', '1400')
        expect(bar).toHaveAttribute('aria-valuenow', '1290')
        expect(screen.getByText('110 to Gospon')).toBeInTheDocument()
    })

    test('without the next name (no ladder) it says "the next rank"', () => {
        render(<RankBlock player={rankedUser({ key: 'PAJDAS', eloRating: 1290 })} nextName={null} />)
        expect(screen.getByText('110 to the next rank')).toBeInTheDocument()
        expect(screen.getByRole('progressbar', { name: 'Progress to the next rank' })).toBeInTheDocument()
    })

    test('exactly on a breakpoint the bar sits at its start (review focus 1)', () => {
        render(<RankBlock player={rankedUser({ key: 'GOSPON', eloRating: 1400 })} nextName="Majster" />)
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1400')
        expect(screen.getByText('200 to Majster')).toBeInTheDocument()
    })

    test('Dečec, with no start of its own, gets the text and no bar', () => {
        render(<RankBlock player={rankedUser({ key: 'DECEC', eloRating: 940 })} nextName="Fakin" />)
        expect(screen.getByText('60 to Fakin')).toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    test('Kajkavac: "Top rank" and no bar', () => {
        render(<RankBlock player={rankedUser({ key: 'KAJKAVAC', eloRating: 1846 })} nextName={null} />)
        expect(screen.getByText('Top rank')).toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    test('Cucek: the placement count and no bar', () => {
        render(<RankBlock player={rankedUser({ key: 'CUCEK', eloRating: 1236, rankedGamesPlayed: 3 })} nextName={null} />)
        expect(screen.getByText('Cucek')).toBeInTheDocument()
        expect(screen.getByText('Placement: 3 of 10 ranked games')).toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    test('no rank (a backend before team Elo) renders nothing', () => {
        const { container } = render(<RankBlock player={{ id: 'u1', username: 'ana', eloRating: 1290, level: 3, gamesPlayed: 42 }} nextName="Gospon" />)
        expect(container).toBeEmptyDOMElement()
    })

    test('a long name and tagline from a re-fit backend wrap inside the block (review focus 4)', () => {
        const player = rankedUser({ key: 'PAJDAS' })
        player.rank = { ...player.rank!, name: 'Veliki pajdaš od stola', tagline: 'Dober pajdaš, ki zna kaj je kaj i ne žuri se nikam.' }
        const { container } = render(<RankBlock player={player} nextName="Gospon" />)
        expect(container.firstElementChild).toHaveClass('min-w-0')
        expect(screen.getByText(/Dober pajdaš, ki zna/)).toHaveClass('break-words')
    })
})
