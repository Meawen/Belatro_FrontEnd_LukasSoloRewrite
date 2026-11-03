import { useEffect, useMemo, useState } from 'react';
import { NOTHING_ACCEPTED, acceptFrame, type Accepted, type BoardState, type Frame } from '../components/board/model/accept';
import { endedHand } from '../components/board/model/hands';
import { cardId } from '../components/board/model/rules';
import { matches, refusalOf, storedHands, type Guide, type GuideFrame, type GuideStep, type RefusalKind } from './script';
import type { Coach, CoachMove } from '../components/board/coach';
import type { GameActions } from '../hooks/useGameViews';
import type { MatchHands } from '../hooks/useMatchHands';
import type { PublicGameView } from '../types/game';

/** One other seat's move (a public+private pair) every hold.trick, so each finished trick is seen. */
export const PACE_MS = 900;

/** Without a serverNow to measure from, play opens this long after the frame (the server's declaration pause). */
const PAUSE_MS = 5000;

export interface GuideReplay {
    /** The accepted state for <Board state>. */
    state: BoardState;
    /** allowed, marked, onRefused (LearnPage adds panel and leave). */
    coach: Coach;
    /** Called by the Board for an allowed move: the replay moves on. */
    actions: GameActions;
    /** The step whose lesson shows; null before the first. */
    step: GuideStep | null;
    /** The learner is at `step` (its move or Nastavi is awaited). */
    ready: boolean;
    refusal: RefusalKind | null;
    /** At a lesson-only stop: on to the next step. */
    next: () => void;
    /** storedHands of the frames fed so far. */
    hands: MatchHands;
    /** Nastavi pressed on the last step. */
    done: boolean;
}

/** Recorded zvanja.playOpensAt → its rebased value, each mapped once (the declaration moment's key stays the same). */
type Opens = ReadonlyMap<number, number>;

/**
 * A recorded frame as the board takes it now, its clocks neutralised (open beta §7.2, Ruling 53): no serverNow (the
 * skew is 0), no turn or challenge-window deadline (nothing counts down; the lesson states the real 10-s rule), and the
 * hand's zvanja.playOpensAt moved to now plus the pause it had when first seen, reused for every later frame that
 * carries it. The recording itself is left as it was.
 */
export function rebased(frame: GuideFrame, now: number, opens: Opens): { frame: Frame; opens: Opens } {
    const view = frame.channel === 'private' ? frame.body.publicPart : frame.body;
    const { serverNow, ...rest } = view;
    let zvanja = view.zvanja;
    let next = opens;
    const recorded = zvanja?.playOpensAt;
    if (zvanja && typeof recorded === 'number') {
        let at = opens.get(recorded);
        if (at === undefined) {
            at = now + (typeof serverNow === 'number' ? recorded - serverNow : PAUSE_MS);
            next = new Map(opens).set(recorded, at);
        }
        zvanja = { ...zvanja, playOpensAt: at };
    }
    const publicView: PublicGameView = { ...rest, turnExpiresAt: null, challengeWindowExpiresAt: null, zvanja };
    return {
        frame: frame.channel === 'private'
            ? { kind: 'private', view: { ...frame.body, publicPart: publicView }, source: 'live' }
            : { kind: 'public', view: publicView },
        opens: next,
    };
}

interface Run {
    accepted: Accepted;
    /** The next frame to feed. */
    cursor: number;
    /** The step worked toward; steps.length when done. */
    index: number;
    opens: Opens;
    refusal: RefusalKind | null;
    /** The learner just moved: its result comes at once, not on the table's pace. */
    moved: boolean;
}

/** Feeds frames from the cursor until one private frame has been accepted (normally a public+private pair). */
function feed(guide: Guide, run: Run, now: number): Run {
    let { accepted, cursor, opens } = run;
    while (cursor < guide.frames.length) {
        const frame = guide.frames[cursor];
        cursor += 1;
        const out = rebased(frame, now, opens);
        opens = out.opens;
        accepted = acceptFrame(accepted, out.frame, now);
        if (frame.channel === 'private') break;
    }
    return { ...run, accepted, cursor, opens, moved: false };
}

function start(guide: Guide): Run {
    // the deal (frames 0 and 1), accepted at once
    return feed(guide, { accepted: NOTHING_ACCEPTED, cursor: 0, index: 0, opens: new Map(), refusal: null, moved: false }, Date.now());
}

/**
 * Škola bele's hand 1 on rails (open beta §7.2): B8's recording replayed through the board's acceptance rule. The
 * other seats' moves come one pair every PACE_MS until the frame a step waits on; there the learner makes the step's
 * move (the coach allows only it; the result comes at once) or presses Nastavi at a lesson-only stop. No card is fed
 * before play opens.
 */
export function useGuideReplay(guide: Guide): GuideReplay {
    const [run, setRun] = useState(() => start(guide));
    const { steps } = guide;
    const { index, cursor } = run;
    const done = index === steps.length;
    const ready = !done && cursor > steps[index].frame;
    // the lesson that shows: the step reached, or while the table moves on, the one before it
    const shown = ready ? index : index - 1;
    const step = shown >= 0 ? steps[shown] : null;
    const state = run.accepted.state!;

    // the feeder: the next pair after the pace (at once after the learner's move), never a card before play opens
    useEffect(() => {
        if (done || ready || cursor >= guide.frames.length) return;
        const view = run.accepted.state?.publicView;
        const opensAt = view?.gameState === 'PLAYING' ? view.zvanja?.playOpensAt ?? null : null;
        const delay = Math.max(run.moved ? 0 : PACE_MS, opensAt === null ? 0 : opensAt - Date.now());
        const timer = window.setTimeout(() => {
            const now = Date.now();
            setRun((r) => (r.cursor === cursor ? feed(guide, r, now) : r));
        }, delay);
        return () => window.clearTimeout(timer);
    }, [guide, done, ready, cursor, run.moved, run.accepted]);

    const move = ready ? steps[index].move : null;
    const allowed = (m: CoachMove) => move !== null && matches(move, m);
    // the learner's move went: on toward the next step, and its result is fed on the next macrotask (as a server's answer)
    const go = (m: CoachMove) => {
        if (!allowed(m)) return false;
        setRun((r) => (r.index === index ? { ...r, index: r.index + 1, moved: true, refusal: null } : r));
        return true;
    };

    const coach: Coach = {
        allowed,
        marked: move?.kind === 'play' ? [cardId(move.card)] : undefined,
        onRefused: (m) => {
            const refusal = refusalOf(steps, index, ready, m);
            if (refusal !== null) setRun((r) => (r.refusal === refusal ? r : { ...r, refusal }));
        },
    };
    const actions: GameActions = {
        play: (card, declareBela = false) => go({ kind: 'play', card, bela: declareBela }),
        bidTrump: (trump) => go({ kind: 'bid', trump }),
        passBid: () => go({ kind: 'pass' }),
        challenge: () => go({ kind: 'challenge' }),
    };
    const next = () => {
        if (!ready || steps[index].move !== null) return;
        setRun((r) => (r.index === index ? { ...r, index: r.index + 1, refusal: null } : r));
    };

    const hands = useMemo<MatchHands>(() => {
        const views = guide.frames.slice(0, cursor).flatMap((frame) => (frame.channel === 'private' ? [frame.body.publicPart] : []));
        const stored = storedHands(views);
        const last = views.at(-1);
        const ended = last?.gameState === 'HAND_COMPLETE' ? endedHand(stored, { a: last.teamAScore, b: last.teamBScore }) : null;
        return { hands: stored, ended, loading: false, error: null, refresh: () => {} };
    }, [guide, cursor]);

    return { state, coach, actions, step, ready, refusal: run.refusal, next, hands, done };
}
