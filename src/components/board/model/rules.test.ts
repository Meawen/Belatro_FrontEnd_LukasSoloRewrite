import { describe, test, expect } from 'vitest'
import { PLAIN_ORDER, TRUMP_ORDER, cardId, playOrder, strength, trickWinner } from './rules'
import type { GameCard } from '../../../types/game'

const c = (boja: GameCard['boja'], rank: GameCard['rank']): GameCard => ({ boja, rank })

describe('card rules', () => {
    test('a card id is BOJA-RANK, as data-card', () => {
        expect(cardId(c('HERC', 'AS'))).toBe('HERC-AS')
    })

    test('strength: trump 7 8 Q K 10 A 9 J, other suits 7 8 9 J Q K 10 A', () => {
        expect(TRUMP_ORDER).toEqual(['SEDMICA', 'OSMICA', 'BABA', 'KRALJ', 'DESETKA', 'AS', 'DEVETKA', 'DECKO'])
        expect(PLAIN_ORDER).toEqual(['SEDMICA', 'OSMICA', 'DEVETKA', 'DECKO', 'BABA', 'KRALJ', 'DESETKA', 'AS'])
        expect(strength(c('PIK', 'DECKO'), 'PIK')).toBe(7)
        expect(strength(c('PIK', 'DECKO'), 'HERC')).toBe(3)
        expect(strength(c('KARA', 'DESETKA'), null)).toBe(6)
    })
})

describe('trickWinner (Trick.isCardWinning)', () => {
    test('without trumps the highest card of the led suit wins; other suits never do', () => {
        expect(trickWinner([c('KARA', 'KRALJ'), c('KARA', 'DESETKA'), c('PIK', 'AS'), c('KARA', 'DEVETKA')], 'HERC')).toBe(1)
        expect(trickWinner([c('KARA', 'SEDMICA'), c('PIK', 'AS'), c('TREF', 'AS'), c('PIK', 'DESETKA')], 'HERC')).toBe(0)
    })

    test('any trump beats the led suit, and the higher trump wins (9 over A, J over 9)', () => {
        expect(trickWinner([c('KARA', 'AS'), c('HERC', 'SEDMICA'), c('KARA', 'DESETKA'), c('PIK', 'AS')], 'HERC')).toBe(1)
        expect(trickWinner([c('KARA', 'AS'), c('HERC', 'AS'), c('HERC', 'DEVETKA'), c('KARA', 'KRALJ')], 'HERC')).toBe(2)
        expect(trickWinner([c('HERC', 'DEVETKA'), c('HERC', 'DECKO'), c('HERC', 'AS'), c('HERC', 'DESETKA')], 'HERC')).toBe(1)
    })

    test('works on a trick in progress, and on none', () => {
        expect(trickWinner([c('TREF', 'BABA'), c('TREF', 'KRALJ')], null)).toBe(1)
        expect(trickWinner([], 'PIK')).toBe(-1)
    })
})

describe('playOrder', () => {
    test('the cyclic turn order from the lead', () => {
        expect(playOrder(['alice', 'bob', 'carol', 'dave'], 'carol')).toEqual(['carol', 'dave', 'alice', 'bob'])
        expect(playOrder(['carol', 'dave', 'alice', 'bob'], 'alice')).toEqual(['alice', 'bob', 'carol', 'dave'])
    })

    test('the "_NO_LEAD_" placeholder leaves the order as it is', () => {
        expect(playOrder(['alice', 'bob', 'carol', 'dave'], '_NO_LEAD_')).toEqual(['alice', 'bob', 'carol', 'dave'])
    })
})
