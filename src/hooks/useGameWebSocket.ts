// src/hooks/useGameWebSocket.ts
import { useCallback, useRef, useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { Client, type Frame, type IMessage, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/* ---------- Shared DTOs (keep in sync with backend) ---------- */
export interface QueueStatusDTO {
    state: 'IN_QUEUE' | 'MATCH_FOUND' | 'CANCELLED';
    estWaitSeconds: number;
    queueSize: number;
    mmr: number;
    matchId?: string;
}

export interface MatchDTO {
    id: string;
    lobbyId?: string;
    teamA: PlayerPublicInfo[];
    teamB: PlayerPublicInfo[];
    status: string;
    createdAt: string;
}

export interface PlayerPublicInfo {
    username: string;
    playerId: string;
    handSize: number;
}

export interface Card {
    suit: string;
    rank: string;
}

export interface TrickPlay { playerId: string; card: Card; }
export interface Trick { plays: TrickPlay[]; winnerPlayerId: string | null; }

export interface BidDTO {
    playerId: string;
    action: string;            // 'PASS' | 'CALL_TRUMP' (backend maps from pass/trump)
    selectedTrump: string | null;
}

export interface PublicGameView {
    gameId: string;
    gameState: 'BIDDING' | 'PLAYING' | 'COMPLETED';
    bids: BidDTO[];
    currentTrick: Trick;
    teamAScore: number;
    teamBScore: number;
    teamA: PlayerPublicInfo[];
    teamB: PlayerPublicInfo[];
    challengeUsedByPlayer: Record<string, boolean>;
    winnerTeamId?: string | null;
    tieBreaker: boolean;
    seatingOrder: PlayerPublicInfo[];
}

export interface PrivateGameView {
    publicPart: PublicGameView;
    hand: Card[];
    yourTurn: boolean;
    challengeUsed: boolean;
}

export interface PlayCardMsg {
    playerId: string;
    card: Card;
    declareBela: boolean;
}

interface GameWebSocketOptions {
    wsPath?: string; // default '/ws'
    onQueueStatusUpdate?: (status: QueueStatusDTO) => void;
    onMatchFound?: (match: MatchDTO) => void;
    onPublicGameUpdate?: (view: PublicGameView) => void;
    onPrivateGameUpdate?: (view: PrivateGameView) => void;
    onGameDisconnect?: () => void;
}

export function useGameWebSocket(options: GameWebSocketOptions = {}) {
    const { user, token, isAuthenticated, isLoading } = useAuth();

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const clientRef = useRef<Client | null>(null);
    const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
    const reconnectAttempts = useRef(0);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const connectPromiseRef = useRef<Promise<void> | null>(null);
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const resetReconnectAttempts = useCallback(() => {
        reconnectAttempts.current = 0;
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    }, []);

    const checkServerHealth = useCallback(async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch('/actuator/health', { signal: controller.signal, method: 'GET', headers, mode: 'cors' });
            clearTimeout(timeoutId);
            return response.ok;
        } catch {
            return false;
        }
    }, [token]);

    const connect = useCallback(async (): Promise<void> => {
        if (connectPromiseRef.current) return connectPromiseRef.current;

        if (isLoading) {
            setConnectionError('Authentication still loading');
            return Promise.reject(new Error('Authentication still loading'));
        }
        if (!isAuthenticated) {
            setConnectionError('Authentication required');
            return Promise.reject(new Error('Authentication required'));
        }
        if (!user?.username) {
            setConnectionError('Username not available');
            return Promise.reject(new Error('Username not available'));
        }
        if (isConnected) return Promise.resolve();

        const healthy = await checkServerHealth();
        if (!healthy) {
            setConnectionError('Not connected to the server');
            setIsConnecting(false);
            return Promise.reject(new Error('Server not healthy'));
        }

        setIsConnecting(true);
        setConnectionError(null);

        connectPromiseRef.current = new Promise<void>((resolve, reject) => {
            try {
                if (clientRef.current) {
                    clientRef.current.deactivate();
                    clientRef.current = null;
                }

                const client = new Client({
                    webSocketFactory: () => {
                        const base = optionsRef.current.wsPath || '/ws';
                        const wsUrl = user?.username ? `${base}?user=${encodeURIComponent(user.username)}` : base;
                        const sock = new SockJS(wsUrl);
                        return sock;
                    },
                    connectHeaders: (() => {
                        const headers: Record<string, string> = {};
                        if (user?.username) {
                            headers['X-Player-Name'] = user.username;
                            headers['login'] = user.username;
                        }
                        if (token) {
                            headers['Authorization'] = `Bearer ${token}`;
                            headers['auth-token'] = token;
                        }
                        return headers;
                    })(),
                    heartbeatIncoming: 4000,
                    heartbeatOutgoing: 4000,
                    debug: (str) => console.log('STOMP:', str),
                    reconnectDelay: 0,
                    onConnect: (frame: Frame) => {
                        setIsConnected(true);
                        setIsConnecting(false);
                        setConnectionError(null);
                        resetReconnectAttempts();
                        connectPromiseRef.current = null;
                        resolve();
                    },
                    onStompError: (frame: Frame) => {
                        const msg = frame.headers['message'] || frame.body || 'STOMP connection failed';
                        setConnectionError(msg);
                        setIsConnected(false);
                        setIsConnecting(false);
                        connectPromiseRef.current = null;
                        reject(new Error(msg));
                    },
                    onWebSocketError: () => {
                        setConnectionError('WebSocket connection failed');
                        setIsConnected(false);
                        setIsConnecting(false);
                        connectPromiseRef.current = null;
                        reject(new Error('WebSocket connection failed'));
                    },
                    onWebSocketClose: (event: CloseEvent) => {
                        subscriptionsRef.current.forEach((s) => {
                            try { s.unsubscribe(); } catch {}
                        });
                        subscriptionsRef.current.clear();
                        setIsConnected(false);
                        setIsConnecting(false);
                        connectPromiseRef.current = null;

                        if (event.code !== 1000 && event.code !== 1001) {
                            const maxAttempts = 3;
                            const baseDelay = 5000;
                            if (reconnectAttempts.current < maxAttempts) {
                                const delay = baseDelay * Math.pow(2, reconnectAttempts.current);
                                reconnectTimeoutRef.current = window.setTimeout(() => {
                                    reconnectAttempts.current += 1;
                                    connect().catch(() => undefined);
                                }, delay);
                            } else {
                                setConnectionError('Failed to connect after multiple attempts');
                            }
                        }
                    },
                });

                clientRef.current = client;
                client.activate();
            } catch (error) {
                setIsConnecting(false);
                setConnectionError('Failed to initialize WebSocket connection');
                connectPromiseRef.current = null;
                reject(error as Error);
            }
        });

        return connectPromiseRef.current;
    }, [isLoading, isAuthenticated, user, token, isConnected, checkServerHealth, resetReconnectAttempts]);

    useEffect(() => {
        if (!isLoading && isAuthenticated && user?.username && !isConnected && !isConnecting && !connectionError) {
            connect().catch(() => undefined);
        }
    }, [connect, isLoading, isAuthenticated, user?.username, isConnected, isConnecting, connectionError]);

    /* ---------- Generic surfaces ---------- */
    const getClient = useCallback(() => clientRef.current, []);
    const send = useCallback((destination: string, body?: unknown, headers: Record<string, string> = {}) => {
        if (!clientRef.current || !isConnected) throw new Error('STOMP not connected');
        clientRef.current.publish({ destination, headers, body: body ? JSON.stringify(body) : '' });
    }, [isConnected]);

    const subscribe = useCallback(
        (destination: string, onMessage: (m: IMessage) => void, key?: string) => {
            if (!clientRef.current || !isConnected) return undefined;
            if (key) {
                try { subscriptionsRef.current.get(key)?.unsubscribe?.(); } catch {}
                subscriptionsRef.current.delete(key);
            }
            const sub = clientRef.current.subscribe(destination, onMessage);
            if (key) subscriptionsRef.current.set(key, sub);
            return sub;
        },
        [isConnected]
    );

    const ready = useCallback(async () => {
        if (!isConnected && !isConnecting) await connect();
    }, [isConnected, isConnecting, connect]);

    const disconnect = useCallback(() => {
        try {
            subscriptionsRef.current.forEach((s) => { try { s.unsubscribe(); } catch {} });
            subscriptionsRef.current.clear();
            clientRef.current?.deactivate();
            clientRef.current = null;
            setIsConnected(false);
        } catch {}
    }, []);

    /* ---------- Ranked queue channels ---------- */
    const subscribeToRankedQueue = useCallback(() => {
        if (!clientRef.current || !isConnected) return;
        const c = clientRef.current;

        const qKey = 'queueStatus';
        const mKey = 'matchFound';
        try { subscriptionsRef.current.get(qKey)?.unsubscribe?.(); } catch {}
        try { subscriptionsRef.current.get(mKey)?.unsubscribe?.(); } catch {}
        subscriptionsRef.current.delete(qKey);
        subscriptionsRef.current.delete(mKey);

        const qSub = c.subscribe('/user/queue/ranked/status', (msg: IMessage) => {
            try {
                const dto: QueueStatusDTO = JSON.parse(msg.body);
                optionsRef.current.onQueueStatusUpdate?.(dto);
            } catch (e) {
                console.warn('queue status parse failed', e);
            }
        });

        const mSub = c.subscribe('/user/queue/match-found', (msg: IMessage) => {
            try {
                const dto: MatchDTO = JSON.parse(msg.body);
                optionsRef.current.onMatchFound?.(dto);
            } catch (e) {
                console.warn('match-found parse failed', e);
            }
        });

        subscriptionsRef.current.set(qKey, qSub);
        subscriptionsRef.current.set(mKey, mSub);
    }, [isConnected]);

    const unsubscribeFromRankedQueue = useCallback(() => {
        const qKey = 'queueStatus';
        const mKey = 'matchFound';
        try { subscriptionsRef.current.get(qKey)?.unsubscribe?.(); } catch {}
        try { subscriptionsRef.current.get(mKey)?.unsubscribe?.(); } catch {}
        subscriptionsRef.current.delete(qKey);
        subscriptionsRef.current.delete(mKey);
    }, []);

    /* ---------- Game channels ---------- */
    const subscribeToGame = useCallback((gameId: string) => {
        if (!clientRef.current || !isConnected) return;

        const pubKey = `game-${gameId}-public`;
        const prvKey = `game-${gameId}-private`;
        try { subscriptionsRef.current.get(pubKey)?.unsubscribe?.(); } catch {}
        try { subscriptionsRef.current.get(prvKey)?.unsubscribe?.(); } catch {}
        subscriptionsRef.current.delete(pubKey);
        subscriptionsRef.current.delete(prvKey);

        const pub = clientRef.current.subscribe(`/topic/games/${gameId}`, (message: IMessage) => {
            try {
                if (message.body === 'DISCONNECT') {
                    optionsRef.current.onGameDisconnect?.();
                    return;
                }
                const view: PublicGameView = JSON.parse(message.body);
                optionsRef.current.onPublicGameUpdate?.(view);
            } catch (e) {
                console.error('public game parse failed', e);
            }
        });

        const prv = clientRef.current.subscribe(`/user/queue/games/${gameId}`, (message: IMessage) => {
            try {
                const view: PrivateGameView = JSON.parse(message.body);
                optionsRef.current.onPrivateGameUpdate?.(view);
            } catch (e) {
                console.error('private game parse failed', e);
            }
        });

        subscriptionsRef.current.set(pubKey, pub);
        subscriptionsRef.current.set(prvKey, prv);
    }, [isConnected]);

    const unsubscribeFromGame = useCallback((gameId: string) => {
        const pubKey = `game-${gameId}-public`;
        const prvKey = `game-${gameId}-private`;
        try { subscriptionsRef.current.get(pubKey)?.unsubscribe?.(); } catch {}
        try { subscriptionsRef.current.get(prvKey)?.unsubscribe?.(); } catch {}
        subscriptionsRef.current.delete(pubKey);
        subscriptionsRef.current.delete(prvKey);
    }, []);

    /* ---------- Actions ---------- */
    const playCard = useCallback((gameId: string, card: Card, declareBela: boolean) => {
        if (!clientRef.current || !isConnected || !user?.username) return;
        const payload: PlayCardMsg = { playerId: user.username, card, declareBela };
        send(`/app/games/${gameId}/play`, payload);
    }, [isConnected, user, send]);

    const placeBid = useCallback((gameId: string, pass: boolean, trump?: string) => {
        if (!clientRef.current || !isConnected || !user?.username) return;
        const payload = { playerId: user.username, pass, trump: trump || null };
        send(`/app/games/${gameId}/bid`, payload);
    }, [isConnected, user, send]);

    const challenge = useCallback((gameId: string) => {
        if (!clientRef.current || !isConnected || !user?.username) return;
        send(`/app/games/${gameId}/challenge`, { playerId: user.username });
    }, [isConnected, user, send]);

    const refreshGameState = useCallback((gameId: string) => {
        if (!clientRef.current || !isConnected) return;
        send(`/app/games/${gameId}/refresh`, {});
    }, [isConnected, send]);

    const cancelMatch = useCallback((gameId: string) => {
        if (!clientRef.current || !isConnected) return;
        send(`/app/games/${gameId}/cancel`, {});
    }, [isConnected, send]);

    return {
        // status
        isConnected,
        isConnecting,
        connectionError,

        // lifecycle
        connect,
        disconnect,
        ready,

        // low-level
        getClient,
        send,
        subscribe,

        // ranked queue
        subscribeToRankedQueue,
        unsubscribeFromRankedQueue,

        // game
        subscribeToGame,
        unsubscribeFromGame,

        // actions
        playCard,
        placeBid,
        challenge,
        refreshGameState,
        cancelMatch,
    };
}
