import { describe, test, expect } from 'vitest'
import { handOrder, type FrozenOrder } from './handOrder'
import { cardId } from './rules'
import { playTable } from '../../../test/fixtures/views/table'
import type { Boja, GameCard, Rank } from '../../../types/game'

const c = (boja: Boja, rank: Rank): GameCard => ({ boja, rank })
const ids = (cards: GameCard[]) => cards.map(cardId)

// the server's order of a 6-card hand: Karo first, then Herc, then Tref
const dealt = [c('KARA', 'SEDMICA'), c('KARA', 'DESETKA'), c('HERC', 'DEVETKA'), c('HERC', 'AS'), c('TREF', 'BABA'), c('TREF', 'DECKO')]

describe('handOrder (spec §5.3.6)', () => {
    test("the suit groups come from the server's first order and stay frozen when the server reshuffles", () => {
        const first = handOrder(dealt, null, null)
        expect(ids(first.cards)).toEqual(['KARA-SEDMICA', 'KARA-DESETKA', 'HERC-DEVETKA', 'HERC-AS', 'TREF-DECKO', 'TREF-BABA'])
        expect(first.frozen).toEqual({ dealt: ids(dealt), suits: ['KARA', 'HERC', 'TREF'] })
        const reshuffled = [...dealt.slice(4), ...dealt.slice(2, 4), ...dealt.slice(0, 2)]
        expect(ids(handOrder(reshuffled, null, first.frozen).cards)).toEqual(ids(first.cards))
    })

    test('within a suit weakest to strongest: other suits 7 8 9 J Q K 10 A, trump 7 8 Q K 10 A 9 J', () => {
        const herc = [c('HERC', 'AS'), c('HERC', 'DECKO'), c('HERC', 'DESETKA'), c('HERC', 'DEVETKA'), c('HERC', 'BABA'), c('HERC', 'SEDMICA')]
        expect(ids(handOrder(herc, null, null).cards))
            .toEqual(['HERC-SEDMICA', 'HERC-DEVETKA', 'HERC-DECKO', 'HERC-BABA', 'HERC-DESETKA', 'HERC-AS'])
        expect(ids(handOrder(herc, 'HERC', null).cards))
            .toEqual(['HERC-SEDMICA', 'HERC-BABA', 'HERC-DESETKA', 'HERC-AS', 'HERC-DEVETKA', 'HERC-DECKO'])
    })

    test('after the trump call the trump group moves to the right end; a suit first seen in the +2 joins after the frozen groups', () => {
        const { frozen } = handOrder(dealt, null, null)
        const eight = [c('PIK', 'KRALJ'), ...dealt, c('HERC', 'KRALJ')]
        const after = handOrder(eight, 'KARA', frozen)
        expect(ids(after.cards)).toEqual([
            'HERC-DEVETKA', 'HERC-KRALJ', 'HERC-AS', 'TREF-DECKO', 'TREF-BABA', 'PIK-KRALJ', 'KARA-SEDMICA', 'KARA-DESETKA',
        ])
        expect(after.frozen).toEqual({ dealt: ids(dealt), suits: ['KARA', 'HERC', 'TREF', 'PIK'] })
    })

    test('cards are matched by id: playing one leaves the others where they were', () => {
        const { cards, frozen } = handOrder(dealt, 'TREF', handOrder(dealt, null, null).frozen)
        const played = handOrder(dealt.filter((card) => cardId(card) !== 'HERC-DEVETKA').reverse(), 'TREF', frozen)
        expect(ids(played.cards)).toEqual(ids(cards).filter((id) => id !== 'HERC-DEVETKA'))
    })

    test('a new deal freezes a new order', () => {
        const { frozen } = handOrder(dealt, null, null)
        const next = [c('PIK', 'AS'), c('PIK', 'SEDMICA'), c('HERC', 'SEDMICA'), c('KARA', 'AS'), c('TREF', 'AS'), c('TREF', 'SEDMICA')]
        expect(handOrder(next, null, frozen).frozen).toEqual({ dealt: ids(next), suits: ['PIK', 'HERC', 'KARA', 'TREF'] })
    })

    test('a snapshot that lands mid-hand freezes the order of the hand it shows', () => {
        const five = [c('PIK', 'AS'), c('HERC', 'SEDMICA'), c('PIK', 'SEDMICA'), c('TREF', 'AS'), c('HERC', 'AS')]
        const { cards, frozen } = handOrder(five, 'HERC', null)
        expect(frozen).toEqual({ dealt: ids(five), suits: ['PIK', 'HERC', 'TREF'] })
        expect(ids(cards)).toEqual(['PIK-SEDMICA', 'PIK-AS', 'TREF-AS', 'HERC-SEDMICA', 'HERC-AS'])
    })

    test("over a whole hand the frozen groups only grow, and the trump stays at the right end", () => {
        let frozen: FrozenOrder | null = null
        let first: Boja[] = []
        let frames = 0
        for (const fanOut of playTable({ trump: 'PIK' })) {
            const view = fanOut.private.carol
            if (view.publicPart.gameState === 'HAND_COMPLETE') break
            const trump = view.publicPart.gameState === 'PLAYING' ? 'PIK' : null
            const result = handOrder(view.hand, trump, frozen)
            frozen = result.frozen
            if (frames++ === 0) first = frozen.suits
            expect(frozen.suits.slice(0, first.length)).toEqual(first)
            if (trump && result.cards.some((card) => card.boja === 'PIK')) expect(result.cards[result.cards.length - 1].boja).toBe('PIK')
        }
        expect(frames).toBeGreaterThan(20)
    })
})
