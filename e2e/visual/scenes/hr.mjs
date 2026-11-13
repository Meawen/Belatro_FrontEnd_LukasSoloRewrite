// The open beta's Croatian scenes (open beta §1.1; plan R2): the site as a first visit sees it, at 375×812 and
// 1440×900. Every scene says `lang: 'hr'` (the harness seeds stiglja:lang with it; every other scene file is English).
// Most reuse another area's scene, its fixtures and its path, under an `hr-` name; the open beta's own pages (the
// landing page, Škola bele, the waitlist, a guest's locked page, a friend's table link) are new here. The scene format
// is documented at the top of e2e/visual.mjs. Selectors are the Croatian catalog's words (src/i18n/catalog/hr.ts).
import board from './board.mjs';
import bots from './bots.mjs';
import home from './home.mjs';
import lobby from './lobby.mjs';
import shell from './shell.mjs';

const BOTH = ['1440x900', '375x812'];
// a guest (POST /api/auth/guest stores user.guest true; the server names it gost_ and four digits)
const GUEST = { id: 'g1', username: 'gost_4821', guest: true };

/** GET /api/auth/signup-status (spec §2.2): open, or full (the waitlist). */
const signup = (open) => ({ 'GET /api/auth/signup-status': { json: { open } } });

/** Another area's scene in Croatian at both viewports, under its own name; `extra` overrides. */
function hr(scenes, from, name, extra = {}) {
    const scene = scenes.find((candidate) => candidate.name === from);
    if (!scene) throw new Error(`hr.mjs: no scene ${from}`);
    return { ...scene, name, viewports: BOTH, lang: 'hr', ...extra };
}

/** Škola bele: deals hand 1 and waits for its first lesson ("Licitacija") with Nastavi. */
async function firstLesson(page) {
    await page.getByRole('button', { name: 'Podijeli karte', exact: true }).click();
    await page.locator('[data-testid="lesson-panel"][data-lesson="dalje"]').waitFor();
    await page.getByRole('button', { name: 'Nastavi', exact: true }).waitFor();
}

const doma = home.find((scene) => scene.name === 'home');
// bots.mjs's host with two bots (her own answers, GET /user/me …, and the room's), reseated below
const twoBots = bots.find((scene) => scene.name === 'bots-host-two-bots');
const hostAnswers = twoBots.api.find((source) => source['GET /user/me']);
const room = twoBots.api.find((source) => source['GET /lobbies/b1'])['GET /lobbies/b1'].json;
const [mira] = room.teamAPlayers;
const [botTin] = room.teamBPlayers;

export default [
    // the landing page (spec §4): headline, the pixel table, the doors Škola bele / Botovi / Ljudi
    { name: 'hr-landing', path: '/', viewports: BOTH, lang: 'hr', user: null, api: [signup(true)] },
    // Doma (spec §5): the two halves, "Birtija (4)" from GET /lobbies/open, the stats and the recent matches
    hr(home, 'home', 'hr-doma', { api: [...doma.api, 'lobbies.json'] }),
    // Birtija: four tables (private, one with a member standing, a full one, ana_k's own)
    hr(lobby, 'lobby-list', 'hr-birtija'),
    // a table (the lobby room), seen by its host: both 104-px side seats are team B's bots ("Bot · Ekipa B"), her partner's
    // seat is open ("Slobodno mjesto", with "+ Bot"), Počni partiju disabled beside "Čekamo još 1 igrača."
    hr(bots, 'bots-host-two-bots', 'hr-table', {
        api: [hostAnswers, {
            'GET /lobbies/b1': { json: { ...room, teamAPlayers: [mira], teamBPlayers: [botTin, { id: 'b3', username: 'Bot-Nika', bot: true }] } },
        }],
    }),
    // the board mid-hand: two cards down, carol's turn
    hr(board, 'board-mid-trick', 'hr-board-mid-trick'),
    // a hand result with padanje, seen from dave's seat: with seed 1 dave (the dealer, who must call) and bob declare 70
    // and still fall, so alice and carol write 232 ("Pad! Pali ste.")
    {
        name: 'hr-hand-result-padanje',
        path: '/dev/board?controls=0&skip=1&effects=off&seat=dave&at=window-open&seed=1',
        viewports: BOTH,
        lang: 'hr',
    },
    // the end sheet: the deciding hand played out, Play again with the votes, Match details
    hr(board, 'board-end', 'hr-board-end'),
    // Škola bele (spec §7), hand 1's first lesson in the board's coach slot, signed out
    // (the deal reports its count; the page ignores every answer)
    {
        name: 'hr-guide-step', path: '/learn', viewports: BOTH, lang: 'hr', user: null,
        api: [{ 'POST /api/public/guide-events': { status: 204 } }], setup: firstLesson,
    },
    // the waitlist (spec §2.2): /signup while signup is full
    { name: 'hr-waitlist', path: '/signup', viewports: BOTH, lang: 'hr', user: null, api: [signup(false)], fullPage: true },
    // signup while open: no invite field
    { name: 'hr-signup', path: '/signup', viewports: BOTH, lang: 'hr', user: null, api: [signup(true)], fullPage: true },
    // a guest on a member's page (spec §3.3): Birtija's name, what it is, Registriraj se and the bot game
    {
        name: 'hr-needs-account',
        path: '/lobbies',
        viewports: BOTH,
        lang: 'hr',
        user: GUEST,
        api: [signup(true), {
            'GET /user/me': {
                json: {
                    id: GUEST.id, username: GUEST.username, email: null, pendingEmail: null, emailVerified: false, roles: ['ROLE_USER'],
                    deletionRequested: false, guest: true,
                },
            },
            'GET /user/me/active-game': { status: 204 },
        }],
    },
    // a friend's table link with no session (spec §3.2): ProtectedRoute sends /lobby/x to /login, the guest door first
    {
        name: 'hr-login-table-door',
        path: '/lobby/x',
        viewports: BOTH,
        lang: 'hr',
        user: null,
        setup: async (page) => {
            await page.getByRole('button', { name: 'Sjedni kao gost', exact: true }).waitFor();
        },
    },
    // Not found, signed out: the public frame with the language switch, the way to the landing page
    hr(shell, 'shell-404-signed-out', 'hr-404-signed-out'),
];
