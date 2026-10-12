import { describe, test, expect } from 'vitest'
import { PENDING_MS, answerBela, pendingUntil, pressBid, pressCard, settleInput, unlock, waitingForDeclarations } from './input'
import { EMPTY_LOCAL, NO_INPUT, boardModel, type BoardModel, type InputState } from './boardModel'
import { indexOf, playTable, type FanOut } from '../../../test/fixtures/views/table'
import type { GameCard, PrivateGameView } from '../../../types/game'

// no wait for the declarations here: these tests press at small `now`s; the wait has its own describe below
const table = playTable({ pauseMs: 0 })
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

describe('the declarations wait (gameplay rules §4)', () => {
    // the default table: dave holds a 20, so play opens 5 s after the trump call; alice leads
    const waited = playTable()
    const call = waited[indexOf(waited, 'call:') + 1]
    const opens = call.public.zvanja!.playOpensAt!
    const skew = 1500
    const leader = (input: InputState = NO_INPUT, hand?: GameCard[]): BoardModel => {
        const priv = hand ? { ...call.private.alice, hand } : call.private.alice
        return boardModel({ publicView: priv.publicPart, privateView: priv, receivedAt: 0, skew, source: 'live' }, 'alice', { ...EMPTY_LOCAL, input })
    }

    test('waiting before playOpensAt on the server clock (now + skew); not at it or after', () => {
        const model = leader()
        expect(model).toMatchObject({ canPlay: true, playOpensAt: call.at + 5000 })
        expect(waitingForDeclarations(model, opens - skew - 1)).toBe(true)
        expect(waitingForDeclarations(model, opens - skew)).toBe(false)
        expect(waitingForDeclarations(model, opens - skew + 10_000)).toBe(false)
        // the local clock alone would still be waiting here
        expect(waitingForDeclarations(model, opens - 1)).toBe(false)
        expect(waitingForDeclarations(modelOf(table[indexOf(table, 'call:') + 1], NO_INPUT, 'alice'), 0)).toBe(false)
    })

    test('a card sends nothing while waiting, and is sent once play opens', () => {
        const model = leader()
        const card = model.hand.find((c) => c.enabled && !c.bela)!
        expect(pressCard(model, NO_INPUT, card.id, opens - skew - 1)).toEqual({ input: NO_INPUT, move: null })
        expect(pressCard(model, NO_INPUT, card.id, opens - skew).move).toEqual({ kind: 'play', card: card.card, declareBela: false })
    })

    test('Play + Bela sends nothing while waiting, and is sent once play opens; nor does a bela card open the prompt', () => {
        const q: GameCard = { boja: 'HERC', rank: 'BABA' }
        const hand: GameCard[] = [{ boja: 'HERC', rank: 'KRALJ' }, q, { boja: 'KARA', rank: 'AS' }]
        const open: InputState = { pending: null, belaCardId: 'HERC-BABA' }
        const asking = leader(open, hand)
        expect(asking.belaPrompt!.id).toBe('HERC-BABA')
        expect(answerBela(asking, open, true, opens - skew - 1)).toEqual({ input: open, move: null })
        expect(answerBela(asking, open, true, opens - skew).move).toEqual({ kind: 'play', card: q, declareBela: true })
        expect(pressCard(leader(NO_INPUT, hand), NO_INPUT, 'HERC-BABA', opens - skew - 1)).toEqual({ input: NO_INPUT, move: null })
    })
})
