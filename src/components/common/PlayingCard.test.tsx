import { describe, test, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PlayingCard } from './PlayingCard'
import { CARD_ART_BASE_URL as R2 } from '../../config'

describe('PlayingCard (old screens, re-pointed to services/cardArt)', () => {
    test('backend and display names both resolve to the bucket file, alt as before', () => {
        render(<><PlayingCard suit="KARA" rank="DESETKA" /><PlayingCard suit="Herc" rank="As" /></>)
        expect(screen.getByAltText('10 of Karo')).toHaveAttribute('src', `${R2}/Karo%2010.png`)
        expect(screen.getByAltText('As of Herc')).toHaveAttribute('src', `${R2}/Herc%20As.png`)
    })

    test('a card whose image fails, or that has no art, shows its name instead of a broken image', () => {
        render(<><PlayingCard suit="PIK" rank="DECKO" /><PlayingCard suit="Joker" rank="1" /></>)
        fireEvent.error(screen.getByAltText('Decko of Pik'))
        expect(screen.queryByAltText('Decko of Pik')).not.toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Decko of Pik' })).toHaveTextContent('Decko Pik')
        expect(screen.getByRole('img', { name: '1 of Joker' })).toHaveTextContent('1 Joker')
    })
})
