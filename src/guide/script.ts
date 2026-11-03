import { cardId, type CardId } from '../components/board/model/rules';
import type { CoachMove } from '../components/board/coach';
import type { RuleSection } from '../components/info/rulesData';
import type { Boja, GameCard, PrivateGameView, PublicGameView } from '../types/game';
import type { HandDTO } from '../types/match';

// Škola bele's hand 1 (open beta §7.2): B8's recording of a real server game (backend TutorialRecorder) and the steps
// the learner takes in it. Pure: the replay (useGuideReplay) feeds the frames, the coach asks these functions.

export const RECORDING_FORMAT = 'stiglja-recorded-views/1';
/** Hand 1's lessons in order (D-19, Ruling 49: the zvanje right after the trump call): B8's script keys. */
export const LESSONS = ['dalje', 'mus', 'zvanja', 'followSuit', 'mustTrump', 'lead', 'foul', 'bela', 'foulSeen',
    'followAfterCut', 'followTrump', 'followPik', 'lastTrick', 'padanje', 'challenge', 'foulFound'] as const;
export type LessonKey = (typeof LESSONS)[number];
/** A step's move as B8 recorded it (`declareBela` as in the board's own Move). */
export type GuideMove =
    | { kind: 'bid'; trump: Boja } | { kind: 'pass' }
    | { kind: 'play'; card: GameCard; declareBela: boolean } | { kind: 'challenge' };
export type GuideFrame = { channel: 'public'; body: PublicGameView } | { channel: 'private'; body: PrivateGameView };
/** One stop: the private frame it waits on, its lesson, the learner's move (null: a lesson-only stop), the frame's legal cards. */
export interface GuideStep { index: number; frame: number; lesson: LessonKey; move: GuideMove | null; legal: CardId[] | null }
export interface Guide { gameId: string; me: string; frames: GuideFrame[]; steps: GuideStep[] }

/** Each lesson's section of the full rules, which its "More in the Rules" link opens (ranks spec §9.2). */
export const LESSON_RULES: Record<LessonKey, RuleSection> = {
    dalje: 'rules-bidding',
    mus: 'rules-bidding',
    zvanja: 'rules-declarations',
    followSuit: 'rules-playing',
    mustTrump: 'rules-playing',
    lead: 'rules-playing',
    foul: 'rules-challenge',
    bela: 'rules-declarations',
    foulSeen: 'rules-challenge',
    followAfterCut: 'rules-playing',
    followTrump: 'rules-playing',
    followPik: 'rules-playing',
    lastTrick: 'rules-cards',
    padanje: 'rules-scoring',
    challenge: 'rules-challenge',
    foulFound: 'rules-challenge',
};

const BOJE: readonly string[] = ['KARA', 'HERC', 'TREF', 'PIK'];
const RANKS: readonly string[] = ['SEDMICA', 'OSMICA', 'DEVETKA', 'DESETKA', 'DECKO', 'BABA', 'KRALJ', 'AS'];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCard = (value: unknown): value is GameCard => isObject(value) && BOJE.includes(value.boja as string) && RANKS.includes(value.rank as string);

function moveOf(value: unknown, where: string): GuideMove | null {
    if (value === undefined) return null;
    if (!isObject(value)) throw new Error(`${where}: the move is not an object`);
    if (value.kind === 'bid' && BOJE.includes(value.trump as string)) return { kind: 'bid', trump: value.trump as Boja };
    if (value.kind === 'pass') return { kind: 'pass' };
    if (value.kind === 'play' && isCard(value.card) && typeof value.declareBela === 'boolean') {
        return { kind: 'play', card: { boja: value.card.boja, rank: value.card.rank }, declareBela: value.declareBela };
    }
    if (value.kind === 'challenge') return { kind: 'challenge' };
    throw new Error(`${where}: the move ${JSON.stringify(value)} is not a bid, a pass, a play or a challenge`);
}

/**
 * The recording read as the guide's steps (B8's `stiglja-recorded-views/1` plus `steps`). Throws an Error naming
 * what is wrong: another format, a frame that isn't a public or private view, a step that isn't on a private frame or
 * goes back, an unknown lesson or move, or a play the frame's legal cards (the server's rules) don't allow.
 */
export function stepsOf(recording: unknown): Guide {
    if (!isObject(recording) || recording.format !== RECORDING_FORMAT) throw new Error(`the recording's format is not ${RECORDING_FORMAT}`);
    const { gameId, me, frames, steps } = recording;
    if (typeof gameId !== 'string' || typeof me !== 'string') throw new Error('the recording has no gameId or me');
    if (!Array.isArray(frames) || frames.length === 0) throw new Error('the recording has no frames');
    frames.forEach((frame, i) => {
        if (!isObject(frame) || (frame.channel !== 'public' && frame.channel !== 'private') || !isObject(frame.body)) {
            throw new Error(`frame ${i} is not a public or private view`);
        }
    });
    if (!Array.isArray(steps) || steps.length === 0) throw new Error('the recording has no steps');
    let last = 0;
    const parsed = steps.map((raw, index): GuideStep => {
        const where = `step ${index}`;
        if (!isObject(raw)) throw new Error(`${where} is not an object`);
        const frameIndex = raw.frame;
        if (typeof frameIndex !== 'number' || !Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= frames.length) {
            throw new Error(`${where}: frame ${String(frameIndex)} is not a frame of the recording`);
        }
        const frame = frames[frameIndex] as GuideFrame;
        if (frame.channel !== 'private') throw new Error(`${where}: frame ${frameIndex} is not a private frame`);
        if (frameIndex < last) throw new Error(`${where}: frame ${frameIndex} comes before the step before it`);
        last = frameIndex;
        if (!(LESSONS as readonly unknown[]).includes(raw.lesson)) throw new Error(`${where}: ${String(raw.lesson)} is not a lesson`);
        const move = moveOf(raw.move, where);
        let legal: CardId[] | null = null;
        if (move?.kind === 'play') {
            const cards = frame.body.legalCards;
            legal = Array.isArray(cards) ? cards.filter(isCard).map(cardId) : [];
            if (!legal.includes(cardId(move.card))) throw new Error(`${where}: ${cardId(move.card)} is not among frame ${frameIndex}'s legal cards`);
        }
        return { index, frame: frameIndex, lesson: raw.lesson as LessonKey, move, legal };
    });
    return { gameId, me, frames: frames as GuideFrame[], steps: parsed };
}

const sameCard = (a: GameCard, b: GameCard) => a.boja === b.boja && a.rank === b.rank;

/** Is the board's move the step's move? The same kind; a bid of the same trump; a play of the same card with the same bela answer. */
export function matches(move: GuideMove, m: CoachMove): boolean {
    if (move.kind === 'bid') return m.kind === 'bid' && m.trump === move.trump;
    if (move.kind === 'play') return m.kind === 'play' && sameCard(m.card, move.card) && m.bela === move.declareBela;
    return m.kind === move.kind;
}

/** Why a move isn't the step's move: the panel's line for it (LessonPanel). */
export type RefusalKind = 'illegal' | 'otherCard' | 'bela' | 'bid' | 'pass' | 'challengeEarly' | 'challengeFoul' | 'readFirst';

/**
 * Why `m` was refused while the learner works toward step `index` (`ready`: they are at it). A Challenge outside the
 * challenge step states the real rule: before the foul it would be wrong; once the foul is on the table (its own stop
 * included, Ruling 69) it would be right, and would end the hand; at a stop before it, read first. A card the rules
 * forbid gets the rule it breaks, a card they allow the reason the lesson picks another; null while the table moves
 * (nothing to say about a card then).
 */
export function refusalOf(steps: readonly GuideStep[], index: number, ready: boolean, m: CoachMove): RefusalKind | null {
    const step = steps[index] as GuideStep | undefined;
    if (m.kind === 'challenge' && step?.move?.kind !== 'challenge') {
        // the foul's frame comes with its stop: it is on the table once that stop is reached
        const foul = steps.findIndex((each) => each.lesson === 'foul');
        if (foul >= 0 && (index > foul || (index === foul && ready))) return 'challengeFoul';
        return ready && step && step.move === null ? 'readFirst' : 'challengeEarly';
    }
    if (!ready || !step) return null;
    const move = step.move;
    if (move === null) return 'readFirst';
    if (move.kind === 'bid' && m.kind === 'pass') return 'pass';
    if (move.kind === 'bid' && m.kind === 'bid') return 'bid';
    if (move.kind === 'play' && m.kind === 'play') {
        if (sameCard(m.card, move.card) && move.declareBela && !m.bela) return 'bela';
        return step.legal?.includes(cardId(m.card)) ? 'otherCard' : 'illegal';
    }
    return 'readFirst';
}

/** This hand went to a right challenge (gameplay rules §1). */
const decidedByChallenge = (view: PublicGameView): boolean => Boolean(view.lastChallenge?.thisHand && view.lastChallenge.foulFound);

/** A team's declaration points: its zvanja if it won the contest (gameplay rules §2), +20 per bela; none for the team a right challenge caught (§1). */
function declared(view: PublicGameView, team: 'A' | 'B'): number {
    if (decidedByChallenge(view) && view.lastChallenge!.team !== team) return 0;
    const members = (team === 'A' ? view.teamA : view.teamB).map((seat) => seat.id);
    let points = view.zvanja?.winnerTeam === team ? view.zvanja.total : 0;
    for (const [id, on] of Object.entries(view.belaDeclaredByPlayer ?? {})) if (on && members.includes(id)) points += 20;
    return points;
}

/**
 * The structured moves the server would have stored for hand 1 by the last of `views` (GET /matches/{id}/structured-
 * moves), so the peek, Bela Blok and the hand result have their hand: the trump calls, each completed trick with its
 * winner, the challenge, and the summary once the hand is over (after a right challenge, the corrected one the
 * CHALLENGE move carries). The logic of the dev board's devHands, for one hand starting at 0–0.
 */
export function storedHands(views: readonly PublicGameView[]): HandDTO[] {
    const view = views.at(-1);
    if (!view) return [];
    const hand: HandDTO = {
        handNo: 1,
        trumpCalls: view.bids.map((bid, i) => ({ order: i, player: bid.playerId, trump: bid.action === 'PASS' ? 'PASS' : bid.selectedTrump })),
        tricks: [],
        challenges: [],
        handSummary: null,
    };
    let seen = '';
    for (const each of views) {
        const last = each.lastTrick;
        if (!last || each.gameState === 'BIDDING') continue;
        const key = `${last.leadPlayerId}:${last.order.map((id) => `${last.plays[id].boja}-${last.plays[id].rank}`).join(',')}`;
        if (key === seen) continue;
        seen = key;
        const trickNo = hand.tricks!.length + 1;
        hand.tricks!.push({
            trickNo,
            winnerId: last.winnerId,
            points: null,
            moves: last.order.map((id, k) => ({ order: k, player: id, card: `${last.plays[id].rank} of ${last.plays[id].boja}`, legal: null })),
            lastTrickBonus: trickNo === 8,
        });
    }
    const challenge = view.lastChallenge;
    if (challenge) hand.challenges = [{ order: 0, player: challenge.playerId, success: challenge.foulFound }];
    if (view.gameState === 'HAND_COMPLETE') {
        const gain = { A: view.teamAScore, B: view.teamBScore };
        const caller = view.bids.find((bid) => bid.action === 'CALL_TRUMP')?.playerId;
        const callerTeam = caller && view.teamA.some((seat) => seat.id === caller) ? 'A' : 'B';
        const challenged = decidedByChallenge(view);
        hand.handSummary = {
            teamAPoints: gain.A - declared(view, 'A'),
            teamBPoints: gain.B - declared(view, 'B'),
            teamADeclPoints: declared(view, 'A'),
            teamBDeclPoints: declared(view, 'B'),
            teamATricksWon: view.tricksWonA ?? 0,
            teamBTricksWon: view.tricksWonB ?? 0,
            // a right challenge: padanje only when the hand is taken from the trump caller's team (backend B7)
            padanje: challenged ? view.lastChallenge!.team !== callerTeam : gain[callerTeam] === 0,
            capot: !challenged && (view.tricksWonA === 8 || view.tricksWonB === 8),
            finalScoreA: view.teamAScore,
            finalScoreB: view.teamBScore,
        };
    }
    return [hand];
}
