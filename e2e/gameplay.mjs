#!/usr/bin/env node
// Four-seat gameplay check through the real SPA (roadmap B8/B9).
//
// Four isolated browser contexts sign up, optionally confirm their email address
// from the mail in Mailpit, check that /play opens exactly one STOMP socket,
// form a lobby, start the match, bid (one Pass, one trump call) and play eight
// cards (two tricks) by clicking the hand - each move well inside the backend's
// 30-second turn timer. Also fails if any request or socket URL carries ?user=.
// The three non-host seats are never sent to /game by URL: they follow the
// host's start through the lobby poll, and their tables must render.
//
// Needs the backend on :8080 (local Docker Mongo/Redis/Mailpit, never the real
// .env), the SPA dev server on :5173, and playwright-core 1.62.1 installed
// OUTSIDE this repo (it is not a project dependency):
//   npm i --prefix <dir> playwright-core@1.62.1
//   PLAYWRIGHT_CORE_DIR=<dir>/node_modules/playwright-core node e2e/gameplay.mjs
// Env: SPA_URL (default http://localhost:5173), MAILPIT_URL (default
// http://localhost:8025), E2E_CONFIRM_EMAIL=1 to confirm addresses (needs the
// email feature), HEADLESS=0 to watch, E2E_ARTIFACTS for failure screenshots,
// E2E_RESTART_CMD=<shell command> that restarts the backend and returns once it
// is up: run once the table is up, then every tab's socket must reconnect by
// itself within 30 s and the game goes on over the new sockets.
// Signup is rate limited per IP (5/hour from the email lane on): restart the
// backend before re-running within the hour. Any 429 is printed to stderr.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');

const SPA = process.env.SPA_URL ?? 'http://localhost:5173';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const CONFIRM_EMAIL = process.env.E2E_CONFIRM_EMAIL === '1';
const ARTIFACTS = process.env.E2E_ARTIFACTS ?? join(tmpdir(), 'belatro-e2e');
const RESTART_CMD = process.env.E2E_RESTART_CMD ?? '';
const RECONNECT_BUDGET_MS = 30000;
const COMMAND_TIMEOUT_MS = 90000;
const PASSWORD = 'e2e-password-123';
const RUN = Date.now().toString(36).slice(-5);
const PLAYERS = [1, 2, 3, 4].map((n) => `e2e${RUN}p${n}`);
const TARGET_PLAYS = 8;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const emailOf = (username) => `${username}@example.test`;

async function waitUntil(check, timeoutMs, what) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (await check()) return;
        if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs} ms: ${what}`);
        await sleep(250);
    }
}

function watch(page, label, leaks) {
    const sockets = [];
    page.on('websocket', (ws) => {
        const url = ws.url();
        if (/[?&]user=/.test(url)) leaks.push(`${label} websocket ${url}`);
        // SockJS sessions live under /ws/<server>/<session>/websocket; Vite's HMR socket is "/".
        if (!new URL(url).pathname.startsWith('/ws/')) return;
        // When it connected, closed and first got this seat's game state, and how many
        // snapshot requests (/refresh) went out before that state arrived.
        const socket = { url, connectedAt: null, closedAt: null, refreshes: 0, firstStateAt: null, refreshesBeforeState: null };
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
        sockets.push(socket);
    });
    page.on('request', (request) => {
        if (/[?&]user=/.test(request.url())) leaks.push(`${label} ${request.url()}`);
    });
    page.on('response', (response) => {
        if (response.status() === 429) console.error(`${label}: 429 Too Many Requests from ${response.url()}`);
    });
    return sockets;
}

async function signUp(page, username) {
    await page.goto(`${SPA}/signup`);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Email', { exact: true }).fill(emailOf(username));
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
    // From the email lane on, a "check your inbox" panel comes first.
    const proceed = page.getByRole('button', { name: 'Continue', exact: true });
    await waitUntil(
        async () => page.url().endsWith('/dashboard') || (await proceed.isVisible().catch(() => false)),
        15000, `${username} signed up`);
    if (!page.url().endsWith('/dashboard')) {
        await proceed.click();
        await page.waitForURL('**/dashboard', { timeout: 15000 });
    }
}

async function confirmLinkFor(address) {
    let link = null;
    await waitUntil(async () => {
        const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
        if (!search.ok) return false;
        const { messages = [] } = await search.json();
        for (const message of messages) {
            const full = await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
            const match = /https?:\/\/\S+\/confirm-email\?token=[A-Za-z0-9_-]+/.exec(full.Text ?? '');
            if (match) {
                link = new URL(match[0]);
                return true;
            }
        }
        return false;
    }, 30000, `confirmation mail for ${address}`);
    return link;
}

async function confirmEmail(page, username) {
    const link = await confirmLinkFor(emailOf(username));
    await page.goto(`${SPA}${link.pathname}${link.search}`);
    await page.getByRole('button', { name: 'Confirm email address', exact: true }).click();
    await page.getByText('Your email address is confirmed.').waitFor({ timeout: 15000 });
}

async function checkPlayPage(page, sockets, label) {
    sockets.length = 0;
    await page.goto(`${SPA}/play`);
    await page.getByText('RANKED', { exact: true }).waitFor({ timeout: 15000 });
    await sleep(3000);
    if (sockets.length !== 1) throw new Error(`${label}: /play opened ${sockets.length} STOMP sockets, expected 1`);
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
        const join = guest.getByRole('button', { name: 'Join Game', exact: true });
        await join.click();
        await join.waitFor({ state: 'detached', timeout: 15000 });
        await guest.goto(lobbyUrl);
        const team = index === 0 ? 'Join Team A' : 'Join Team B';
        const teamButton = guest.getByRole('button', { name: team, exact: true });
        await teamButton.click({ timeout: 15000 });
        await teamButton.waitFor({ state: 'detached', timeout: 15000 });
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

const phaseOf = (page) => page.getByTestId('game-phase').textContent({ timeout: 1000 }).catch(() => null);
const handSize = (page) => page.getByTestId('hand-card').count();
const myTurn = (page) => page.getByTestId('your-turn').isVisible().catch(() => false);
const bidCount = (page) => page.getByTestId('bid').count();

async function playGame(pages, afterTableUp) {
    await waitUntil(async () => (await Promise.all(pages.map(phaseOf))).every((p) => p === 'BIDDING'),
        45000, 'every seat sees BIDDING');
    for (const [i, page] of pages.entries()) {
        const size = await handSize(page);
        if (size !== 6) throw new Error(`${PLAYERS[i]} holds ${size} cards while bidding, expected 6`);
    }
    if (afterTableUp) await afterTableUp();

    // Bidding: the first player to act passes, the next one calls Herc.
    const uiBids = [];
    await waitUntil(async () => {
        const phases = await Promise.all(pages.map(phaseOf));
        if (phases.every((p) => p === 'PLAYING')) return true;
        for (const [i, page] of pages.entries()) {
            if (phases[i] !== 'BIDDING' || !(await myTurn(page))) continue;
            const before = await bidCount(page);
            const choice = uiBids.length === 0 ? 'Pass' : 'Call Herc';
            await page.getByRole('button', { name: choice, exact: true }).click();
            await waitUntil(async () => {
                if ((await bidCount(page)) > before) return true;
                const phase = await phaseOf(page);
                // a vanished table is a failure, not a registered bid
                if (phase === null) throw new Error(`${PLAYERS[i]}'s table is gone after clicking ${choice}`);
                return phase !== 'BIDDING';
            }, 5000, `${PLAYERS[i]}'s ${choice} is registered`);
            uiBids.push(`${PLAYERS[i]}: ${choice}`);
            break;
        }
        return false;
    }, 90000, 'bidding ends in PLAYING');

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

    let played = 0;
    while (played < TARGET_PLAYS) {
        let page = null;
        await waitUntil(async () => {
            for (const candidate of pages) {
                if ((await phaseOf(candidate)) === 'PLAYING' && (await myTurn(candidate))) {
                    page = candidate;
                    return true;
                }
            }
            return false;
        }, 20000, `a seat's turn to play card ${played + 1}`);
        const before = await handSize(page);
        const cards = page.getByTestId('hand-card');
        let accepted = false;
        for (let i = 0; i < before && !accepted; i++) {
            const card = cards.nth(i);
            if (await card.isDisabled()) continue;
            const id = await card.getAttribute('data-card');
            await card.click();
            // A play counts only when the clicked card left the hand (a turn-timer auto-play
            // shrinks it too). The backend refuses an illegal card on /user/queue/errors and
            // keeps it in the hand: that wait times out, so try the next card. Any other
            // error (page closed, locator failure) is the real cause and fails the run.
            const stillInHand = page.locator(`[data-testid="hand-card"][data-card="${id}"]`);
            accepted = await waitUntil(async () => (await stillInHand.count()) === 0, 2500, `${id} left the hand`)
                .then(() => true, (error) => {
                    if (error.message.startsWith('timed out after')) return false;
                    throw error;
                });
        }
        if (!accepted) throw new Error('no card in the hand was accepted');
        played += 1;
    }

    const sizes = await Promise.all(pages.map(handSize));
    if (!sizes.every((n) => n === 6)) {
        throw new Error(`after ${TARGET_PLAYS} plays every hand should hold 6 cards, saw ${sizes.join(',')}`);
    }
    return { uiBids, played };
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

// Restarts the backend under the open table. Each tab must reconnect by itself
// (gameSocket retries after 5, 10 and 20 s) on exactly one new socket and get
// its game state again within RECONNECT_BUDGET_MS of the backend being back.
// Fills `report` as it goes, so a failure can print how far the restart got.
async function restartBackend(sockets, report) {
    const before = sockets.map((list) => list.length);
    const restartAt = Date.now();
    report.step = 'running E2E_RESTART_CMD';
    await runCommand(RESTART_CMD);
    const upAt = Date.now();
    report.backendDownMs = upAt - restartAt;
    report.step = 'waiting for every tab to reconnect';
    const fresh = () => sockets.map((list, i) => list.slice(before[i]));
    await waitUntil(() => fresh().every((list) => list.some((socket) => socket.firstStateAt !== null)),
        RECONNECT_BUDGET_MS, 'every tab reconnects and gets its game state after the backend restart');
    const reconnected = fresh();
    const counts = reconnected.map((list) => list.length);
    if (!counts.every((n) => n === 1)) {
        throw new Error(`after the restart the tabs opened ${counts.join(',')} STOMP sockets, expected 1 each`);
    }
    delete report.step;
    Object.assign(report, {
        oldSocketClosedAfterMs: sockets.map((list, i) => list[before[i] - 1].closedAt - restartAt),
        reconnectedAfterBackendUpMs: reconnected.map(([socket]) => socket.connectedAt - upAt),
        reconnectedAfterCloseMs: reconnected.map(([socket], i) => socket.connectedAt - sockets[i][before[i] - 1].closedAt),
        stateBackAfterBackendUpMs: reconnected.map(([socket]) => socket.firstStateAt - upAt),
        sockets: counts,
    });
}

// What the game sockets did so far, for a failure report: flags only, no URLs or frames.
const socketTrace = (sockets) => sockets.map((list) => list.map((socket) => ({
    connected: socket.connectedAt !== null,
    closed: socket.closedAt !== null,
    gotState: socket.firstStateAt !== null,
    refreshesBeforeState: socket.refreshesBeforeState,
})));

async function main() {
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
    const leaks = [];
    const contexts = await Promise.all(PLAYERS.map(() => browser.newContext()));
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const sockets = pages.map((page, i) => watch(page, PLAYERS[i], leaks));
    let msToGame = null;
    let restart = null;
    // how each seat reached its table; refreshesBeforeState > 1 means the snapshot retry was needed
    const followOf = () => msToGame && pages.map((_, i) => ({
        player: PLAYERS[i],
        via: i === 0 ? 'start response' : 'lobby poll',
        msToGame: msToGame[i],
        refreshesBeforeState: sockets[i][0]?.refreshesBeforeState ?? null,
    }));
    try {
        for (const [i, page] of pages.entries()) {
            await signUp(page, PLAYERS[i]);
            if (CONFIRM_EMAIL) await confirmEmail(page, PLAYERS[i]);
        }
        for (const [i, page] of pages.entries()) await checkPlayPage(page, sockets[i], PLAYERS[i]);
        sockets.forEach((list) => { list.length = 0; });
        msToGame = await formLobby(pages);
        const afterTableUp = RESTART_CMD ? () => {
            restart = {};
            return restartBackend(sockets, restart);
        } : null;
        const result = await playGame(pages, afterTableUp);
        const follow = followOf();
        const gameSockets = sockets.map((list, i) => list.length - (restart ? restart.sockets[i] : 0));
        if (!gameSockets.every((n) => n === 1)) {
            throw new Error(`game pages opened ${gameSockets.join(',')} STOMP sockets, expected 1 each`);
        }
        if (leaks.length) throw new Error(`?user= seen: ${leaks.join(' | ')}`);
        console.log(JSON.stringify({ ok: true, players: PLAYERS, confirmedEmail: CONFIRM_EMAIL, ...result, gameSockets, follow, restart }, null, 2));
    } catch (error) {
        await Promise.all(pages.map((page, i) =>
            page.screenshot({ path: join(ARTIFACTS, `${PLAYERS[i]}.png`), fullPage: true }).catch(() => undefined)));
        console.error(`FAILED: ${error.message} (screenshots in ${ARTIFACTS})`);
        // what was observed up to the failure (no URLs or frames: nothing that can carry a token)
        console.error(JSON.stringify({ ok: false, players: PLAYERS, follow: followOf(), restart, sockets: socketTrace(sockets) }, null, 2));
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

await main();
