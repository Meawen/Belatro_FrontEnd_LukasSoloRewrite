// Bots in a casual lobby (casual bots spec §7): the host's "+ Bot" chips and "Fill with bots", a bot's seat, the host's
// hint, and the remove sheet for a bot. The scene format is documented at the top of e2e/visual.mjs. The fixtures leave
// `createdAt` null, so no shot depends on the clock.

const MIRA = { id: 'u9', username: 'mira_z' };
const IVO = { id: 'u3', username: 'ivo' };
const BOT_ANA = { id: 'b1', username: 'Bot-Ana', bot: true };
const BOT_TIN = { id: 'b2', username: 'Bot-Tin', bot: true };
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
];
