import { describe, test, expect } from 'vitest'
import { PENDING_MS, answerBela, pendingUntil, pressBid, pressCard, settleInput, unlock } from './input'
import { EMPTY_LOCAL, NO_INPUT, boardModel, type BoardModel, type InputState } from './boardModel'
import { indexOf, playTable, type FanOut } from '../../../test/fixtures/views/table'
import type { GameCard, PrivateGameView } from '../../../types/game'

const table = playTable()
const modelOf = (f: FanOut | PrivateGameView, input: InputState = NO_INPUT, me = 'carol'): BoardModel => {
    const priv = 'private' in f ? f.private[me] : f
    return boardModel({ publicView: priv.publicPart, privateView: priv, receivedAt: 0, skew: 0, source: 'live' }, me, { ...EMPTY_LOCAL, input })
}
const myTurn = indexOf(table, 'play:carol:') - 1
const sent = table[myTurn + 1].label.split(':')[2]

describe('input rules (spec §5.3.5, D-9)', () => {
    test('on my playing turn a card is sent and becomes pending; the rest of the hand waits', () => {
        const model = modelOf(table[myTurn])
        expect(model.hand.every((card) => card.enabled)).toBe(true)
        const card = model.hand.find((c) => c.id === sent)!
        const press = pressCard(model, NO_INPUT, sent, 100)
        expect(press.move).toEqual({ kind: 'play', card: card.card, declareBela: false })
        expect(press.input).toEqual({
            pending: { kind: 'card', cardId: sent, at: 100, lifted: true, version: table[myTurn].version, receivedAt: 0 }, belaCardId: null,
        })
        const waiting = modelOf(table[myTurn], press.input)
        expect(waiting.hand.filter((c) => c.enabled)).toEqual([])
        expect(waiting.hand.find((c) => c.id === sent)!.pending).toBe(true)
        expect(pendingUntil(press.input)).toBe(100 + PENDING_MS)
    })

    test('a fast second tap plays nothing while the first card is in flight', () => {
        const model = modelOf(table[myTurn])
        const first = pressCard(model, NO_INPUT, model.hand[0].id, 100)
        const second = pressCard(modelOf(table[myTurn], first.input), first.input, model.hand[1].id, 150)
        expect(second).toEqual({ input: first.input, move: null })
    })

    test('the lock holds through re-broadcasts of the same state, and lifts with a newer state or when my turn passes', () => {
        const press = pressCard(modelOf(table[myTurn]), NO_INPUT, sent, 100)
        expect(table[myTurn - 1].version).toBe(table[myTurn].version)
        expect(settleInput(press.input, modelOf(table[myTurn - 1], press.input), 150)).toBe(press.input)
        expect(settleInput(press.input, modelOf(table[myTurn + 1], press.input), 200).pending).toBeNull()
        const notMine = structuredClone(table[myTurn].private.carol)
        notMine.yourTurn = false
        expect(settleInput(press.input, modelOf(notMine, press.input), 200).pending).toBeNull()
    })

    test('after 2 s the card drops back but the hand stays locked; a lost send or a reconnect unlocks it at once', () => {
        const press = pressCard(modelOf(table[myTurn]), NO_INPUT, sent, 100)
        expect(settleInput(press.input, modelOf(table[myTurn], press.input), 100 + PENDING_MS - 1)).toBe(press.input)
        const dropped = settleInput(press.input, modelOf(table[myTurn], press.input), 100 + PENDING_MS)
        expect(dropped.pending).toMatchObject({ kind: 'card', cardId: sent, lifted: false })
        expect(pendingUntil(dropped)).toBeNull()
        const model = modelOf(table[myTurn], dropped)
        expect(model.hand.some((c) => c.enabled || c.pending)).toBe(false)
        expect(pressCard(model, dropped, model.hand[0].id, 5000).move).toBeNull()
        expect(unlock(dropped)).toEqual(NO_INPUT)
        expect(unlock(NO_INPUT)).toBe(NO_INPUT)
    })

    test('the newest model wins: a card it no longer shows as mine and enabled does nothing', () => {
        expect(pressCard(modelOf(table[myTurn + 1]), NO_INPUT, sent, 100).move).toBeNull()
        expect(pressCard(modelOf(table[myTurn - 2]), NO_INPUT, modelOf(table[myTurn - 2]).hand[0].id, 100).move).toBeNull()
    })

    test('a bela card opens the prompt; Play or Play + Bela sends it; the prompt closes when my turn passes (R-32)', () => {
        const priv = structuredClone(table[myTurn].private.carol)
        const k: GameCard = { boja: 'HERC', rank: 'KRALJ' }
        const q: GameCard = { boja: 'HERC', rank: 'BABA' }
        priv.hand = [k, q, { boja: 'KARA', rank: 'AS' }]
        const model = modelOf(priv)
        const open = pressCard(model, NO_INPUT, 'HERC-BABA', 100)
        expect(open).toEqual({ input: { pending: null, belaCardId: 'HERC-BABA' }, move: null })
        const asking = modelOf(priv, open.input)
        expect(asking.belaPrompt!.id).toBe('HERC-BABA')
        expect(answerBela(asking, open.input, true, 120)).toEqual({
            input: { pending: { kind: 'card', cardId: 'HERC-BABA', at: 120, lifted: true, version: table[myTurn].version, receivedAt: 0 }, belaCardId: null },
            move: { kind: 'play', card: q, declareBela: true },
        })
        expect(answerBela(asking, open.input, false, 120).move).toEqual({ kind: 'play', card: q, declareBela: false })
        // another card instead: it is played, and the prompt closes
        expect(pressCard(asking, open.input, 'KARA-AS', 130).input.belaCardId).toBeNull()
        priv.yourTurn = false
        expect(settleInput(open.input, modelOf(priv, open.input), 140).belaCardId).toBeNull()
    })

    test('bids: one in flight, held past 2 s, released by a newer state or when my turn passes; no Pass when the dealer must call', () => {
        const carolBids = indexOf(table, 'bid:carol:') - 1
        const model = modelOf(table[carolBids])
        expect(model.canBid).toBe(true)
        const pass = pressBid(model, NO_INPUT, 'PASS', 100)
        expect(pass.move).toEqual({ kind: 'bid', trump: null })
        expect(pass.input.pending).toEqual({ kind: 'bid', at: 100, version: table[carolBids].version, receivedAt: 0 })
        expect(pressBid(modelOf(table[carolBids], pass.input), pass.input, 'KARA', 110).move).toBeNull()
        expect(settleInput(pass.input, modelOf(table[carolBids], pass.input), 100 + PENDING_MS)).toBe(pass.input)
        expect(settleInput(pass.input, modelOf(table[carolBids + 1], pass.input), 120).pending).toBeNull()
        const dealer = modelOf(table[indexOf(table, 'call:') - 1], NO_INPUT, 'dave')
        expect(dealer.dealerMustCall).toBe(true)
        expect(pressBid(dealer, NO_INPUT, 'PASS', 100).move).toBeNull()
        expect(pressBid(dealer, NO_INPUT, 'PIK', 100).move).toEqual({ kind: 'bid', trump: 'PIK' })
    })
})
