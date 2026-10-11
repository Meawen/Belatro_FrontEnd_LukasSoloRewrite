import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankChip } from './RankChip'
import { rank } from '../../test/fixtures/ranks'

// spec §5: the rank as a coloured chip, or nothing
describe('RankChip', () => {
    test('a placed rank is a 20-px tag in its own colour with ink text, its tagline in the title', () => {
        render(<RankChip rank={rank('PAJDAS')} />)
        const tag = screen.getByText('Pajdaš').closest('.ui-tag')
        expect(tag).toHaveClass('h-5', 'bg-rank-pajdas', 'text-ink')
        expect(tag).toHaveAttribute('title', 'Pajdaš: Dober pajdaš.')
        expect(tag!.closest('[data-rank]')).toHaveAttribute('data-rank', 'PAJDAS')
    })

    test('size "chip" is the 28-px chip', () => {
        render(<RankChip rank={rank('GOSPON')} size="chip" />)
        expect(screen.getByText('Gospon').closest('.ui-chip')).toHaveClass('h-7', 'bg-rank-gospon', 'text-ink')
    })

    test('Cucek is neutral; Dečec, the darkest step, takes light text', () => {
        render(<><RankChip rank={rank('CUCEK')} /><RankChip rank={rank('DECEC')} /></>)
        expect(screen.getByText('Cucek').closest('.ui-tag')).toHaveClass('bg-surface-2', 'text-text-2')
        expect(screen.getByText('Dečec').closest('.ui-tag')).toHaveClass('bg-rank-decec', 'text-text')
    })

    test('no rank (an old backend) renders nothing', () => {
        const { container } = render(<><RankChip rank={undefined} /><RankChip rank={null} /></>)
        expect(container).toBeEmptyDOMElement()
    })

    test('prints the name the server sends, never one derived from the key', () => {
        render(<RankChip rank={{ ...rank('GOSPON'), name: 'Test name' }} />)
        expect(screen.getByText('Test name').closest('.ui-tag')).toHaveClass('bg-rank-gospon')
    })
})
