import { Client, type IFrame, type IMessage, type StompConfig, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
// Uses apiClient and ApiError lazily, inside functions only; never use them at module top
// level: import cycle with api.ts.
import { apiClient, ApiError } from './api';

/**
 * The one STOMP connection of this browser tab.
 *
 * Every component that needs the game server holds it with acquire() while
 * mounted and listens with subscribe(); this module owns the single Client,
 * shares one STOMP subscription per destination between all listeners and
 * re-subscribes after every connect. Before it existed each useGameWebSocket
 * instance built its own Client and every connect() tore the previous one down
 * (/play mounted three: ~17 sockets opened in the first 0.7 s).
 *
 * Identity travels only as the Bearer token on the CONNECT frame (SockJS cannot
 * set handshake headers). Never add a user query parameter or a username header:
 * the backend ignores both, and the user query parameter was the impersonation hole.
 */

export interface GameSocketState {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
}

/** The part of @stomp/stompjs's Client this module uses; tests pass a fake. */
export interface StompClientLike {
    activate(): void;
    deactivate(): unknown;
    publish(params: { destination: string; body: string }): void;
    subscribe(destination: string, callback: (message: IMessage) => void): StompSubscription;
}

export interface StompClientHandlers {
    onConnect: () => void;
    onStompError: (message: string) => void;
    onWebSocketClose: (code: number) => void;
}

export type StompClientFactory = (token: string, handlers: StompClientHandlers) => StompClientLike;

const WS_PATH = '/ws';
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 5000;
/** Long enough to survive React StrictMode's unmount/remount and a route change. */
const RELEASE_GRACE_MS = 1000;
/** The server closes a socket whose token was revoked or went stale with 1008. */
const CLOSE_POLICY_VIOLATION = 1008;

/** Why a tab whose session the server ended is signed out; the login page repeats it. */
export const SESSION_ENDED_MESSAGE = 'Your session ended — please sign in again';

/** Shown when the server refused the CONNECT although GET /user/me says the session is alive. */
export const CONNECT_REFUSED_MESSAGE = 'Could not connect to the game server. Try again.';

/**
 * How a session ends, for a 401 from the API and a 1008 alike: forget the token, then reload into
 * the login page, which says why. Only the token: storage is shared by the browser's tabs, and a
 * password change in another tab may store a new token next to the same user. useAuth logs out a
 * token it finds without a user, which would revoke that new token.
 */
function signOutToLogin(): void {
    localStorage.removeItem('authToken');
    window.location.assign('/login?reason=session-ended');
}

export function stompConfig(token: string, handlers: StompClientHandlers): StompConfig {
    return {
        webSocketFactory: () => new SockJS(WS_PATH),
        connectHeaders: { Authorization: `Bearer ${token}` },
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        // reconnects are ours (bounded, token-aware), not stompjs's endless loop
        reconnectDelay: 0,
        // stompjs hands every frame to debug, the CONNECT frame and its token included: never log it
        debug: () => undefined,
        onConnect: () => handlers.onConnect(),
        onStompError: (frame: IFrame) =>
            handlers.onStompError(frame.headers['message'] || frame.body || 'STOMP connection failed'),
        onWebSocketClose: (event: CloseEvent) => handlers.onWebSocketClose(event.code),
    };
}

type Route = { handlers: Set<(body: string) => void>; stomp: StompSubscription | null };

export function createGameSocket(
    createClient: StompClientFactory = (token, handlers) => new Client(stompConfig(token, handlers)),
    getToken: () => string | null = () => localStorage.getItem('authToken'),
    endSession: () => void = signOutToLogin,
    // a refused CONNECT does not say why; GET /user/me does (a 401 there ends the session in api.ts)
    checkSession: () => Promise<unknown> = () => apiClient.get('/user/me'),
) {
    let state: GameSocketState = { isConnected: false, isConnecting: false, error: null };
    const listeners = new Set<() => void>();
    const routes = new Map<string, Route>();
    let client: StompClientLike | null = null;
    let connected = false;
    let holders = 0;
    let reconnectAttempts = 0;
    let releaseTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // Set while this tab's password change is in flight (holdSessionEnd); a 1008 meanwhile
    // only records the token its socket ran on, and is decided once the change settles.
    let pendingChange: { revokedToken: string | null } | null = null;
    // The GET /user/me check after a refused CONNECT; close() drops it, as it drops retryTimer.
    let pendingCheck: Promise<void> | null = null;

    const setState = (next: Partial<GameSocketState>) => {
        state = { ...state, ...next };
        listeners.forEach((listener) => listener());
    };

    const attach = (destination: string, route: Route) => {
        if (!client || !connected || route.stomp) return;
        route.stomp = client.subscribe(destination, (message) => {
            route.handlers.forEach((handler) => handler(message.body));
        });
    };

    const open = () => {
        if (client) return;
        // read on every attempt: a retry or reconnect() never reuses a rotated or cleared token
        const token = getToken();
        if (!token) {
            setState({ isConnecting: false, error: 'Authentication required' });
            return;
        }
        // An ERROR frame means the server refused us. Its text is the server's (never shown):
        // GET /user/me tells a dead session from a passing failure once the socket closes.
        let refused = false;
        const created: StompClientLike = createClient(token, {
            onConnect: () => {
                if (client !== created) return;
                connected = true;
                reconnectAttempts = 0;
                routes.forEach((route, destination) => attach(destination, route));
                setState({ isConnected: true, isConnecting: false, error: null });
            },
            onStompError: () => {
                if (client !== created) return;
                refused = true;
            },
            onWebSocketClose: (code) => {
                // a socket replaced by reconnect() may still report its close; ignore it
                if (client !== created) return;
                client = null;
                connected = false;
                routes.forEach((route) => { route.stomp = null; });
                setState({ isConnected: false, isConnecting: false });
                if (code === CLOSE_POLICY_VIOLATION) {
                    tokenRevoked(token);
                    return;
                }
                // 1000/1001 are retried too: the server sends 1001 when it stops (deploy) and SockJS
                // reports a lost heartbeat as 1000. Our own closes never get here (client !== created).
                if (holders === 0) return;
                if (refused) {
                    checkRefusal();
                    return;
                }
                retryLater();
            },
        });
        client = created;
        setState({ isConnecting: true, error: null });
        created.activate();
    };

    const retryLater = () => {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            setState({ error: 'Failed to connect after multiple attempts' });
            return;
        }
        const delay = RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts;
        reconnectAttempts += 1;
        retryTimer = setTimeout(() => {
            retryTimer = null;
            if (holders > 0) open();
        }, delay);
    };

    // After a refused CONNECT (lane-email contract, WebSocket): a 401 from GET /user/me means the
    // session is over, and api.ts has already handed it to tokenRevoked; a 503 or no answer is
    // retried like a lost socket; a 200 means the session is alive, so say so plainly and retry.
    const checkRefusal = () => {
        const check: Promise<void> = checkSession().then(
            () => {
                if (pendingCheck !== check) return;
                pendingCheck = null;
                setState({ error: CONNECT_REFUSED_MESSAGE });
                retryLater();
            },
            (error: unknown) => {
                if (pendingCheck !== check) return;
                pendingCheck = null;
                if (error instanceof ApiError && error.invalidToken) return;
                retryLater();
            },
        );
        pendingCheck = check;
    };

    const tokenRevoked = (token: string) => {
        // This tab's own password change: its 200 with the new token is still to come
        if (pendingChange) {
            pendingChange.revokedToken = token;
            return;
        }
        // The server refused this token (a 401 from the API, a 1008 on this socket: logout,
        // password change, expiry). A different token in storage means the tab's session went
        // on (the password was changed since): carry on with it. Otherwise it is over.
        const current = getToken();
        if (current && current !== token) {
            if (holders > 0) open();
            return;
        }
        setState({ error: SESSION_ENDED_MESSAGE });
        endSession();
    };

    const close = () => {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        pendingCheck = null;
        const old = client;
        client = null;
        connected = false;
        routes.forEach((route) => { route.stomp = null; });
        if (old) old.deactivate();
        setState({ isConnected: false, isConnecting: false });
    };

    return {
        /** Hold the connection while mounted; call the returned function on unmount. */
        acquire(): () => void {
            holders += 1;
            if (releaseTimer) {
                clearTimeout(releaseTimer);
                releaseTimer = null;
            }
            open();
            let released = false;
            return () => {
                if (released) return;
                released = true;
                holders -= 1;
                if (holders > 0) return;
                releaseTimer = setTimeout(() => {
                    releaseTimer = null;
                    if (holders === 0) close();
                }, RELEASE_GRACE_MS);
            };
        },

        /** Listen on a destination; works before the connection is up. Returns the unsubscribe. */
        subscribe(destination: string, handler: (body: string) => void): () => void {
            let route = routes.get(destination);
            if (!route) {
                route = { handlers: new Set(), stomp: null };
                routes.set(destination, route);
            }
            route.handlers.add(handler);
            attach(destination, route);
            return () => {
                const current = routes.get(destination);
                if (!current || !current.handlers.delete(handler)) return;
                if (current.handlers.size > 0) return;
                routes.delete(destination);
                try {
                    current.stomp?.unsubscribe();
                } catch {
                    // the socket is already gone
                }
            };
        },

        /** Send JSON to an /app destination; false when not connected. */
        publish(destination: string, body: unknown): boolean {
            if (!client || !connected) return false;
            client.publish({ destination, body: JSON.stringify(body ?? {}) });
            return true;
        },

        /**
         * The one way a session ends: call it with a token the server refused (a 401 that names
         * the token, a 1008 on the socket). While a password change is held it waits for the
         * change; a different token in storage carries on; otherwise the tab signs out.
         */
        tokenRevoked,

        /** Reopen with the token now in storage (after a password change rotated it). */
        reconnect(): void {
            reconnectAttempts = 0;
            close();
            if (holders > 0) open();
        },

        /**
         * Call before sending a password change, and call the returned function once it has
         * settled (after storing the new token). The server closes this user's sockets with
         * 1008 before its 200 brings that token, so until then a 1008 does not sign the tab
         * out; afterwards it is decided as usual: carry on if a new token is stored, else end.
         */
        holdSessionEnd(): () => void {
            const change: { revokedToken: string | null } = { revokedToken: null };
            pendingChange = change;
            return () => {
                if (pendingChange !== change) return;
                pendingChange = null;
                if (change.revokedToken !== null) tokenRevoked(change.revokedToken);
            };
        },

        /**
         * Close now, whoever holds it. Logout calls it before it posts: the server closes
         * the socket with 1008 as it logs the token out, which would read as "session ended".
         */
        disconnect(): void {
            close();
        },

        getState: (): GameSocketState => state,

        onStateChange: (listener: () => void): (() => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

export type GameSocket = ReturnType<typeof createGameSocket>;

export const gameSocket: GameSocket = createGameSocket();
