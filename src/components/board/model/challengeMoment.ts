import type { Team } from './boardModel';
import type { LastChallengeView } from '../../../types/game';

/** The banner says who challenged this long (gameplay rules §6)… */
export const WHO_MS = 1200;
/** …then the outcome this long, then it is gone. */
export const OUTCOME_MS = 2000;

/** A challenge as the table says it: `name` is the board's name for the challenger (seatName: "You" for me). */
export interface ChallengeSaid {
    name: string;
    mine: boolean;
    /** The challenger's team: the team that takes the hand when a foul is found. */
    team: Team;
    foulFound: boolean;
}

export interface ChallengeStep {
    step: 'who' | 'outcome' | 'done';
    /** What the banner says now; null once done. */
    text: string | null;
}

const whoLine = ({ name, mine }: ChallengeSaid) => (mine ? `${name} challenge!` : `${name} challenges!`);

const foulLine = (team: Team) => `Foul found: Team ${team} takes the hand`;

const outcomeLine = (said: ChallengeSaid) => (said.foulFound
    ? foulLine(said.team)
    : `No foul: ${said.mine ? 'you have' : `${said.name} has`} no challenge left`);

/** The banner `elapsed` ms after it started: "Ivo challenges!", then "Foul found: Team B takes the hand" or "No foul: …". */
export function challengeAt(said: ChallengeSaid, elapsed: number): ChallengeStep {
    if (elapsed < WHO_MS) return { step: 'who', text: whoLine(said) };
    if (elapsed < WHO_MS + OUTCOME_MS) return { step: 'outcome', text: outcomeLine(said) };
    return { step: 'done', text: null };
}

/** The banner's words for the live region, both steps in one line: "Ivo challenges! No foul: Ivo has no challenge left". */
export function challengeSrLine(said: ChallengeSaid): string {
    return `${whoLine(said)} ${outcomeLine(said)}`;
}

/** The hand-result sheet's header for a hand a right challenge decided ("Foul found: Team B takes the hand"); else null. */
export function challengeHeader(last: LastChallengeView | null): string | null {
    return last?.thisHand && last.foulFound ? foulLine(last.team) : null;
}
