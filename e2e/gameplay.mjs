#!/usr/bin/env node
// Four-seat release-gate harness through the real SPA (spec R-44, plus the rig checks of R-10,
// R-28, R-30, R-37 and R-45).
//
// Four isolated browser contexts sign up with the invite code and optionally confirm their
// email address from the mail in Mailpit; the fourth seat then signs out and in again through
// the login form. Each tab checks that /play opens exactly one STOMP socket. The host forms a
// lobby and starts the match; the three guests are never sent to /game by URL: they follow the
// host's start through the lobby poll, and their tables must render.
// Hand 1 opens with a Pass and a Herc call, both clicked in the UI (a turn-timer auto-move would
// add a bid no click made). From then on the game is played to its end by clicking: each later
// hand's first bidder calls Herc, and the seat on turn clicks its first playable card. A card
// may be illegal: the backend books it as a foul, and nobody ever presses Challenge. A bela
// prompt is answered with a plain Play, and the 10-s post-hand window is waited out. Every
// clicked card must leave the hand, and no card turn may go to the turn timer while its seat is
// playing it (after a restart, the first move may).
// At the end every seat must show the same winner and scores, the winner at 1001 or more and no
// end reason (forfeit, abandon, cancel), GET /matches/{id} must record the
// same result ("Team A wins 1001–650": Team A's score first, en dash or hyphen), and Match
// Details must show the same two numbers. The run also fails if any request or socket URL
// carries ?user=, or if a tab is sent to /login after the sign-ins.
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
// The transport mode can't be combined with a restart or a renewal run (their checks read
// WebSocket frames), nor a restart with a renewal run. Signup is rate limited per IP: start a
// fresh backend before every run. Any 429 is printed to stderr.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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
// A game to 1001 takes about ten hands (~320 cards); far more means it isn't ending.
const MAX_PLAYS = 2000;
// A game played out ends once a team reaches this (BelotGame.TARGET_SCORE).
const TARGET_SCORE = 1001;
// The table's notice for a move made while its socket is down (spec R-30).
const NOT_SENT = 'Not sent — reconnecting';
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

// R-37: nothing may scroll sideways at the phone viewport.
async function assertFits(pages, where, mobile) {
    if (!VIEWPORT) return;
    const widths = await Promise.all(pages.map((page) => page.evaluate(() => document.documentElement.scrollWidth)));
    mobile[where] = widths;
    if (!widths.every((width) => width <= VIEWPORT.width)) {
        throw new Error(`${where}: content widths ${widths.join(',')} px exceed the ${VIEWPORT.width}-px viewport`);
    }
}

async function checkLobbiesFit(pages, mobile) {
    if (!VIEWPORT) return;
    await Promise.all(pages.map(async (page) => {
        await page.goto(`${SPA}/lobbies`);
        await page.getByRole('button', { name: 'Create Game', exact: true }).waitFor({ timeout: 15000 });
    }));
    await assertFits(pages, 'lobbies', mobile);
}

async function formLobby(pages) {
    const [host, ...guests] = pages;
    const name = `e2e-${RUN}`;
    await host.goto(`${SPA}/lobbies`);
    await host.getByRole('button', { name: 'Create Game', exact: true }).click();
    await host.getByLabel('Lobby Name').fill(name);
    await host.getByRole('button', { name: 'Create Lobby', exact: true }).click();
    await host.getByText(name, { exact: true }).click({ timeout: 15000 });
    await host.getByRole('button', { name: 'Enter Game', exact: true }).click();
    await host.waitForURL('**/lobby/**', { timeout: 15000 });
    const lobbyUrl = host.url();

    for (const [index, guest] of guests.entries()) {
        await guest.goto(`${SPA}/lobbies`);
        await guest.getByText(name, { exact: true }).click({ timeout: 15000 });
        await guest.getByRole('button', { name: 'Join Game', exact: true }).click();
        // The button reads "Joining..." while the request runs, so "Join Game" is gone at once;
        // only the popup closing means the join landed. Leaving earlier aborts the request.
        const joining = guest.getByRole('button', { name: /^(Join Game|Joining\.\.\.)$/ });
        await waitUntil(async () => (await joining.count()) === 0, 15000, `${PLAYERS[index + 1]} joined the lobby`);
        await guest.goto(lobbyUrl);
        const team = index === 0 ? 'Join Team A' : 'Join Team B';
        await guest.getByRole('button', { name: team, exact: true }).click({ timeout: 15000 });
        // likewise "Switching..." while the team change runs
        const switching = guest.getByRole('button', { name: new RegExp(`^(${team}|Switching\\.\\.\\.)$`) });
        await waitUntil(async () => (await switching.count()) === 0, 15000, `${PLAYERS[index + 1]} joined ${team.slice(5)}`);
    }

    const start = host.getByRole('button', { name: /Start Match/ });
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
        await card.click();
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
            const lost = await playOneCard(pages[actor], PLAYERS[actor], stats);
            if (lost && restart && firstMove) restart.firstMoveLostToTimer = lost;
            else if (lost) stats.lostTurns.push(lost);
        }
        firstMove = false;
    }
}

// Match Details of the finished match, opened from /matches in a new tab of the same player.
async function matchDetailsScores(context, gameId) {
    const page = await context.newPage();
    try {
        await page.goto(`${SPA}/matches`);
        await page.locator('select').first().selectOption('detailed', { timeout: 15000 });
        await page.getByRole('button', { name: 'Details', exact: true }).first().click({ timeout: 20000 });
        await page.getByText(`Match ID: ${gameId.slice(-12)}`).waitFor({ timeout: 15000 });
        const finalOf = async (label) => Number((await page
            .locator(`xpath=//div[normalize-space(.)="${label}"]/preceding-sibling::div[1]`)
            .textContent({ timeout: 15000 })).trim());
        return { teamA: await finalOf('Team A Final'), teamB: await finalOf('Team B Final') };
    } finally {
        await page.close();
    }
}

// The end: every seat shows the same winner and scores, the backend's match record says the same
// (Team A's score first, spec R-36), and so does Match Details (spec R-44).
async function checkTheEnd(pages) {
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
    const details = await matchDetailsScores(pages[0].context(), gameId);
    if (details.teamA !== table.teamA || details.teamB !== table.teamB) {
        throw new Error(`Match Details shows ${details.teamA}:${details.teamB}, the table ${table.teamA}:${table.teamB}`);
    }
    return { gameId, ...table, result, matchDetails: details };
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
        const final = await checkTheEnd(pages);
        const rematchReport = REMATCH ? await rematch(pages) : null;
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
            final,
            rematch: rematchReport,
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

await main();
