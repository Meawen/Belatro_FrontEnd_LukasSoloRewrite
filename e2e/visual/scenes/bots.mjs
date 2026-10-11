// Bots in a casual lobby (casual bots spec §7): the host's "+ Bot" chips and "Fill with bots", a bot's seat, the host's
// hint, and the remove sheet for a bot; the lobby list's count of people and bots, and the board's robot mark. The
// scene format is documented at the top of e2e/visual.mjs. The fixtures leave `createdAt` null, so no shot depends on
// the clock.

const MIRA = { id: 'u9', username: 'mira_z' };
const IVO = { id: 'u3', username: 'ivo' };
const BOT_ANA = { id: 'b1', username: 'Bot-Ana', bot: true };
const BOT_TIN = { id: 'b2', username: 'Bot-Tin', bot: true };
const BOT_NIKA = { id: 'b3', username: 'Bot-Nika', bot: true };
const BOT_LUKA = { id: 'b4', username: 'Bot-Luka', bot: true };
const BOT_MARA = { id: 'b5', username: 'Bot-Mara', bot: true };
const BOT_TOMO = { id: 'b6', username: 'Bot-Tomo', bot: true };
const TEA = { id: 'u4', username: 'tea_r' };
const BOTH = ['1440x900', '375x812'];

/** The shell's own questions for a verified player who is in no game. */
function signedIn(user) {
    return {
        'GET /user/me': {
            json: {
                id: user.id, username: user.username, email: `${user.username}@example.test`, pendingEmail: null,
                emailVerified: true, roles: ['ROLE_USER'], deletionRequested: false,
            },
        },
        'GET /user/me/active-game': { status: 204 },
    };
}

/** GET /lobbies/b1 answers this public casual lobby, hosted by mira_z. */
function lobby(teams) {
    return {
        'GET /lobbies/b1': {
            json: {
                id: 'b1', name: 'Kod Mire', gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: MIRA,
                teamAPlayers: [], teamBPlayers: [], unassignedPlayers: [], privateLobby: false, password: null,
                ...teams,
            },
        },
    };
}

/** Taps Bot-Ana's seat and waits for the remove sheet. */
async function openRemove(page) {
    await page.getByRole('button', { name: 'Bot-Ana, team A, bot' }).click();
    await page.getByRole('dialog', { name: 'Remove Bot-Ana?' }).waitFor();
}

/** Taps Team A's "+ Bot" with the request held open: the seat reads what is happening. */
async function addingABot(page) {
    await page.route('**/backend/lobbies/b1/bots', () => {});
    await page.getByRole('button', { name: 'Add a bot to team A' }).click();
    await page.locator('[aria-busy="true"]').first().waitFor();
}

const twoBots = lobby({ teamAPlayers: [MIRA, BOT_ANA], teamBPlayers: [BOT_TIN] });

/** An open casual lobby for GET /lobbies/open. */
function listed(id, name, host, teams) {
    return {
        id, name, gameMode: 'CASUAL', status: 'WAITING', createdAt: null, hostUser: host,
        teamAPlayers: [], teamBPlayers: [], unassignedPlayers: [], privateLobby: false, password: null, ...teams,
    };
}

/** The open list as tea_r sees it: a host with three bots, two people and a bot, four people, and her own with two bots. */
const openLobbies = {
    'GET /lobbies/open': {
        json: [
            listed('b1', 'Kod Mire', MIRA, { teamAPlayers: [MIRA, BOT_ANA], teamBPlayers: [BOT_TIN, BOT_NIKA] }),
            listed('b2', 'Petak u pet', { id: 'u5', username: 'dino' }, {
                teamAPlayers: [{ id: 'u5', username: 'dino' }, { id: 'u6', username: 'iva' }], teamBPlayers: [BOT_LUKA], privateLobby: true,
            }),
            listed('b3', 'Subotnja', { id: 'u7', username: 'marko' }, {
                teamAPlayers: [{ id: 'u7', username: 'marko' }, { id: 'u8', username: 'petra' }],
                teamBPlayers: [{ id: 'u10', username: 'tomo' }], unassignedPlayers: [{ id: 'u11', username: 'lana' }],
            }),
            listed('b4', 'Bela kod Tee', TEA, { teamAPlayers: [TEA, BOT_MARA], teamBPlayers: [BOT_TOMO] }),
        ],
    },
};

/** Taps the row "Kod Mire" and waits for its quick-look. */
async function openQuickLook(page) {
    await page.getByRole('button', { name: /^Kod Mire, host mira_z/ }).click();
    await page.getByRole('dialog', { name: 'Kod Mire' }).waitFor();
}

/** The dev board (spec §4.17) for carol, with bob (on her left) and dave (on her right) as bots; `at` jumps there. */
const botBoard = (at) => `/dev/board?controls=0&skip=1&effects=off&seat=carol&bots=bob,dave&at=${at}`;

export default [
    // the host alone: a "+ Bot" chip on each of the three empty seats, and "Fill with bots" beside Start match
    { name: 'bots-host-alone', path: '/lobby/b1', viewports: BOTH, user: MIRA, api: [signedIn(MIRA), lobby({ teamAPlayers: [MIRA] })] },
    // a bot on its way: the tapped seat is busy and says so, the other chips are dimmed
    { name: 'bots-adding', path: '/lobby/b1', viewports: BOTH, user: MIRA, api: [signedIn(MIRA), lobby({ teamAPlayers: [MIRA] })], setup: addingABot },
    // the host with two bots: robots on their seats, one chip left, the host's hint under the table
    { name: 'bots-host-two-bots', path: '/lobby/b1', viewports: BOTH, user: MIRA, api: [signedIn(MIRA), twoBots] },
    // the host's tap on a bot: "Remove Bot-Ana?"
    { name: 'bots-remove', path: '/lobby/b1', viewports: BOTH, user: MIRA, api: [signedIn(MIRA), twoBots], setup: openRemove },
    // the host standing, every seat empty: four chips, the bottom seat's beside its name plate
    { name: 'bots-host-standing', path: '/lobby/b1', viewports: BOTH, user: MIRA, api: [signedIn(MIRA), lobby({ unassignedPlayers: [MIRA] })] },
    // a member's view of a bot: the robot and "Bot", no chips, no Fill
    {
        name: 'bots-member', path: '/lobby/b1', viewports: BOTH, user: IVO,
        api: [signedIn(IVO), lobby({ teamAPlayers: [MIRA, BOT_ANA], teamBPlayers: [IVO] })],
    },
    // the list counts people, then bots ("1 of 4 · 3 bots"); a bot's seat square is an outline with a dot; Full is four people
    { name: 'bots-list', path: '/lobbies', viewports: BOTH, user: TEA, api: [signedIn(TEA), openLobbies] },
    // the quick-look of a host with three bots: the mini table's robots, and "Join lobby" enabled
    { name: 'bots-quicklook', path: '/lobbies', viewports: BOTH, user: TEA, api: [signedIn(TEA), openLobbies], setup: openQuickLook },
    // the board with two bots: bob (left) to bid, his robot on the accent chip with the countdown; dave (right) the dealer
    { name: 'bots-board', path: botBoard('bid:alice:PASS'), viewports: ['375x812', '812x375', '1440x900'] },
];
