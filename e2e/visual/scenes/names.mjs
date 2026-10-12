// Phase 10's scenes: the longest real names (Review focus). Every username here is 20 characters, the
// backend's maximum (^[A-Za-z0-9_]{3,20}$), in the widest letters (W, M, m, w) and a narrow one; the lobbies
// are named by 50 characters (the Create sheet's maximum) with Croatian letters, one without a space.
// The scenes reuse the other areas' fixtures with every name replaced, at both phone orientations, and are
// shot and baselined like any other. The `names` check (e2e/visual/checks/names.mjs) reads `longNames`:
// in these scenes nothing scrolls sideways, and no element showing one of those names lets it overflow.
import { readFileSync } from 'node:fs';
import lobby from './lobby.mjs';
import leaderboard from './leaderboard.mjs';
import matches from './matches.mjs';
import profile from './profile.mjs';
import shell from './shell.mjs';

/** Every name in the fixtures these scenes reuse, and the long one it becomes. */
export const LONG = {
    ana_k: 'WWWWWWWWWWWWWWWWWWWW',
    mira_z: 'MMMMMMMMMMMMMMMMMMMM',
    luka: 'mmmmmmmmmmmmmmmmmmmm',
    luka_m: 'mmmmmmmmmmmmmmmmmmmm',
    luka_p: 'mmmmmmmmmmmmmmmmmmmm',
    ivo: 'wwwwwwwwwwwwwwwwwwww',
    ivo_b: 'wwwwwwwwwwwwwwwwwwww',
    ivo_p: 'wwwwwwwwwwwwwwwwwwww',
    tea_r: 'WWWWWWWWWWWWWWWWWWW_',
    dino: 'MMMMMMMMMMMMMMMMMMM_',
    iva: 'mmmmmmmmmmmmmmmmmmm_',
    marko: 'WWWWWWWWWWMMMMMMMMMM',
    petra: 'MMMMMMMMMMWWWWWWWWWW',
    petra_v: 'MMMMMMMMMMWWWWWWWWWW',
    tomo: 'aaaaaaaaaaaaaaaaaaaa',
    tomislav_b: 'aaaaaaaaaaaaaaaaaaaa',
    lana: 'WMWMWMWMWMWMWMWMWMWM',
    dora_k: 'wmwmwmwmwmwmwmwmwmwm',
    zvone_r: 'W_W_W_W_W_W_W_W_W_W_',
    'Kod Mire': 'ŠĐČĆŽšđčćžŠĐČĆŽšđčćžŠĐČĆŽšđčćžŠĐČĆŽšđčćžŠĐČĆŽšđčćž',
    'Petak u pet': 'Šibenska čvarkuša, đuveč i žlica — Ćiro, Đuro, Žac',
};
const LONG_NAMES = [...new Set(Object.values(LONG))];
// the dev board's names=long (src/dev/devTable.ts LONG_NAMES)
const BOARD_NAMES = ['WWWWWWWWWWWWWWWWWWWW', 'MMMMMMMMMMMMMMMMMMMM', 'mmmmmmmmmmmmmmmmmmmm', 'aaaaaaaaaaaaaaaaaaaa'];
const PHONES = ['375x812', '812x375'];
const API = new URL('../fixtures/api/', import.meta.url);

/** `value` with every name of LONG replaced (as a whole JSON string). */
function renamed(value) {
    let text = JSON.stringify(value);
    for (const [from, to] of Object.entries(LONG)) text = text.split(JSON.stringify(from)).join(JSON.stringify(to));
    return JSON.parse(text);
}

/** Another area's scene with every name replaced, at both phone orientations. */
function long(scenes, from, name, extra = {}) {
    const scene = scenes.find((candidate) => candidate.name === from);
    if (!scene) throw new Error(`names.mjs: no scene ${from}`);
    return {
        ...scene,
        name,
        viewports: PHONES,
        user: scene.user ? renamed(scene.user) : scene.user,
        api: (scene.api ?? []).map((source) => renamed(typeof source === 'string' ? JSON.parse(readFileSync(new URL(source, API), 'utf8')) : source)),
        longNames: LONG_NAMES,
        ...extra,
    };
}

const board = (at, extra = {}) => ({
    path: `/dev/board?controls=0&skip=1&effects=off&seat=carol&names=long&at=${at}`,
    viewports: PHONES,
    longNames: BOARD_NAMES,
    ...extra,
});

export default [
    // the seat chips with the bid chips beside them, the dealer chip
    { name: 'names-board-bidding', ...board('bid:bob:PASS') },
    // mid-trick: the chips, the countdown on my seat
    { name: 'names-board-mid-trick', ...board('play:bob:PIK-BABA') },
    // the game menu's "This hand": the bids, by name
    {
        name: 'names-board-menu',
        ...board('play:bob:PIK-BABA', {
            setup: async (page) => {
                await page.getByRole('button', { name: 'Game menu' }).click();
                await page.getByRole('dialog', { name: 'Game menu' }).waitFor();
            },
        }),
    },
    // the list's rows (lobby names, hosts) and the quick-look's mini table
    long(lobby, 'lobby-list', 'names-lobbies'),
    long(lobby, 'lobby-list', 'names-lobby-quicklook', {
        setup: async (page) => {
            await page.getByRole('button', { name: new RegExp(`^${LONG['Kod Mire']}, host ${LONG.mira_z}`) }).click();
            await page.getByRole('dialog', { name: LONG['Kod Mire'] }).waitFor();
        },
    }),
    // the lobby's table, seen by its host: four seats, two of them long-named, the page title
    long(lobby, 'lobby-host', 'names-lobby'),
    // the leaderboard's rows, mine highlighted
    long(leaderboard, 'leaderboard', 'names-leaderboard'),
    // Match details with a hand open: the trick replay's player column headers, the teams
    long(matches, 'matches-details-hand', 'names-match-details', { fullPage: false }),
    // my profile: the name as the page title
    long(profile, profile[0].name, 'names-profile'),
    // the tab bar's More sheet, signed in as a long name
    long(shell, 'shell-more', 'names-more'),
];
