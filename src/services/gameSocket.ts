import { Client, type IFrame, type IMessage, type StompConfig, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

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

/** Treated like a 401 from the API: forget the token, then reload into the login page, which says why. */
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
        // An ERROR frame means the server refused us (bad or revoked token): retrying
        // with the same token cannot succeed.
        let refused = false;
        const created: StompClientLike = createClient(token, {
            onConnect: () => {
                if (client !== created) return;
                connected = true;
                reconnectAttempts = 0;
                routes.forEach((route, destination) => attach(destination, route));
                setState({ isConnected: true, isConnecting: false, error: null });
            },
            onStompError: (message) => {
                if (client !== created) return;
                refused = true;
                setState({ error: message });
            },
            onWebSocketClose: (code) => {
                // a socket replaced by reconnect() may still report its close; ignore it
                if (client !== created) return;
                client = null;
                connected = false;
                routes.forEach((route) => { route.stomp = null; });
                setState({ isConnected: false, isConnecting: false });
                if (code === CLOSE_POLICY_VIOLATION) {
                    // The server revoked the token this socket ran on (logout, password change,
                    // expiry). A different token in storage means the tab's session went on (the
                    // password was changed in another tab): carry on with it. Otherwise it is over.
                    const current = getToken();
                    if (current && current !== token) {
                        if (holders > 0) open();
                        return;
                    }
                    setState({ error: SESSION_ENDED_MESSAGE });
                    endSession();
                    return;
                }
                // 1000/1001 are retried too: the server sends 1001 when it stops (deploy) and SockJS
                // reports a lost heartbeat as 1000. Our own closes never get here (client !== created).
                if (refused || holders === 0) return;
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
            },
        });
        client = created;
        setState({ isConnecting: true, error: null });
        created.activate();
    };

    const close = () => {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
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

        /** Reopen with the token now in storage (after a password change rotated it). */
        reconnect(): void {
            reconnectAttempts = 0;
            close();
            if (holders > 0) open();
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
