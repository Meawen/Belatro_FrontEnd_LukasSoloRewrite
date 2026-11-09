// Phase 4's scenes: the board (spec §5, §5.6) through /dev/board (spec §4.17), at both phone
// orientations and the desktop, Effects Off and every animation skipped (MotionGlobalConfig).
// The scene format is documented at the top of e2e/visual.mjs. The dev board needs no sign-in and
// no API: its fixture table (Phase 3) feeds the real board, frame by frame.
// Board fit (board-fit spec §7): the same scenes again at real browser windows, Safari's bars taken off, at their
// real densities. The board picks its card sizes from the window and its dpr, and a scene has one dpr, so each scene
// comes once per density: its own name at the harness's default (phones 2×, the rest 1×), "-3x" and "-1.25x" at those.

const SIZES = ['375x812', '812x375', '1440x900'];
/** An iPhone SE upright in Safari (2×); laptops at 1×. */
const REAL = ['375x553', '960x980', '1366x641'];
/** An iPhone 14 in Safari upright and sideways (3×); a laptop with Windows at 125 %. */
const DENSER = [
    { suffix: '-3x', dpr: 3, viewports: ['390x664', '844x340'] },
    { suffix: '-1.25x', dpr: 1.25, viewports: ['1536x730'] },
];
/** carol (team A) at the table; `at` jumps to that fan-out of the table as a snapshot. */
const board = (at, extra = '') => `/dev/board?controls=0&skip=1&effects=off&seat=carol&at=${at}${extra}`;
/**
 * Every tag column at its biggest: every seat named by 20 characters, with its Bela and "No challenge" badges
 * (busy=1), and carol, my partner, showing her six declared cards (seed 1254) as the first card goes down.
 */
const BUSY = '/dev/board?controls=0&skip=1&effects=off&seat=alice&seed=1254&names=long&busy=1&at=play:';

const SCENES = [
    // bidding: my turn after two passes, the bid panel up, the dealer chip on dave
    { name: 'board-bidding', path: board('bid:bob:PASS') },
    // mid-trick: two cards down, my turn to play, the countdown on my seat
    { name: 'board-mid-trick', path: board('play:bob:PIK-BABA') },
    // the hand result: the window open, Challenge in the sheet, Bela Blok's first row on desktops
    { name: 'board-hand-result', path: board('window-open') },
    // the end: the deciding hand played out, Play again with the votes, Match details
    { name: 'board-end', path: board('game-over', '&scores=990,900') },
];

export default [
    ...SCENES.flatMap((scene) => [
        { ...scene, viewports: [...SIZES, ...REAL] },
        ...DENSER.map(({ suffix, dpr, viewports }) => ({ ...scene, name: `${scene.name}${suffix}`, viewports, dpr })),
    ]),
    // the biggest columns in the tightest windows: an iPhone SE sideways (2×) and an iPhone 14 upright (3×)
    { name: 'board-busy', path: BUSY, viewports: ['667x323'] },
    { name: 'board-busy-3x', path: BUSY, viewports: ['390x664'], dpr: 3 },
];
