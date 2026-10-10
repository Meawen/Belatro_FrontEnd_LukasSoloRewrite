// Phase 4's scenes: the board (spec §5, §5.6) through /dev/board (spec §4.17), at both phone
// orientations and the desktop, Effects Off and every animation skipped (MotionGlobalConfig).
// The scene format is documented at the top of e2e/visual.mjs. The dev board needs no sign-in and
// no API: its fixture table (Phase 3) feeds the real board, frame by frame.

const SIZES = ['375x812', '812x375', '1440x900'];
/** carol (team A) at the table; `at` jumps to that fan-out of the table as a snapshot. */
const board = (at, extra = '') => `/dev/board?controls=0&skip=1&effects=off&seat=carol&at=${at}${extra}`;

export default [
    // bidding: my turn after two passes, the bid panel up, the dealer chip on dave
    { name: 'board-bidding', path: board('bid:bob:PASS'), viewports: SIZES },
    // mid-trick: two cards down, my turn to play, the countdown on my seat
    { name: 'board-mid-trick', path: board('play:bob:PIK-BABA'), viewports: SIZES },
    // the hand result: the window open, Challenge in the sheet, Bela Blok's first row on desktops
    { name: 'board-hand-result', path: board('window-open'), viewports: SIZES },
    // the end: the deciding hand played out, Play again with the votes, Match details
    { name: 'board-end', path: board('game-over', '&scores=990,900'), viewports: SIZES },
];
