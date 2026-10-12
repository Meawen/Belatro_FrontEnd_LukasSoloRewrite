import type { PrivateGameView, PublicGameView } from '../../../types/game';

/** `snapshot`: the /app/queue/games/{id} answer, or the first private frame after mount or a reconnect. */
export type ViewSource = 'live' | 'snapshot';

/** The accepted state the board renders (spec §5.3.1). */
export interface BoardState {
    publicView: PublicGameView;
    /** Null until the first private frame (a public frame may show a read-only table before it). */
    privateView: PrivateGameView | null;
    /** Date.now() when this state was accepted, or when its clocks last changed. */
    receivedAt: number;
    /** The server's clock is Date.now() + skew: the largest serverNow − receivedAt among the last 10 accepted
     *  frames (the least-delayed sample); 0 without serverNow. */
    skew: number;
    source: ViewSource;
}

/** What the acceptance rule keeps between frames. One game per mount: it starts empty. */
export interface Accepted {
    state: BoardState | null;
    /** stateVersion of the last accepted private frame (null: none yet, or an older backend). */
    version: number | null;
    /** stateVersion of the last accepted public-only frame, before any private frame. */
    publicVersion: number | null;
    /** serverNow − receivedAt of the last 10 accepted frames: the skew samples. */
    samples: number[];
}

export const NOTHING_ACCEPTED: Accepted = { state: null, version: null, publicVersion: null, samples: [] };

/** How many recent frames the skew estimate looks at (spec §5.3.3 Countdown). */
export const SKEW_SAMPLES = 10;

export type Frame =
    | { kind: 'public'; view: PublicGameView }
    | { kind: 'private'; view: PrivateGameView; source: ViewSource };

const versionOf = (view: PublicGameView | undefined): number | null =>
    typeof view?.stateVersion === 'number' ? view.stateVersion : null;

function sampled(current: Accepted, view: PublicGameView, now: number): number[] {
    if (typeof view.serverNow !== 'number') return current.samples;
    return [...current.samples, view.serverNow - now].slice(-SKEW_SAMPLES);
}

const skewOf = (samples: readonly number[]): number => (samples.length ? Math.max(...samples) : 0);

const later = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : Math.max(a, b));

/**
 * A frame at the accepted version changes only the clocks (spec §5.3.1 rule 2a). A version's frames
 * come in any order, and its first (GSC) frame can carry a null or older deadline that its TS
 * re-broadcast corrects (game-data.md §8 #6), so: for the same player to act, the later of the two
 * deadlines wins and a null never replaces a value; in HAND_COMPLETE a set window replaces a null one;
 * serverNow only feeds the skew estimate. Nothing else changes and nothing animates.
 */
function mergeClocks(current: Accepted, view: PublicGameView, now: number): Accepted {
    const state = current.state!;
    const old = state.publicView;
    const samples = sampled(current, view, now);
    const skew = skewOf(samples);
    const turnExpiresAt = view.currentPlayerId === old.currentPlayerId
        ? later(old.turnExpiresAt ?? null, view.turnExpiresAt ?? null)
        : old.turnExpiresAt;
    const challengeWindowExpiresAt = old.gameState === 'HAND_COMPLETE' && old.challengeWindowExpiresAt == null
        ? view.challengeWindowExpiresAt ?? null
        : old.challengeWindowExpiresAt;
    const clocksMoved = turnExpiresAt !== old.turnExpiresAt || challengeWindowExpiresAt !== old.challengeWindowExpiresAt;
    if (!clocksMoved && skew === state.skew) return samples === current.samples ? current : { ...current, samples };
    const publicView = clocksMoved ? { ...old, turnExpiresAt, challengeWindowExpiresAt } : old;
    return { ...current, samples, state: { ...state, publicView, receivedAt: clocksMoved ? now : state.receivedAt, skew, source: 'live' } };
}

/**
 * The acceptance rule (spec §5.3.1). A frame that changes nothing the board shows keeps `state` the
 * same object, so a duplicate never re-renders.
 * - Private frames carry the whole state (their `publicPart` is a full public view). With
 *   stateVersion, against the accepted version: newer is accepted; the same version merges only the
 *   clocks (rule 2a); older is dropped. Snapshots follow the same rule, so a live frame newer than a
 *   late snapshot wins (the server's counter never goes backwards).
 * - Once a private frame has been seen, versioned public-only frames are ignored: the server sends
 *   the public frame first at the same version, and it must not shadow the private frame.
 * - Without stateVersion (an older backend) every frame is accepted as before: a private frame
 *   sets both parts, a public frame replaces the public part.
 */
export function acceptFrame(current: Accepted, frame: Frame, now: number): Accepted {
    if (frame.kind === 'public') {
        const version = versionOf(frame.view);
        const privateView = current.state?.privateView ?? null;
        if (version === null) {
            const samples = sampled(current, frame.view, now);
            return { ...current, samples, state: { publicView: frame.view, privateView, receivedAt: now, skew: skewOf(samples), source: 'live' } };
        }
        if (privateView) return current;
        if (current.publicVersion !== null && version < current.publicVersion) return current;
        if (current.publicVersion !== null && version === current.publicVersion) return mergeClocks(current, frame.view, now);
        const samples = sampled(current, frame.view, now);
        return {
            ...current,
            samples,
            state: { publicView: frame.view, privateView: null, receivedAt: now, skew: skewOf(samples), source: 'live' },
            publicVersion: version,
        };
    }
    const version = versionOf(frame.view.publicPart);
    if (version === null || current.version === null || version > current.version) {
        const samples = sampled(current, frame.view.publicPart, now);
        return {
            ...current,
            samples,
            state: { publicView: frame.view.publicPart, privateView: frame.view, receivedAt: now, skew: skewOf(samples), source: frame.source },
            version,
        };
    }
    if (version === current.version) return mergeClocks(current, frame.view.publicPart, now);
    return current;
}
