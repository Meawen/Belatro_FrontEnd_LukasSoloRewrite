import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { fadeKept, type Stage } from './stage';
import type { BoardModel } from './model/boardModel';
import type { Challenged } from './model/diffBoard';
import type { MatchHands } from '../../hooks/useMatchHands';

/** What the board shows that a challenge's outcome changes: the model, the hand's score change and the stored hands. */
export interface Shown {
    model: BoardModel;
    delta: Stage['handDelta'];
    hands: MatchHands | null | undefined;
}

/**
 * The banner as the board keeps it: when it started and in which deal, once it reached its outcome (`told`) and once
 * it is said (`done`); whether it holds the hand result back (it ended the hand); and what the board showed the step
 * before the challenge (`before`).
 */
interface BannerLocal {
    challenge: Challenged;
    since: number;
    deal: number;
    told: boolean;
    done: boolean;
    holdsResult: boolean;
    before: Shown;
}

export interface BannerState {
    /** The banner while it is up: its challenge and when it started. */
    banner: { challenge: Challenged; since: number } | null;
    /** ChallengeBanner's onOutcome: the outcome is said, so the board shows it. */
    told: () => void;
    /** ChallengeBanner's onDone: the banner is gone. */
    done: () => void;
    /** The hand result may rise: the last trick has left the table, and a right challenge that ended the hand is said. */
    resultOpen: boolean;
    /**
     * While the banner says who: the one frozen display, the step before the challenge (the HUD, the seats, Bela Blok,
     * an open hand result). Inputs act on the newest model; a frozen Challenge is disabled. Null otherwise.
     */
    frozen: Shown | null;
}

/** The step before, while `banner` says who in deal `deal`: not once told or done, nor past a new deal. */
const frozenOf = (banner: BannerLocal | null, deal: number): Shown | null =>
    (banner && !banner.told && !banner.done && banner.deal === deal ? banner.before : null);

/**
 * The challenge, out loud (gameplay rules §6, D-8): a live Challenged starts the banner, which the board unmounts once
 * said; a snap (a snapshot) never shows one, and ends one still up. For the banner's "who" step the board shows one
 * frozen copy of the step before (`frozen`), so nothing of the outcome shows before the banner says it: scores, the
 * phase, Challenge, the seat tags and countdowns, Bela Blok, an open hand result; a partial trick a right challenge
 * took off the table is kept on it (Stage.kept) and fades at the outcome. A right challenge that ended the hand holds
 * the hand result until the banner is done (who, then the outcome, then the sheet).
 *
 * `stage` is the step before (the Board's state before this render's step), `current` this render's; `now` is the
 * render's clock (Date.now()).
 */
export function useChallengeBanner(
    stage: Stage, current: Stage, hands: MatchHands | null | undefined, now: number, setStage: Dispatch<SetStateAction<Stage>>,
): BannerState {
    const [local, setLocal] = useState<BannerLocal | null>(null);
    const challenged = current.events?.find((event): event is Challenged => event.type === 'Challenged') ?? null;
    let banner = local;
    if (challenged && challenged.number !== local?.challenge.number) {
        // what the board showed: a banner still saying who keeps its own step before
        const before = frozenOf(local, stage.deal) ?? { model: stage.model!, delta: stage.handDelta, hands };
        const endedHand = current.events!.some((event) => event.type === 'HandCompleted');
        banner = { challenge: challenged, since: now, deal: current.deal, told: false, done: false, holdsResult: challenged.foulFound && endedHand, before };
        setLocal(banner);
    } else if (current.events === null && local && !local.done) {
        banner = { ...local, done: true };
        setLocal(banner);
    }
    // the outcome is said (or the banner is gone before it): the board shows the newest state, and a kept trick fades
    const told = useCallback(() => {
        setLocal((was) => (was && !was.told ? { ...was, told: true } : was));
        setStage(fadeKept);
    }, [setStage]);
    const done = useCallback(() => {
        setLocal((was) => (was && !was.done ? { ...was, done: true } : was));
        setStage(fadeKept);
    }, [setStage]);
    const up = banner && !banner.done ? banner : null;
    return {
        banner: up,
        told,
        done,
        resultOpen: current.model!.handComplete && current.held === null && !up?.holdsResult,
        frozen: frozenOf(up, current.deal),
    };
}
