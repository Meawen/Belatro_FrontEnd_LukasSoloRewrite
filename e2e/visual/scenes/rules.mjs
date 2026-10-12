// The gameplay rules' scenes (spec §6, §9): the declaration moment and the challenge said out loud, through
// /dev/board at both phone orientations and the desktop, Effects Off and every animation skipped. The scene
// format is documented at the top of e2e/visual.mjs.
//
// A jump (`at`) is a snapshot: the moment shows its end state, and no challenge is ever said. `live=1` draws the
// fan-out before `at`, then steps into it, so the board sees the change as a player would; `t` puts `at` that
// many ms in the past. The page's Date stands still (FROZEN_TIME) while timers run: a moment holds the step it
// opened on, a belot holds its end sheet back, and the challenge banner says who for 1.2 s, then its outcome:
// the outcome scenes wait for it.

const SIZES = ['375x812', '812x375', '1440x900'];
/** `seat` at the table; `at` jumps to that fan-out of the fixture table. */
const board = (at, extra = '', seat = 'carol') => `/dev/board?controls=0&skip=1&effects=off&seat=${seat}&at=${at}${extra}`;
/** Waits for the banner's outcome step, which comes 1.2 s after the challenge. */
const outcome = (text) => async (page) => {
    await page.locator('.board-banner__panel[data-step="outcome"]', { hasText: text }).waitFor();
};
// seed 1254: alice 20, bob 20, carol four Asovi and 20 (100 + 20), dave 20: Team A scores 140
const SAID = '&seed=1254';
// hand 1: bob's challenge after its second card is wrong, so it is gone for the game; hand 2, its second card
const SPENT = '&hands=2&challenge=bob:2:wrong';
const LATER = 'play:carol:PIK-BABA';

export default [
    // the trump call, as a snapshot: every seat said, the tied heights none (values differ), the winner line
    { name: 'rules-zvanja-said', path: board('call:', SAID), viewports: SIZES },
    // seed 113: alice and bob both 20 up to As; alice first in turn order: "alice was first: Team A scores 20"
    { name: 'rules-zvanja-tie', path: board('call:', '&seed=113'), viewports: SIZES },
    // live, 0.7 s in: alice and bob have said 20, carol and dave not yet
    { name: 'rules-zvanja-midway', path: board('call:', `${SAID}&live=1&t=700`), viewports: SIZES },
    // the first card, play open: the winners' declared cards by their seats (carol's six, alice's three), and their chips
    { name: 'rules-zvanja-closed', path: board('play:', SAID), viewports: SIZES },
    // rules-zvanja-said under reduced motion
    { name: 'rules-zvanja-reduced', path: board('call:', `${SAID}&motion=reduce`), viewports: SIZES },
    // a live belot: "Belot! bob holds all eight Pik" with the eight cards, the end sheet held back
    { name: 'rules-belot', path: board('call:', '&belot=bob:PIK&live=1'), viewports: SIZES },
    // bob's wrong challenge during play: "No foul: bob has no challenge left"; his seat's "No challenge" tag
    { name: 'rules-challenge-wrong', path: board('challenge:', '&challenge=bob:2:wrong&live=1'), viewports: SIZES, setup: outcome('No foul') },
    // dave's right challenge during play: "Foul found: Team B takes the hand", the hand result held until it is said
    { name: 'rules-challenge-right', path: board('challenge:', '&challenge=dave:2:right&live=1'), viewports: SIZES, setup: outcome('Foul found') },
    // dave's right challenge in the window: the hand result already open, the banner above it (S4's open item)
    { name: 'rules-challenge-window', path: board('challenge:', '&challenge=dave:window:right&live=1'), viewports: SIZES, setup: outcome('Foul found') },
    // a later hand: bob's "No challenge" tag, seen from carol's seat
    { name: 'rules-no-challenge', path: board(LATER, SPENT), viewports: SIZES },
    // the same, from bob's seat: his Challenge button greyed, reading "Challenge used"
    { name: 'rules-challenge-used', path: board(LATER, SPENT, 'bob'), viewports: SIZES },
    // the hand result after dave's right challenge: "Foul found: Team B takes the hand", Mi 0, Vi 182 incl. 20 zvanja
    { name: 'rules-handresult-foul', path: board('window-open', '&challenge=dave:2:right'), viewports: SIZES },
];
