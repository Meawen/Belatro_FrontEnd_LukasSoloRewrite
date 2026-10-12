#!/usr/bin/env node
// Four-seat release-gate harness through the real SPA (spec R-44, plus the rig checks of R-10,
// R-28, R-30, R-37 and R-45), on the redesigned SPA (UI-redesign spec §7.4).
//
// Four isolated browser contexts sign up with the invite code and optionally confirm their
// email address from the mail in Mailpit; the fourth seat then signs out and in again through
// the login form. Each tab checks that /play opens exactly one STOMP socket. The host creates the
// lobby ("Create lobby", then the sheet's "Create") and lands in it, seated in Team A. Each guest
// opens the lobby's row on /lobbies, presses the quick-look's "Join lobby" and lands in the lobby,
// then sits down: guest 1 at "Sit here, team A", guests 2 and 3 at the first "Sit here, team B",
// each waiting until its own seat ("{username} (you), team A|B") shows and no seat is busy. The
// host presses "Start match"; the three guests are never sent to /game by URL: they follow the
// host's start through the lobby poll, and their tables must render.
// Hand 1 opens with a Pass and a Herc call, both clicked in the UI (a turn-timer auto-move would
// add a bid no click made). From then on the game is played to its end by clicking: each later
// hand's first bidder calls Herc, and the seat on turn clicks its first playable card at the
// point (10, 30) of the card's own face, inside the strip the fan leaves exposed. A card
// may be illegal: the backend books it as a foul, and nobody ever presses Challenge. A bela
// prompt is answered with a plain Play, and the 10-s post-hand window is waited out. Every
// clicked card must leave the hand, and no card turn may go to the turn timer while its seat is
// playing it (after a restart, the first move may).
// At the end every seat must show the same winner and scores, the winner at 1001 or more and no
// end reason (forfeit, abandon, cancel), GET /matches/{id} must record the
// same result ("Team A wins 1001–650": Team A's score first, en dash or hyphen), GET
// /matches/{id}/structured-moves must hold every hand played with its 8 tricks, each with its
// winner (UI-redesign spec §6.3), and Match details (the /matches row linking to the game, then
// final-a and final-b) must show the same two numbers. The run also fails if any request or
// socket URL carries ?user=, or if a tab is sent to /login after the sign-ins.
//
// Needs the backend (local Docker Mongo/Redis/Mailpit, never the real .env), the SPA, and
// playwright-core 1.62.1 installed OUTSIDE this repo (it is not a project dependency):
//   npm i --prefix <dir> playwright-core@1.62.1
//   PLAYWRIGHT_CORE_DIR=<dir>/node_modules/playwright-core node e2e/gameplay.mjs
// Env: SPA_URL (default http://localhost:5173), API_URL (default http://localhost:8080),
// MAILPIT_URL (default http://localhost:8025), E2E_INVITE_CODE (the backend's
// SIGNUP_INVITE_CODE; unset leaves the field empty), HEADLESS=0 to watch, E2E_ARTIFACTS for
// failure screenshots. Modes, each off unless set:
//   E2E_CONFIRM_EMAIL=1   confirm every address from its mail, which must come from
//                         "Stiglja <no-reply@stiglja.com>", with a "Stiglja: " subject and a
//                         link to SPA_URL's origin.
//   E2E_SOCKJS_TRANSPORT=xhr-streaming   hide window.WebSocket so SockJS falls back: every game
//                         connection must be one /ws/<server>/<session>/xhr_streaming session.
//   E2E_RESTART_CMD=<cmd> a shell command that stops the backend, keeps it down, starts it and
//                         returns once it is up. It runs once hand 1's trump is called; every
//                         tab must reconnect by itself, without a reload, within 120 s, and the
//                         game goes on to its end.
//   E2E_EXPECT_RENEWAL=1  for a backend with a short JWT_EXPIRATION: every tab must renew its
//                         token (POST /user/me/token, never refused, a later-expiring token
//                         stored) and keep one open socket, and the game must outlive, from the
//                         last sign-in, a 3-minute token plus the 60-s socket sweep.
//   E2E_REMATCH=1         after the end all four press "Play again"; every tab must land on the
//                         same new /game/{id}, in Bidding, at 0:0.
//   E2E_VIEWPORT=375x812  every tab uses that viewport; /lobbies, the table and the end screen
//                         must not scroll sideways, and every click must reach its target.
//   E2E_LANDSCAPE_CHECK=1 with E2E_VIEWPORT (UI-redesign D-24): during hand 1 the tab on turn
//                         turns to 812x375, its table must take the landscape layout and not
//                         scroll sideways, it plays one card there, and it turns back.
//   E2E_RECORD_VIEWS=1    the view recorder (UI-redesign spec §4.17; never on in a gate run): the
//                         MESSAGE bodies seat 1's tab receives on /topic/games/*,
//                         /user/queue/games/* and /app/queue/games/*, without headers and without
//                         any sent frame (CONNECT carries the JWT), from its first game frame
//                         through hand 1, its window and hand 2's bidding (it stops at the first
//                         frame of hand 2's play). A passing run saves them as
//                         src/test/fixtures/views/recorded-<run>.json, never holding "Bearer" or "eyJ".
// The transport mode can't be combined with a restart, a renewal or a recorder run (their checks
// read WebSocket frames), nor a restart with a renewal run. Signup is rate limited per IP: start a
// fresh backend before every run. Any 429 is printed to stderr.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');

const SPA = process.env.SPA_URL ?? 'http://localhost:5173';
const API = (process.env.API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const INVITE_CODE = process.env.E2E_INVITE_CODE ?? '';
const CONFIRM_EMAIL = process.env.E2E_CONFIRM_EMAIL === '1';
const TRANSPORT = process.env.E2E_SOCKJS_TRANSPORT ?? '';
const XHR = TRANSPORT === 'xhr-streaming';
const RESTART_CMD = process.env.E2E_RESTART_CMD ?? '';
const EXPECT_RENEWAL = process.env.E2E_EXPECT_RENEWAL === '1';
const REMATCH = process.env.E2E_REMATCH === '1';
const VIEWPORT = parseViewport(process.env.E2E_VIEWPORT ?? '');
const LANDSCAPE_CHECK = process.env.E2E_LANDSCAPE_CHECK === '1';
const RECORD_VIEWS = process.env.E2E_RECORD_VIEWS === '1';
const ARTIFACTS = process.env.E2E_ARTIFACTS ?? join(tmpdir(), 'belatro-e2e');
// The SPA retries after 5, 10 and 20 s, then every 30 s: after a 60-s outage a tab may try
// again up to 30 s after the backend is back.
const RECONNECT_BUDGET_MS = 120000;
// E2E_RESTART_CMD: up to 15 s of graceful stop, 60 s down, then the start.
const COMMAND_TIMEOUT_MS = 240000;
// The longest the table may wait for a seat to act: the 10-s post-hand window, with slack.
const NEXT_MOVE_TIMEOUT_MS = 45000;
// A renewal run proves nothing unless it outlives a 3-minute token plus the 60-s socket sweep,
// counted from the last sign-in (the newest token the tabs started with).
const RENEWAL_MIN_RUN_MS = 4 * 60000;
// A quick game ends in under 3 minutes, so a renewal run waits this long before each card: even
// a five-hand game then outlives RENEWAL_MIN_RUN_MS, and a long one stays well under the 20
// renewals per hour each player is allowed.
const RENEWAL_PACE_MS = 1000;
// A game to 1001 takes about ten hands (~320 cards); far more means it isn't ending.
const MAX_PLAYS = 2000;
// A game played out ends once a team reaches this (BelotGame.TARGET_SCORE).
const TARGET_SCORE = 1001;
// The table's notice for a move made while its socket is down (spec R-30).
const NOT_SENT = 'Not sent — reconnecting';
// The phone held sideways (UI-redesign spec §5.6.2: the board's compact landscape layout).
const LANDSCAPE = { width: 812, height: 375 };
// Where a hand card is clicked (UI-redesign spec §7.4): this point of the card's own face lies in
// the strip the next card of the fan leaves exposed (at least 36 px wide).
export const CARD_POINT = { x: 10, y: 30 };
// The recorder's files (UI-redesign spec §4.17), and what it keeps: game frames only.
const FIXTURES = fileURLToPath(new URL('../src/test/fixtures/views/', import.meta.url));
export const RECORDING_FORMAT = 'stiglja-recorded-views/1';
const RECORDED_DESTINATIONS = [
    [/^\/topic\/games\/[^/]+$/, 'public'],
    [/^\/user\/queue\/games\/[^/]+$/, 'private'],
    [/^\/app\/queue\/games\/[^/]+$/, 'snapshot'],
];
const PASSWORD = 'e2e-password-123';
const RUN = Date.now().toString(36).slice(-5);
const PLAYERS = [1, 2, 3, 4].map((n) => `e2e${RUN}p${n}`);
// The table's phase words (spec R-31), for a build without data-phase; enum names pass through.
const PHASE = {
    Bidding: 'BIDDING',
    Playing: 'PLAYING',
    'Hand finished': 'HAND_COMPLETE',
    'Game over': 'COMPLETED',
    Cancelled: 'CANCELLED',
};
const XHR_STREAM_PATH = /^\/ws\/[^/]+\/([^/]+)\/xhr_streaming$/;

if (TRANSPORT && !XHR) usage(`E2E_SOCKJS_TRANSPORT supports only xhr-streaming, got "${TRANSPORT}"`);
if (XHR && (RESTART_CMD || EXPECT_RENEWAL)) {
    usage('E2E_SOCKJS_TRANSPORT=xhr-streaming cannot be combined with E2E_RESTART_CMD or E2E_EXPECT_RENEWAL');
}
if (RESTART_CMD && EXPECT_RENEWAL) usage('E2E_RESTART_CMD and E2E_EXPECT_RENEWAL are separate runs');
if (LANDSCAPE_CHECK && !VIEWPORT) usage('E2E_LANDSCAPE_CHECK=1 needs E2E_VIEWPORT, the size the tab turns back to');
if (XHR && RECORD_VIEWS) usage('E2E_RECORD_VIEWS=1 reads WebSocket frames: it cannot be combined with E2E_SOCKJS_TRANSPORT=xhr-streaming');

function usage(message) {
    console.error(message);
    process.exit(2);
}

function parseViewport(value) {
    if (!value) return null;
    const match = /^(\d+)x(\d+)$/.exec(value);
    if (!match) usage(`E2E_VIEWPORT must look like 375x812, got "${value}"`);
    return { width: Number(match[1]), height: Number(match[2]) };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const emailOf = (username) => `${username}@example.test`;
const gameIdOf = (page) => /^\/game\/([^/]+)$/.exec(new URL(page.url()).pathname)?.[1] ?? null;
const storedToken = (page) => page.evaluate(() => localStorage.getItem('authToken'));
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A JWT's exp in seconds, read without verifying (the backend does that); 0 when unreadable.
function expOf(token) {
    try {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp ?? 0;
    } catch {
        return 0;
    }
}

async function waitUntil(check, timeoutMs, what) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (await check()) return;
        if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs} ms: ${what}`);
        await sleep(250);
    }
}

// What the checks need to know about one tab: its game connections (WebSocket sessions, or
// xhr-streaming sessions in that mode), its token renewals and full page loads, and whether it
// was sent to /login once watchLogin is on.
function watch(page, label, leaks) {
    const seat = { sockets: [], websockets: 0, renewals: 0, renewalErrors: [], loads: 0, watchLogin: false, sawLogin: false };
    page.on('websocket', (ws) => {
        const url = ws.url();
        if (/[?&]user=/.test(url)) leaks.push(`${label} websocket ${url}`);
        // SockJS sessions live under /ws/<server>/<session>/websocket; Vite's HMR socket is "/".
        if (!new URL(url).pathname.startsWith('/ws/')) return;
        seat.websockets += 1;
        if (XHR) return;
        // When it connected, closed and first got this seat's game state, and how many
        // snapshot requests (/refresh) went out before that state arrived.
        const socket = { connectedAt: null, closedAt: null, refreshes: 0, firstStateAt: null, refreshesBeforeState: null };
        ws.on('framesent', ({ payload }) => {
            if (String(payload).includes('/refresh')) socket.refreshes += 1;
        });
        ws.on('framereceived', ({ payload }) => {
            const frame = String(payload);
            if (socket.connectedAt === null && frame.includes('["CONNECTED')) socket.connectedAt = Date.now();
            if (socket.firstStateAt === null && frame.includes('/queue/games/')) {
                socket.firstStateAt = Date.now();
                socket.refreshesBeforeState = socket.refreshes;
            }
        });
        ws.on('close', () => { socket.closedAt = Date.now(); });
        seat.sockets.push(socket);
    });
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (/[?&]user=/.test(request.url())) leaks.push(`${label} ${request.url()}`);
        // One SockJS session is one connection: the client re-opens the stream of the same
        // session whenever the server ends a long response, so sessions are counted, not requests.
        const stream = XHR ? XHR_STREAM_PATH.exec(url.pathname) : null;
        if (stream && !seat.sockets.some((socket) => socket.session === stream[1])) {
            seat.sockets.push({ session: stream[1], connectedAt: Date.now(), closedAt: null, refreshes: 0, firstStateAt: null, refreshesBeforeState: null });
        }
        if (request.method() === 'POST' && url.pathname.endsWith('/user/me/token')) seat.renewals += 1;
    });
    page.on('response', (response) => {
        if (response.status() === 429) console.error(`${label}: 429 Too Many Requests from ${response.url()}`);
        if (response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/user/me/token')
            && response.status() !== 200) {
            seat.renewalErrors.push(response.status());
        }
    });
    page.on('load', () => { seat.loads += 1; });
    page.on('framenavigated', (frame) => {
        if (seat.watchLogin && frame === page.mainFrame() && new URL(frame.url()).pathname === '/login') seat.sawLogin = true;
    });
    return seat;
}

// The STOMP MESSAGE frames inside one received SockJS frame ("a" + a JSON array of messages), each
// as { destination, body }. Open, heartbeat and close frames, and every other STOMP command, give
// nothing. Only the destination is read from the headers; nothing else of them is kept.
export function stompMessages(payload) {
    const text = String(payload);
    if (!text.startsWith('a[')) return [];
    let parts;
    try {
        parts = JSON.parse(text.slice(1));
    } catch {
        return [];
    }
    if (!Array.isArray(parts)) return [];
    return parts
        .flatMap((part) => String(part).split('\0'))
        .map((frame) => frame.replace(/^[\r\n]+/, ''))
        .filter((frame) => frame.startsWith('MESSAGE\n'))
        .map((frame) => {
            const end = frame.indexOf('\n\n');
            const head = (end < 0 ? frame : frame.slice(0, end)).split('\n');
            const destination = head.find((line) => line.startsWith('destination:'))?.slice('destination:'.length) ?? '';
            return { destination, body: end < 0 ? '' : frame.slice(end + 2) };
        });
}

// A MESSAGE on one of the recorded game destinations as { channel, body } with its JSON body
// parsed: public (/topic/games/{id}), private (/user/queue/games/{id}) or snapshot (the
// /app/queue/games/{id} answer). Anything else is null: the rematch topic, the error queue, the
// bare "DISCONNECT" string on the public topic.
export function recordedFrame({ destination, body }) {
    const match = RECORDED_DESTINATIONS.find(([pattern]) => pattern.test(destination));
    if (!match) return null;
    try {
        const parsed = JSON.parse(body);
        return parsed !== null && typeof parsed === 'object' ? { channel: match[1], body: parsed } : null;
    } catch {
        return null;
    }
}

export const newRecording = () => ({ frames: [], stage: 'hand 1', done: false, startedAt: null });

// Adds one frame, `at` ms after the first: hand 1, then its window (from the first HAND_COMPLETE
// frame), then hand 2's bidding (from the next BIDDING frame); hand 2's first PLAYING frame ends the
// recording and is not kept. Stale frames of an earlier stage never move it back.
export function record(recording, frame, at) {
    if (recording.done) return;
    const phase = (frame.channel === 'public' ? frame.body : frame.body.publicPart)?.gameState;
    if (recording.stage === 'hand 1' && phase === 'HAND_COMPLETE') recording.stage = 'window';
    else if (recording.stage === 'window' && phase === 'BIDDING') recording.stage = 'hand 2';
    else if (recording.stage === 'hand 2' && phase === 'PLAYING') {
        recording.done = true;
        return;
    }
    recording.frames.push({ channel: frame.channel, at, body: frame.body });
}

// The recording's seat: the views name players by username (the backend's player id), so `me` must be one of
// the first view's seat ids — never the Mongo id GET /user/me answers with.
export function recordedSeat(frames, me) {
    const first = frames[0]?.body;
    const view = first?.publicPart ?? first;
    const seats = [...(view?.teamA ?? []), ...(view?.teamB ?? [])].map((seat) => seat.id);
    if (!seats.includes(me)) throw new Error(`the recording's player ${me} is not a seat of game ${view?.gameId} (${seats.join(', ')})`);
    return me;
}

// The fixture file: one frame per line, so a diff of two recordings stays readable.
export function recordingText({ gameId, me, frames }) {
    const lines = frames.map((frame) => JSON.stringify(frame)).join(',\n');
    return `{"format":${JSON.stringify(RECORDING_FORMAT)},"gameId":${JSON.stringify(gameId)},"me":${JSON.stringify(me)},"frames":[\n${lines}\n]}\n`;
}

// The recorder on one tab: every WebSocket it opens, received frames only.
function recordViews(page) {
    const recording = newRecording();
    page.on('websocket', (ws) => {
        ws.on('framereceived', ({ payload }) => {
            for (const message of stompMessages(payload)) {
                const frame = recordedFrame(message);
                if (!frame) continue;
                recording.startedAt ??= Date.now();
                record(recording, frame, Date.now() - recording.startedAt);
            }
        });
    });
    return recording;
}

// Saves a finished recording for the dev board, for the seat of `username` (the views' player id).
function saveRecording(recording, username) {
    if (!recording.done) {
        throw new Error(`the recorder never reached hand 2's play (${recording.frames.length} frames, at ${recording.stage})`);
    }
    const first = recording.frames[0].body;
    const gameId = (first.publicPart ?? first).gameId;
    const me = recordedSeat(recording.frames, username);
    const text = recordingText({ gameId, me, frames: recording.frames });
    if (/Bearer|eyJ/.test(text)) throw new Error('the recording holds "Bearer" or "eyJ": nothing was written');
    mkdirSync(FIXTURES, { recursive: true });
    writeFileSync(join(FIXTURES, `recorded-${RUN}.json`), text);
    const channels = { public: 0, private: 0, snapshot: 0 };
    for (const { channel } of recording.frames) channels[channel] += 1;
    return { file: `src/test/fixtures/views/recorded-${RUN}.json`, gameId, frames: recording.frames.length, channels, bytes: Buffer.byteLength(text) };
}

async function signUp(page, username) {
    await page.goto(`${SPA}/signup`);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Email', { exact: true }).fill(emailOf(username));
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm Password', { exact: true }).fill(PASSWORD);
    if (INVITE_CODE) await page.locator('input[name="inviteCode"]').fill(INVITE_CODE);
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
    // From the email lane on, a "check your inbox" panel comes first.
    const proceed = page.getByRole('button', { name: 'Continue', exact: true });
    const refused = page.getByText('Invalid invite code').first();
    await waitUntil(async () => {
        if (await refused.isVisible().catch(() => false)) throw new Error(`signup refused: Invalid invite code (${username})`);
        return page.url().endsWith('/dashboard') || (await proceed.isVisible().catch(() => false));
    }, 15000, `${username} signed up`);
    if (!page.url().endsWith('/dashboard')) {
        await proceed.click();
        await page.waitForURL('**/dashboard', { timeout: 15000 });
    }
}

async function confirmationMailFor(address) {
    let found = null;
    await waitUntil(async () => {
        const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
        if (!search.ok) return false;
        const { messages = [] } = await search.json();
        for (const message of messages) {
            const full = await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
            const match = /https?:\/\/\S+\/confirm-email\?token=[A-Za-z0-9_-]+/.exec(full.Text ?? '');
            if (match) {
                found = { link: new URL(match[0]), from: full.From ?? {}, subject: full.Subject ?? '' };
                return true;
            }
        }
        return false;
    }, 30000, `confirmation mail for ${address}`);
    return found;
}

async function confirmEmail(page, username) {
    const { link, from, subject } = await confirmationMailFor(emailOf(username));
    // The rig runs with production's MAIL_FROM and APP_BASE_URL shape (spec R-39, R-4).
    if (from.Name !== 'Stiglja' || from.Address !== 'no-reply@stiglja.com') {
        throw new Error(`the mail to ${username} came from ${JSON.stringify(from)}, expected Stiglja <no-reply@stiglja.com>`);
    }
    if (!subject.startsWith('Stiglja: ')) throw new Error(`the mail to ${username} has the subject "${subject}", expected "Stiglja: …"`);
    if (link.origin !== new URL(SPA).origin) throw new Error(`the confirm link points at ${link.origin}, expected ${new URL(SPA).origin}`);
    await page.goto(`${SPA}${link.pathname}${link.search}`);
    await page.getByRole('button', { name: 'Confirm email address', exact: true }).click();
    await page.getByText('Your email address is confirmed.').waitFor({ timeout: 15000 });
}

// Signs the seat out locally and back in through the login form (spec R-28: login works across
// origins). The old token stays valid until it expires; nothing uses it again.
async function logInAgain(page, username) {
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${SPA}/login`);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
}

async function checkPlayPage(page, seat, label) {
    seat.sockets.length = 0;
    await page.goto(`${SPA}/play`);
    await page.getByText('RANKED', { exact: true }).waitFor({ timeout: 15000 });
    if (XHR && (await page.evaluate(() => typeof window.WebSocket)) !== 'undefined') {
        throw new Error(`${label}: window.WebSocket is still defined, so SockJS would not fall back`);
    }
    await sleep(3000);
    // A renewal on load reconnects with the new token, so in that mode only the open one counts.
    const counted = EXPECT_RENEWAL ? seat.sockets.filter((socket) => socket.closedAt === null) : seat.sockets;
    if (counted.length !== 1) {
        throw new Error(`${label}: /play ${EXPECT_RENEWAL ? 'holds' : 'opened'} ${counted.length} STOMP sockets, expected 1`);
    }
}

// R-37: nothing may scroll sideways at the phone viewport (or at `width`, for the landscape turn).
async function assertFits(pages, where, mobile, width = VIEWPORT?.width) {
    if (!VIEWPORT) return;
    const widths = await Promise.all(pages.map((page) => page.evaluate(() => document.documentElement.scrollWidth)));
    mobile[where] = widths;
    if (!widths.every((w) => w <= width)) {
        throw new Error(`${where}: content widths ${widths.join(',')} px exceed the ${width}-px viewport`);
    }
}

async function checkLobbiesFit(pages, mobile) {
    if (!VIEWPORT) return;
    await Promise.all(pages.map(async (page) => {
        await page.goto(`${SPA}/lobbies`);
        await page.getByRole('button', { name: 'Create lobby', exact: true }).waitFor({ timeout: 15000 });
    }));
    await assertFits(pages, 'lobbies', mobile);
}

async function formLobby(pages) {
    const [host, ...guests] = pages;
    const name = `e2e-${RUN}`;
    await host.goto(`${SPA}/lobbies`);
    await host.getByRole('button', { name: 'Create lobby', exact: true }).click();
    const sheet = host.getByRole('dialog', { name: 'Create lobby', exact: true });
    await sheet.getByLabel('Lobby name', { exact: true }).fill(name);
    await sheet.getByRole('button', { name: 'Create', exact: true }).click();
    // X-5: the host lands in the new lobby, seated in Team A
    await host.waitForURL('**/lobby/**', { timeout: 15000 });

    for (const [index, guest] of guests.entries()) {
        const player = PLAYERS[index + 1];
        await guest.goto(`${SPA}/lobbies`);
        // a row is a button named "{lobby}, host {host}, {n} of 4"
        await guest.getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}, host `) }).click({ timeout: 15000 });
        await guest.getByRole('dialog', { name, exact: true }).getByRole('button', { name: 'Join lobby', exact: true }).click();
        // D-19: the join lands in the lobby itself; leaving earlier would abort the request
        await guest.waitForURL('**/lobby/**', { timeout: 15000 });
        // the host sits in A: guest 1 takes A's other seat, guests 2 and 3 the first open B seat
        const team = index === 0 ? 'A' : 'B';
        await guest.getByRole('button', { name: `Sit here, team ${team}`, exact: true }).first().click({ timeout: 15000 });
        // while the request runs the tapped seat is aria-busy ("Joining…"); done when it shows as mine
        const mine = guest.getByRole('button', { name: `${player} (you), team ${team}`, exact: true });
        const busy = guest.getByTestId('lobby-table').locator('[aria-busy="true"]');
        await waitUntil(async () => (await mine.count()) === 1 && (await busy.count()) === 0, 15000, `${player} sits in Team ${team}`);
    }

    const start = host.getByRole('button', { name: /Start match/i });
    await waitUntil(() => start.isEnabled(), 20000, 'the host can start the match');
    const startedAt = Date.now();
    await start.click();
    // the host goes by the start response, every guest by its lobby poll
    return Promise.all(pages.map(async (page) => {
        await page.waitForURL('**/game/**', { timeout: 30000 });
        return Date.now() - startedAt;
    }));
}

const phaseOf = async (page) => {
    // the raw state from data-phase (Phase 6); the visible phase word as a fallback
    const value = await page.getByTestId('game-phase')
        .evaluate((element) => element.getAttribute('data-phase') ?? element.textContent, undefined, { timeout: 1000 })
        .catch(() => null);
    if (value === null) return null;
    return PHASE[value.trim()] ?? value.trim();
};
const handSize = (page) => page.getByTestId('hand-card').count();
const myTurn = (page) => page.getByTestId('your-turn').isVisible().catch(() => false);
const bidCount = (page) => page.getByTestId('bid').count();
const tableLayout = (page) => page.locator('section[aria-label="Game table"]').getAttribute('data-layout', { timeout: 5000 }).catch(() => null);

// Playwright measures a click `position` from the element's bounding box, and a fanned card is
// turned (up to about ±8°), which moves its face inside that box: so CARD_POINT is turned with the
// card about the box's centre. Unturned, the position is CARD_POINT itself.
export function cardClickPoint({ boxWidth, boxHeight, width, height, a, b }, point = CARD_POINT) {
    const scale = Math.hypot(a, b) || 1;
    const cos = a / scale;
    const sin = b / scale;
    const dx = (point.x - width / 2) * scale;
    const dy = (point.y - height / 2) * scale;
    return { x: boxWidth / 2 + dx * cos - dy * sin, y: boxHeight / 2 + dx * sin + dy * cos };
}
const cardGeometry = (card) => card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const transform = getComputedStyle(element).transform;
    const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
    return { boxWidth: box.width, boxHeight: box.height, width: element.offsetWidth, height: element.offsetHeight, a: matrix.a, b: matrix.b };
});

// Clicks a bid and waits until the table moved on: another bid shows, the phase changed, or the
// turn passed.
async function bid(page, label, choice) {
    const before = await bidCount(page);
    await page.getByRole('button', { name: choice, exact: true }).click();
    await waitUntil(async () => {
        if ((await bidCount(page)) > before) return true;
        const phase = await phaseOf(page);
        // a vanished table is a failure, not a registered bid
        if (phase === null) throw new Error(`${label}'s table is gone after clicking ${choice}`);
        return phase !== 'BIDDING' || !(await myTurn(page));
    }, 5000, `${label}'s ${choice} is registered`);
}

// Hand 1: six cards each while bidding, then the first bidder passes and the next calls Herc.
async function playFirstHandBids(pages, mobile) {
    await waitUntil(async () => (await Promise.all(pages.map(phaseOf))).every((p) => p === 'BIDDING'),
        45000, 'every seat sees Bidding');
    for (const [i, page] of pages.entries()) {
        const size = await handSize(page);
        if (size !== 6) throw new Error(`${PLAYERS[i]} holds ${size} cards while bidding, expected 6`);
    }
    await assertFits(pages, 'table', mobile);

    const uiBids = [];
    await waitUntil(async () => {
        const phases = await Promise.all(pages.map(phaseOf));
        if (phases.every((p) => p === 'PLAYING')) return true;
        for (const [i, page] of pages.entries()) {
            if (phases[i] !== 'BIDDING' || !(await myTurn(page))) continue;
            const choice = uiBids.length === 0 ? 'Pass' : 'Call Herc';
            await bid(page, PLAYERS[i], choice);
            uiBids.push(`${PLAYERS[i]}: ${choice}`);
            break;
        }
        return false;
    }, 90000, 'bidding ends in Playing');

    await waitUntil(async () => (await Promise.all(pages.map(handSize))).every((n) => n === 8),
        15000, 'every seat holds 8 cards after the trump call');

    // Every bid on the table must be one of our clicks: a turn-timer auto-pass for a seat
    // whose bid controls never showed would add an entry no click produced.
    if (uiBids.length !== 2 || !uiBids[0].endsWith(': Pass') || !uiBids[1].endsWith(': Call Herc')) {
        throw new Error(`expected the UI bids Pass then Call Herc, made ${JSON.stringify(uiBids)}`);
    }
    const bidsShown = await Promise.all(pages.map(bidCount));
    if (!bidsShown.every((n) => n === uiBids.length)) {
        throw new Error(`seats show ${bidsShown.join(',')} bids, expected only the ${uiBids.length} made in the UI`);
    }
    const trumps = await Promise.all(pages.map((page) => page.getByTestId('trump').textContent({ timeout: 1000 }).catch(() => null)));
    if (!trumps.every((t) => t === 'Herc')) throw new Error(`seats show trump ${trumps.join(',')}, expected Herc`);
    return uiBids;
}

// The seat on turn clicks its first playable card, and the play must land. The backend books even
// an illegal card (as a foul), so a clicked card still in the hand while the turn stays is a lost
// click and fails the run. Null once the card left the hand, or when a token renewal had the
// socket down at the click (the table says NOT_SENT; the next round clicks again). "<seat> <card>"
// when the turn passed without the click: the turn timer moved first.
async function playOneCard(page, label, stats) {
    const cards = page.getByTestId('hand-card');
    const belaPrompt = page.getByRole('button', { name: 'Play + Bela', exact: true });
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        if (await card.isDisabled().catch(() => true)) continue;
        const id = await card.getAttribute('data-card');
        await card.click({ position: cardClickPoint(await cardGeometry(card)) });
        // A play counts only when the clicked card left the hand (a turn-timer auto-play shrinks
        // it too). Holding the other bela card, the SPA first asks "Play" or "Play + Bela"
        // (spec R-32); a plain Play keeps the hand's points to the cards.
        const stillInHand = page.locator(`[data-testid="hand-card"][data-card="${id}"]`);
        let answered = false;
        const left = await waitUntil(async () => {
            if ((await stillInHand.count()) === 0) return true;
            if (!answered && (await belaPrompt.isVisible().catch(() => false))) {
                answered = true;
                await page.getByRole('button', { name: 'Play', exact: true }).click();
                stats.belaPrompts += 1;
            }
            return false;
        }, 5000, `${id} left ${label}'s hand`).then(() => true, (error) => {
            if (error.message.startsWith('timed out after')) return false;
            throw error;
        });
        if (left) {
            stats.plays += 1;
            return null;
        }
        const notSent = await page.getByText(NOT_SENT, { exact: true }).isVisible().catch(() => false);
        // another card left (the timer played for the seat, which may have won the trick and lead
        // again), or the turn passed
        if ((await handSize(page)) < count || !(await myTurn(page))) return `${label} ${id}`;
        // a renewal swaps the socket (spec R-10): a click in that gap is refused in the open
        if (EXPECT_RENEWAL && notSent) {
            stats.notSent += 1;
            return null;
        }
        stats.missedPlays += 1;
        throw new Error(`${label}: ${id} was clicked but not played${notSent ? ` (the table says "${NOT_SENT}")` : ''}`);
    }
    if (!(await myTurn(page))) return `${label} (before its click)`;
    throw new Error(`${label}: no card in the hand was taken while it was their turn`);
}

// UI-redesign spec §7.4, D-24: during hand 1 the tab on turn turns to 812×375, where its table takes
// the compact landscape layout and must not scroll sideways; it plays one card there and turns back
// to the phone's portrait size.
async function landscapePlay(pages, stats, mobile) {
    let actor = -1;
    await waitUntil(async () => {
        for (const [i, page] of pages.entries()) {
            if ((await phaseOf(page)) === 'PLAYING' && (await myTurn(page))) {
                actor = i;
                return true;
            }
        }
        return false;
    }, NEXT_MOVE_TIMEOUT_MS, 'a seat can play in hand 1');
    const page = pages[actor];
    await page.setViewportSize(LANDSCAPE);
    await waitUntil(async () => (await tableLayout(page)) === 'landscape', 10000, `${PLAYERS[actor]}'s table takes the landscape layout`);
    await assertFits([page], 'landscape', mobile, LANDSCAPE.width);
    const lost = await playOneCard(page, PLAYERS[actor], stats);
    if (lost) throw new Error(`landscape: the turn passed before ${lost} was played at 812x375`);
    await page.setViewportSize(VIEWPORT);
    await waitUntil(async () => (await tableLayout(page)) === 'portrait', 10000, `${PLAYERS[actor]}'s table is back in portrait`);
    return { player: PLAYERS[actor], viewport: `${LANDSCAPE.width}x${LANDSCAPE.height}`, layout: 'landscape', backTo: `${VIEWPORT.width}x${VIEWPORT.height}` };
}

// Every move after hand 1's bids, until all four tables say the game is over. A card turn the
// turn timer took while its seat was playing it fails the run at the end, except the first move
// after a restart: its timer was re-armed while the tabs were still reconnecting (spec R-21), and
// that auto-played card is harmless.
async function playToTheEnd(pages, stats, restart) {
    let firstMove = true;
    for (;;) {
        if (stats.plays > MAX_PLAYS) throw new Error(`no end after ${stats.plays} cards`);
        let actor = -1;
        let actorPhase = null;
        let over = false;
        await waitUntil(async () => {
            const phases = await Promise.all(pages.map(phaseOf));
            if (phases.every((p) => p === 'COMPLETED')) {
                over = true;
                return true;
            }
            const cancelled = phases.indexOf('CANCELLED');
            if (cancelled >= 0) throw new Error(`${PLAYERS[cancelled]}'s table says the game was cancelled (after ${stats.plays} cards)`);
            for (const [i, page] of pages.entries()) {
                if ((phases[i] === 'BIDDING' || phases[i] === 'PLAYING') && (await myTurn(page))) {
                    actor = i;
                    actorPhase = phases[i];
                    return true;
                }
            }
            return false;
        }, NEXT_MOVE_TIMEOUT_MS, `a seat can act or the game is over (after ${stats.plays} cards)`);
        if (over) {
            if (stats.lostTurns.length) throw new Error(`the turn timer took turns the harness was playing: ${stats.lostTurns.join(', ')}`);
            return;
        }
        if (actorPhase === 'BIDDING') {
            await bid(pages[actor], PLAYERS[actor], 'Call Herc');
            stats.trumpCalls += 1;
        } else {
            if (EXPECT_RENEWAL) await sleep(RENEWAL_PACE_MS);
            const lost = await playOneCard(pages[actor], PLAYERS[actor], stats);
            if (lost && restart && firstMove) restart.firstMoveLostToTimer = lost;
            else if (lost) stats.lostTurns.push(lost);
        }
        firstMove = false;
    }
}

// Match details of the finished match, opened from /matches in a new tab of the same player: the
// newest match is the first row of page 1, and every row links to /matches/{id}.
async function matchDetailsScores(context, gameId) {
    const page = await context.newPage();
    try {
        await page.goto(`${SPA}/matches`);
        await page.locator(`a[href$="/${gameId}"]`).first().click({ timeout: 20000 });
        await page.waitForURL(`**/matches/${gameId}`, { timeout: 15000 });
        const finalOf = async (testId) => Number((await page.getByTestId(testId).textContent({ timeout: 15000 })).trim());
        return { teamA: await finalOf('final-a'), teamB: await finalOf('final-b') };
    } finally {
        await page.close();
    }
}

// UI-redesign spec §6.3 on the real stack: every hand played is stored with its 8 tricks, each with
// its winner, and with its summary; no empty hand follows the last one.
async function checkStoredHands(gameId, token, handsPlayed) {
    const response = await fetch(`${API}/matches/${gameId}/structured-moves`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`GET /matches/${gameId}/structured-moves answered ${response.status}`);
    const hands = await response.json();
    const tricks = hands.map((hand) => (hand.tricks ?? []).length);
    const unwon = hands.flatMap((hand) => (hand.tricks ?? []).filter((trick) => !trick.winnerId).map((trick) => `${hand.handNo}.${trick.trickNo}`));
    const unsummed = hands.filter((hand) => !hand.handSummary).map((hand) => hand.handNo);
    if (hands.length !== handsPlayed || !tricks.every((n) => n === 8) || unwon.length || unsummed.length) {
        throw new Error(`structured moves of ${gameId}: ${hands.length} hands (played ${handsPlayed}), tricks per hand ${tricks.join(',')}, `
            + `tricks without a winner ${unwon.join(',') || 'none'}, hands without a summary ${unsummed.join(',') || 'none'}`);
    }
    return { hands: hands.length, tricks };
}

// The end: every seat shows the same winner and scores, the backend's match record says the same
// (Team A's score first, spec R-36), and so do the stored hands and Match details (spec R-44).
async function checkTheEnd(pages, handsPlayed) {
    const tables = await Promise.all(pages.map(async (page) => {
        const line = await page.getByText(/^Team [AB] wins/).first().textContent({ timeout: 10000 });
        return {
            winner: /^Team ([AB]) wins/.exec(line.trim())[1],
            teamA: Number((await page.getByTestId('score-a').textContent({ timeout: 5000 })).trim()),
            teamB: Number((await page.getByTestId('score-b').textContent({ timeout: 5000 })).trim()),
        };
    }));
    const [table] = tables;
    const same = (other) => other.winner === table.winner && other.teamA === table.teamA && other.teamB === table.teamB;
    if (!tables.every(same)) throw new Error(`the seats disagree on the end: ${JSON.stringify(tables)}`);
    if ((table.teamA > table.teamB) !== (table.winner === 'A')) {
        throw new Error(`the table names Team ${table.winner} the winner at ${table.teamA}:${table.teamB}`);
    }
    // played out, not ended early: the winner reached the target, and no seat shows why it ended
    // otherwise (forfeit, abandon, cancel; spec R-31)
    if (Math.max(table.teamA, table.teamB) < TARGET_SCORE) {
        throw new Error(`the game ended at ${table.teamA}:${table.teamB}, before either team reached ${TARGET_SCORE}`);
    }
    const reasons = (await Promise.all(pages.map((page) => page.getByTestId('end-reason').allTextContents()))).flat();
    if (reasons.length) throw new Error(`the game was not played out: ${JSON.stringify(reasons)}`);
    const gameId = gameIdOf(pages[0]);
    const token = await pages[0].evaluate(() => localStorage.getItem('authToken'));
    const response = await fetch(`${API}/matches/${gameId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`GET /matches/${gameId} answered ${response.status}`);
    const { result } = await response.json();
    // "Team A wins 1001–650": the first number is always Team A's, en dash or hyphen
    const parsed = /^Team ([AB]) wins (\d+)\s*[–-]\s*(\d+)$/.exec(result ?? '');
    if (!parsed) throw new Error(`match ${gameId} has the result ${JSON.stringify(result)}, expected "Team X wins A–B"`);
    if (!same({ winner: parsed[1], teamA: Number(parsed[2]), teamB: Number(parsed[3]) })) {
        throw new Error(`the match record says "${result}", the table Team ${table.winner} at ${table.teamA}:${table.teamB}`);
    }
    const storedHands = await checkStoredHands(gameId, token, handsPlayed);
    const details = await matchDetailsScores(pages[0].context(), gameId);
    if (details.teamA !== table.teamA || details.teamB !== table.teamB) {
        throw new Error(`Match details shows ${details.teamA}:${details.teamB}, the table ${table.teamA}:${table.teamB}`);
    }
    return { gameId, ...table, result, storedHands, matchDetails: details };
}

// R-45: all four press Play again; every tab must land on the same new game, in Bidding, at 0:0.
async function rematch(pages) {
    const oldGameId = gameIdOf(pages[0]);
    for (const [k, page] of pages.entries()) {
        await page.getByRole('button', { name: 'Play again', exact: true }).click();
        if (k < pages.length - 1) await page.getByText(`${k + 1}/4 want a rematch`).first().waitFor({ timeout: 10000 });
    }
    let newGameId = null;
    await waitUntil(async () => {
        const ids = pages.map(gameIdOf);
        if (!ids.every((id) => id !== null && id !== oldGameId && id === ids[0])) return false;
        newGameId = ids[0];
        return (await Promise.all(pages.map(phaseOf))).every((phase) => phase === 'BIDDING');
    }, 30000, 'every seat is in Bidding of the same new game');
    const scores = await Promise.all(pages.map(async (page) =>
        `${(await page.getByTestId('score-a').textContent()).trim()}:${(await page.getByTestId('score-b').textContent()).trim()}`));
    if (!scores.every((score) => score === '0:0')) throw new Error(`the rematch starts at ${scores.join(', ')}, expected 0:0`);
    return { oldGameId, newGameId };
}

function runCommand(command) {
    return new Promise((resolve, reject) => {
        // stdout carries the JSON summary: the command's output goes to stderr
        const child = spawn('sh', ['-c', command], { stdio: ['ignore', 2, 2] });
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`"${command}" did not finish within ${COMMAND_TIMEOUT_MS} ms (killed)`));
        }, COMMAND_TIMEOUT_MS);
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(`"${command}" exited with ${code}`));
        });
    });
}

// Restarts the backend under the open table. Each tab must reconnect by itself, without a
// reload, on exactly one new socket, and get its game state again within RECONNECT_BUDGET_MS
// of the backend being back. Fills `report` as it goes, so a failure shows how far it got.
async function restartBackend(seats, report) {
    const before = seats.map((seat) => seat.sockets.length);
    const loadsBefore = seats.map((seat) => seat.loads);
    const restartAt = Date.now();
    report.step = 'running E2E_RESTART_CMD';
    await runCommand(RESTART_CMD);
    const upAt = Date.now();
    report.backendDownMs = upAt - restartAt;
    report.step = 'waiting for every tab to reconnect';
    const fresh = () => seats.map((seat, i) => seat.sockets.slice(before[i]));
    await waitUntil(() => fresh().every((list) => list.some((socket) => socket.firstStateAt !== null)),
        RECONNECT_BUDGET_MS, 'every tab reconnects and gets its game state after the backend restart');
    const reconnected = fresh();
    const counts = reconnected.map((list) => list.length);
    if (!counts.every((n) => n === 1)) {
        throw new Error(`after the restart the tabs opened ${counts.join(',')} STOMP sockets, expected 1 each`);
    }
    const reloads = seats.map((seat, i) => seat.loads - loadsBefore[i]);
    if (!reloads.every((n) => n === 0)) throw new Error(`tabs reloaded ${reloads.join(',')} times while reconnecting, expected none`);
    delete report.step;
    Object.assign(report, {
        oldSocketClosedAfterMs: seats.map((seat, i) => seat.sockets[before[i] - 1].closedAt - restartAt),
        reconnectedAfterBackendUpMs: reconnected.map(([socket]) => socket.connectedAt - upAt),
        reconnectedAfterCloseMs: reconnected.map(([socket], i) => socket.connectedAt - seats[i].sockets[before[i] - 1].closedAt),
        stateBackAfterBackendUpMs: reconnected.map(([socket]) => socket.firstStateAt - upAt),
        sockets: counts,
        reloads,
    });
}

// What the game connections did so far, for a failure report: flags only, no URLs or frames.
const socketTrace = (seats) => seats.map((seat) => seat.sockets.map((socket) => ({
    connected: socket.connectedAt !== null,
    closed: socket.closedAt !== null,
    gotState: socket.firstStateAt !== null,
    refreshesBeforeState: socket.refreshesBeforeState,
})));

async function main() {
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
    const leaks = [];
    const contexts = await Promise.all(PLAYERS.map(() => browser.newContext(VIEWPORT ? { viewport: VIEWPORT } : {})));
    if (XHR) {
        // SockJS takes its websocket transport whenever the browser has WebSocket; without it,
        // xhr-streaming comes next (spec R-28: both must work across origins).
        await Promise.all(contexts.map((context) => context.addInitScript(() => {
            delete window.WebSocket;
            delete window.MozWebSocket;
        })));
    }
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const seats = pages.map((page, i) => watch(page, PLAYERS[i], leaks));
    const recording = RECORD_VIEWS ? recordViews(pages[0]) : null;
    const stats = { plays: 0, trumpCalls: 0, belaPrompts: 0, notSent: 0, missedPlays: 0, lostTurns: [] };
    const mobile = VIEWPORT ? { viewport: `${VIEWPORT.width}x${VIEWPORT.height}` } : null;
    let msToGame = null;
    let restart = null;
    // how each seat reached its table; refreshesBeforeState > 0 means the snapshot retry was needed
    const followOf = () => msToGame && pages.map((_, i) => ({
        player: PLAYERS[i],
        via: i === 0 ? 'start response' : 'lobby poll',
        msToGame: msToGame[i],
        refreshesBeforeState: seats[i].sockets[0]?.refreshesBeforeState ?? null,
    }));
    try {
        for (const [i, page] of pages.entries()) {
            await signUp(page, PLAYERS[i]);
            if (CONFIRM_EMAIL) await confirmEmail(page, PLAYERS[i]);
        }
        await logInAgain(pages[3], PLAYERS[3]);
        // the newest token each tab starts with: a renewal run must outlive and replace it (R-10)
        const signedInAt = Date.now();
        const signedInTokens = await Promise.all(pages.map(storedToken));
        seats.forEach((seat) => { seat.watchLogin = true; });
        for (const [i, page] of pages.entries()) await checkPlayPage(page, seats[i], PLAYERS[i]);
        await checkLobbiesFit(pages, mobile);
        seats.forEach((seat) => { seat.sockets.length = 0; });
        msToGame = await formLobby(pages);
        const uiBids = await playFirstHandBids(pages, mobile);
        if (RESTART_CMD) {
            restart = {};
            await restartBackend(seats, restart);
        }
        const landscape = LANDSCAPE_CHECK ? await landscapePlay(pages, stats, mobile) : null;
        await playToTheEnd(pages, stats, restart);
        await assertFits(pages, 'gameOver', mobile);

        const gameSockets = seats.map((seat) => seat.sockets.length);
        const openCounts = () => (XHR ? seats.map((seat) => seat.sockets.length)
            : seats.map((seat) => seat.sockets.filter((socket) => socket.closedAt === null).length));
        // a renewal may be swapping a connection right now: give it a moment
        await waitUntil(() => openCounts().every((n) => n === 1), 10000, 'one open game connection per tab')
            .catch(() => {
                throw new Error(`at the end the tabs hold ${openCounts().join(',')} open game connections, expected 1 each`);
            });
        const openSockets = openCounts();
        // One connection for the whole game, plus the one after a restart. A renewal reconnects
        // with the new token, so only the open count above applies then.
        const expectedSockets = RESTART_CMD ? 2 : 1;
        if (!EXPECT_RENEWAL && !gameSockets.every((n) => n === expectedSockets)) {
            throw new Error(`game pages opened ${gameSockets.join(',')} STOMP connections, expected ${expectedSockets} each`);
        }
        const websockets = seats.map((seat) => seat.websockets);
        if (XHR && !websockets.every((n) => n === 0)) throw new Error(`the xhr-streaming run opened WebSockets: ${websockets.join(',')}`);
        if (leaks.length) throw new Error(`?user= seen: ${leaks.join(' | ')}`);
        const sawLogin = seats.map((seat) => seat.sawLogin);
        if (sawLogin.some(Boolean)) throw new Error(`a tab was sent to /login: ${sawLogin.join(',')}`);
        let renewal = null;
        if (EXPECT_RENEWAL) {
            const calls = seats.map((seat) => seat.renewals);
            const runMs = Date.now() - signedInAt;
            if (runMs < RENEWAL_MIN_RUN_MS) throw new Error(`the game ended ${runMs} ms after the last sign-in, too soon to outlive a 3-minute token and the 60-s sweep`);
            if (!calls.every((n) => n >= 1)) throw new Error(`token renewals per tab: ${calls.join(',')}, expected at least 1 each`);
            const refused = seats.flatMap((seat) => seat.renewalErrors);
            if (refused.length) throw new Error(`POST /user/me/token answered ${refused.join(',')}`);
            // A renewal counts only once the tab stored the new token: a POST lost to the network or
            // to CORS leaves the old one in place.
            const tokens = await Promise.all(pages.map(storedToken));
            const renewed = tokens.map((token, i) => expOf(token) > expOf(signedInTokens[i]));
            if (!renewed.every(Boolean)) throw new Error(`tabs holding a renewed token: ${renewed.join(',')}, expected true each`);
            renewal = { calls, runMs };
        }
        // one trump call per hand: hand 1's in uiBids, every later one in trumpCalls
        const final = await checkTheEnd(pages, stats.trumpCalls + 1);
        const rematchReport = REMATCH ? await rematch(pages) : null;
        const recorded = recording ? saveRecording(recording, PLAYERS[0]) : null;
        console.log(JSON.stringify({
            ok: true,
            players: PLAYERS,
            transport: XHR ? 'xhr-streaming' : 'websocket',
            confirmedEmail: CONFIRM_EMAIL,
            uiBids,
            ...stats,
            gameSockets,
            openSockets,
            websockets,
            follow: followOf(),
            restart,
            renewal,
            mobile,
            landscape,
            final,
            rematch: rematchReport,
            recorded,
        }, null, 2));
    } catch (error) {
        await Promise.all(pages.map((page, i) =>
            page.screenshot({ path: join(ARTIFACTS, `${PLAYERS[i]}.png`), fullPage: true }).catch(() => undefined)));
        console.error(`FAILED: ${error.message} (screenshots in ${ARTIFACTS})`);
        // what was observed up to the failure (no URLs or frames: nothing that can carry a token)
        console.error(JSON.stringify({ ok: false, players: PLAYERS, ...stats, follow: followOf(), restart, sockets: socketTrace(seats) }, null, 2));
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

// Run as a script; imported (the offline checks of its pure helpers), it starts nothing.
if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
