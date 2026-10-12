import { useEffect, useState } from 'react';
import { m } from 'motion/react';
import { fade, spring } from '../../motion/tokens';
import { OUTCOME_MS, WHO_MS, challengeAt } from './model/challengeMoment';
import { bannerSpot, type Layout } from './model/cardTargets';
import type { Challenged } from './model/diffBoard';

/** "Team B" on one line: when the banner wraps on a phone, the team's letter never starts a line alone. */
const keepTeam = (text: string) => text.replace(/\bTeam ([AB])\b/, 'Team\u00a0$1');

export interface ChallengeBannerProps {
    challenge: Challenged;
    /** The board's name for the challenger (seatName: "You" for me). */
    name: string;
    /** When the board saw the challenge (Date.now()): each step is read from the time since. */
    since: number;
    layout: Layout;
    /** The hand result is open (a right challenge in the window): on a short landscape screen the banner goes above it. */
    sheetOpen: boolean;
    reduced: boolean;
    /** The outcome step has started: an open hand result may now show it (D-8). */
    onOutcome: () => void;
    /** The outcome has been said: the board unmounts the banner. */
    onDone: () => void;
}

/**
 * The challenge, out loud (gameplay rules §6, D-5): on every screen, where the trick goes, "Ivo challenges!" for
 * 1.2 s, then the outcome for 2 s (challengeAt). It sits above the trick and below the sheets, and takes no taps
 * (`board-region`); where a docked hand result would cover it, under the HUD instead (bannerSpot). Its words are for
 * the eye; the live region says them once (announce). Each step pops in where it stands; under reduced motion it
 * only fades in, on the same timing.
 */
export function ChallengeBanner({ challenge, name, since, layout, sheetOpen, reduced, onOutcome, onDone }: ChallengeBannerProps) {
    const [now, setNow] = useState(() => Date.now());
    const said = challengeAt({ ...challenge, name }, now - since);
    const ends = said.step === 'who' ? since + WHO_MS : said.step === 'outcome' ? since + WHO_MS + OUTCOME_MS : null;
    useEffect(() => {
        if (ends === null) {
            onDone();
            return;
        }
        // no frame comes when a step ends: wake then, never short of it
        const timer = window.setTimeout(() => setNow(Math.max(Date.now(), ends)), Math.max(0, ends - Date.now()));
        return () => window.clearTimeout(timer);
    }, [ends, onDone]);
    useEffect(() => {
        if (said.step === 'outcome') onOutcome();
    }, [said.step, onOutcome]);
    if (said.step === 'done') return null;
    const spot = bannerSpot(layout, sheetOpen);
    return (
        <div className="board-region board-banner" aria-hidden="true">
            <m.p
                key={said.step}
                className="board-banner__panel notch-6 t-callout font-semibold"
                data-step={said.step}
                data-foul={challenge.foulFound || undefined}
                data-place={spot.top ? 'top' : undefined}
                style={{ left: spot.x, top: spot.y }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduced ? fade : spring.quick}
            >
                {keepTeam(said.text!)}
            </m.p>
        </div>
    );
}
