import type { PlayerRank, RatingHistory } from '../../types/user';
import { PLACEMENT_GAMES } from './rankNames';

/** The forecast's length in games (primer decision 2: kept short, luck swamps it). */
export const FORECAST_GAMES = 20;

/** Past this many games "in about n games" becomes "more than 100 games away". */
const FAR_GAMES = 100;

export interface ForecastLines {
    /** The line under the chart as [before, the rank name in bold ('' for none), after]; null for no line. */
    primary: [string, string, string] | null;
    /** "Luck alone can move you about ±{n} points over 20 games."; null when no forecast is drawn. */
    luck: string | null;
}

const games = (n: number) => (n === 1 ? '1 game' : `${n} games`);
const wins = (n: number) => (n === 1 ? '1 more win than losses' : `${n} more wins than losses`);

/**
 * The texts under your climb (ranks spec §8.4, primer decision 2). They say "about", never promise a rank and
 * never shame a drop. `nextName` is the next rank's name from the ladder (R-3); without it, "the next rank".
 */
export function forecastLines(history: RatingHistory, rank: PlayerRank | null | undefined, nextName: string | null): ForecastLines {
    const { rating, pace, step } = history;
    const luck = pace === null ? null : `Luck alone can move you about ±${Math.round(step * Math.sqrt(FORECAST_GAMES))} points over ${FORECAST_GAMES} games.`;
    if (!rank) return { primary: null, luck };
    if (rank.key === 'CUCEK' || pace === null) {
        const primary: ForecastLines['primary'] = rank.key === 'CUCEK' ? [`Placement: ${history.rankedGamesPlayed} of ${PLACEMENT_GAMES} ranked games`, '', ''] : null;
        return { primary, luck };
    }
    if (rank.nextMinRating === null) return { primary: [`${rank.name}: the top rank.`, '', ''], luck };

    const next = nextName ?? 'the next rank';
    const gap = rank.nextMinRating - rating;
    // the history can be fresher than the profile: already there, say nothing rather than "in about 0 games"
    if (gap <= 0) return { primary: null, luck };
    if (pace > 0) {
        const n = Math.ceil(gap / pace);
        return { primary: n > FAR_GAMES ? [`${next} is more than ${FAR_GAMES} games away at this pace.`, '', ''] : ['At this pace: ', next, ` in about ${games(n)}`], luck };
    }
    return { primary: [`${gap} points to `, next, `: about ${wins(Math.ceil(gap / step))}.`], luck };
}
