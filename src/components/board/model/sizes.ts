import { ART_H, ART_W } from '../../ui/cardWidth';
import { cardSize, type Size } from './cardTargets';

/** A desktop table's two card sizes (board-fit spec §3.3). */
export interface SizePair {
    trick: Size;
    hand: Size;
}

/** A width this close to a bound counts as on it: bounds come rounded (94.67 for 94.666…). */
const WIDTH_SLACK = 0.01;
/** Ratios this close count as equal: floating point makes 284 / 213 = 1.3333… */
const RATIO_SLACK = 1e-6;
/** The biggest phone card (spec §3.2) and the biggest desktop trick: three art sizes on a 1× screen (§3.3). */
const PHONE_MAX = 107;
const TRICK_MAX = 3 * ART_W;
/** The hand about 1.5× the trick: 1.33–1.67× first, else anything from 1× to 2× (§3.3). */
const RATIO = { aim: 1.5, low: 1.33, high: 1.67, max: 2 };

/** Every crisp card (71·s/dpr wide for a whole s ≥ 1, spec §3.1) from `minW` to `maxW` CSS px wide, smallest first. */
export function crispSteps(dpr: number, minW: number, maxW: number): Size[] {
    const steps: Size[] = [];
    for (let s = 1; (ART_W * s) / dpr <= maxW + WIDTH_SLACK; s++) {
        const size = { w: (ART_W * s) / dpr, h: (ART_H * s) / dpr };
        if (size.w >= minW - WIDTH_SLACK) steps.push(size);
    }
    return steps;
}

/** The phone sizes to try (§3.2), biggest first: every step up to 107 px, down to today's step nearest 71. */
export function phoneCandidates(dpr: number): Size[] {
    const floor = cardSize(ART_W, dpr);
    return crispSteps(dpr, floor.w, Math.max(floor.w, PHONE_MAX)).reverse();
}

/**
 * The desktop pairs to try (§3.3), first choice first: the pairs with the hand 1.33–1.67× the trick, then the
 * rest from 1× to 2×. Within each, the biggest trick first, then the hand nearest 1.5×; a tie goes to the smaller
 * hand in the band (so 2560×1300 @1 gets 213/284, not 213/355) and to the bigger one in the rest.
 */
export function desktopCandidates(dpr: number): SizePair[] {
    const floor = cardSize(ART_W, dpr);
    return inOrder(crispSteps(dpr, floor.w, Math.max(floor.w, TRICK_MAX)).flatMap((trick) => pairsFor(trick, dpr)));
}

/**
 * When no pair fits (§3.3): the floor trick (today's step nearest 71) with the hand `desktopCandidates` would try
 * first for it, an in-band hand before the rest (so 71/94.67 at dpr 3, 71/142 at dpr 1).
 */
export function floorPair(dpr: number): SizePair {
    return inOrder(pairsFor(cardSize(ART_W, dpr), dpr))[0];
}

/** The trick with every crisp hand from its own width to twice it. */
function pairsFor(trick: Size, dpr: number): SizePair[] {
    return crispSteps(dpr, trick.w, RATIO.max * trick.w).map((hand) => ({ trick, hand }));
}

/** The in-band pairs first (a tie to the smaller hand), then the rest (a tie to the bigger hand). */
function inOrder(pairs: SizePair[]): SizePair[] {
    const band = pairs.filter(inBand).sort(preferring('smaller'));
    const rest = pairs.filter((pair) => !inBand(pair)).sort(preferring('bigger'));
    return [...band, ...rest];
}

const ratioOf = ({ trick, hand }: SizePair) => hand.w / trick.w;
const offAim = (pair: SizePair) => Math.abs(ratioOf(pair) - RATIO.aim);
const inBand = (pair: SizePair) => ratioOf(pair) >= RATIO.low - RATIO_SLACK && ratioOf(pair) <= RATIO.high + RATIO_SLACK;

/** Biggest trick first, then the hand nearest 1.5×, then on a tie the `tie` hand. */
function preferring(tie: 'smaller' | 'bigger') {
    return (a: SizePair, b: SizePair): number => {
        if (a.trick.w !== b.trick.w) return b.trick.w - a.trick.w;
        const nearer = offAim(a) - offAim(b);
        if (Math.abs(nearer) > RATIO_SLACK) return nearer;
        return tie === 'smaller' ? a.hand.w - b.hand.w : b.hand.w - a.hand.w;
    };
}
