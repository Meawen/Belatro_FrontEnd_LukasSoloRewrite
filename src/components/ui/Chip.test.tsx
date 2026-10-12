import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chip, Tag } from './Chip'

describe('Chip and Tag (spec §3.7)', () => {
    test('notched, in caption type, neutral by default', () => {
        render(<><Chip>Casual</Chip><Tag>Padanje</Tag></>)
        for (const element of [screen.getByText('Casual').closest('span.ui-chip'), screen.getByText('Padanje').closest('span.ui-tag')]) {
            expect(element).toHaveClass('notch', 't-caption', 'bg-surface-2', 'text-text-2')
        }
    })

    test('each tone takes its token colours', () => {
        const tones = [
            ['mode', 'bg-surface-2', 'text-accent'],
            ['team-a', 'bg-team-a', 'text-ink'],
            ['team-b', 'bg-team-b', 'text-ink'],
            ['you', 'bg-accent', 'text-ink'],
            ['win', 'bg-success', 'text-ink'],
            ['bad', 'bg-danger-fill', 'text-text'],
            ['warn', 'bg-warn-fill', 'text-text'],
        ] as const
        render(<>{tones.map(([tone]) => <Tag key={tone} tone={tone}>{tone}</Tag>)}</>)
        for (const [tone, bg, fg] of tones) expect(screen.getByText(tone).closest('.ui-tag'), tone).toHaveClass(bg, fg)
    })

    test('a trump chip takes its suit colour, ink or light text by contrast, and leads with the suit icon', () => {
        render(<><Chip tone="trump" suit="HERC">Herc</Chip><Chip tone="trump" suit="KARA">Karo</Chip><Tag tone="trump" suit="PIK">Trump</Tag><Tag tone="trump" suit="TREF">Tref</Tag></>)
        expect(screen.getByText('Herc').closest('.ui-chip')).toHaveClass('bg-suit-herc', 'text-text')
        expect(screen.getByText('Karo').closest('.ui-chip')).toHaveClass('bg-suit-karo', 'text-ink')
        expect(screen.getByText('Trump').closest('.ui-tag')).toHaveClass('bg-suit-pik', 'text-text')
        expect(screen.getByText('Tref').closest('.ui-tag')).toHaveClass('bg-suit-tref', 'text-ink')
        const icon = screen.getByText('Herc').closest('.ui-chip')!.querySelector('img')
        expect(icon).toHaveAttribute('src', expect.stringMatching(/hercIcon\.png$/))
        expect(icon).toHaveAttribute('alt', '')
    })

    test('an icon is decoration; the text is the content', () => {
        render(<Chip icon="lock">Private</Chip>)
        const chip = screen.getByText('Private').closest('.ui-chip')!
        expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
        expect(chip).toHaveTextContent(/^Private$/)
    })
})
