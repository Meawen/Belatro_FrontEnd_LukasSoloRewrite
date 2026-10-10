// Phase 7's Ranked scenes (spec §4.5): /play with the socket down, connecting, connected, queued, and the
// Match found sheet. The scene format is documented at the top of e2e/visual.mjs.
//
// The harness closes the game socket, so /play first shows the socket down (R-30). The other scenes then
// stand in for the server: they answer SockJS's /ws/info and its websocket on the page (page routes win over
// the harness's context routes), speak just enough STOMP (CONNECTED; a MESSAGE per subscribed destination
// that has a frame), and press the banner's Retry.

const PLAYER = { id: 'u1', username: 'ana_k' };
const BOTH = ['1440x900', '375x812'];
const STATUS = '/user/queue/ranked/status';
const MATCH_FOUND = '/user/queue/match-found';

const IN_QUEUE = { state: 'IN_QUEUE', estWaitSeconds: 45, queueSize: 3, mmr: 1234 };
const MATCH = {
    id: '6ad0a1b2c3d4e5f607182930',
    teamA: [{ id: 'u1', username: 'ana_k' }, { id: 'u4', username: 'dino_p' }],
    teamB: [{ id: 'u2', username: 'mira_z' }, { id: 'u3', username: 'luka_m' }],
    originLobby: null, gameMode: 'RANKED', result: null, startTime: null, endTime: null,
};

/** Parses one STOMP frame ("COMMAND\nkey:value…\n\nbody"). */
function parseFrame(text) {
    const [head] = text.split('\n\n');
    const [command, ...lines] = head.split('\n');
    const headers = Object.fromEntries(lines.map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)]));
    return { command, headers };
}

/** A fake game server on this page: `frames` maps a destination to the body it sends once subscribed. */
async function fakeServer(page, frames = {}) {
    await page.route('**/ws/info**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ websocket: true, origins: ['*:*'], cookie_needed: false, entropy: 1 }) }),
    );
    await page.routeWebSocket(/\/ws\/.+\/websocket$/, (ws) => {
        const send = (frame) => ws.send(`a${JSON.stringify([frame])}`);
        let id = 0;
        ws.send('o');
        ws.onMessage((message) => {
            for (const raw of JSON.parse(message).join('').split('\0')) {
                const text = raw.replace(/^\n+/, '');
                if (!text) continue;
                const { command, headers } = parseFrame(text);
                if (command === 'CONNECT' || command === 'STOMP') send('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0');
                if (command === 'SUBSCRIBE' && frames[headers.destination]) {
                    id += 1;
                    const body = JSON.stringify(frames[headers.destination]);
                    send(`MESSAGE\ndestination:${headers.destination}\nsubscription:${headers.id}\nmessage-id:${id}\ncontent-type:application/json\n\n${body}\0`);
                }
            }
        });
    });
    await page.getByRole('button', { name: 'Retry' }).click();
}

/** The socket stays connecting: /ws/info never answers. */
async function connecting(page) {
    await page.route('**/ws/info**', () => {});
    await page.getByRole('button', { name: 'Retry' }).click();
    await page.getByRole('button', { name: 'Connecting...' }).waitFor();
}

async function idle(page) {
    await fakeServer(page);
    await page.getByRole('button', { name: 'Find Match', disabled: false }).waitFor();
}

async function queued(page) {
    await fakeServer(page, { [STATUS]: IN_QUEUE });
    await page.getByRole('button', { name: 'Leave Queue' }).waitFor();
}

/** Back from a declined match (R-25): the table sends the other three here with the notice as router state. */
async function declined(page) {
    await fakeServer(page, { [STATUS]: IN_QUEUE });
    await page.getByRole('button', { name: 'Leave Queue' }).waitFor();
    await page.evaluate((notice) => {
        window.history.pushState({ usr: { notice }, key: 'declined', idx: 1 }, '', '/play');
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    }, "A player declined — you're back in the queue");
    await page.getByRole('region', { name: 'Match declined' }).waitFor();
}

async function matchFound(page) {
    await fakeServer(page, { [MATCH_FOUND]: MATCH });
    await page.getByRole('dialog', { name: 'Match found' }).waitFor();
}

export default [
    // the socket down: "Reconnecting…" + Retry on top, Find Match disabled (R-30)
    { name: 'ranked-offline', path: '/play', viewports: BOTH, user: PLAYER, api: ['player.json'] },
    // connecting: "Connecting..." on the button and the status line
    { name: 'ranked-connecting', path: '/play', viewports: BOTH, user: PLAYER, api: ['player.json'], setup: connecting },
    // connected: the calm panel, RANKED, "Find a match", Elo, Find Match
    { name: 'ranked-idle', path: '/play', viewports: BOTH, user: PLAYER, api: ['player.json'], setup: idle },
    // queued: Leave Queue, "Searching for a match", the squares and the three tiles
    { name: 'ranked-queued', path: '/play', viewports: BOTH, user: PLAYER, api: ['player.json'], setup: queued },
    // back from a declined match: the notice above the panel, still queued (R-25)
    { name: 'ranked-declined', path: '/play', viewports: ['375x812'], user: PLAYER, api: ['player.json'], setup: declined },
    // Match found: the full-screen sheet, both teams, you marked, the countdown, Accept Match focused
    { name: 'ranked-match-found', path: '/play', viewports: BOTH, user: PLAYER, api: ['player.json'], setup: matchFound },
];
