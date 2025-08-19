import { useCallback, useRef, useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { Client, type Frame, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface QueueStatusDTO {
    state: 'IN_QUEUE' | 'MATCH_FOUND' | 'CANCELLED';
    estWaitSeconds: number;    // ← Fixed: was estimatedWaitTime
    queueSize: number;
    mmr: number;               // ← Added: was missing
    matchId?: string;          // ← Keep optional since it might not always be present
}


export interface MatchDTO {
    id: string;
    lobbyId?: string;
    teamA: PlayerInfo[];
    teamB: PlayerInfo[];
    status: string;
    createdAt: string;
}

export interface PlayerInfo {
    id: string;
    username: string;
    cardCount?: number;
}
export interface BidDTO {
    playerId: string;
    action: string; // e.g., 'PASS', 'CALL_TRUMP'
    selectedTrump: string | null; // trump suit when relevant
}
export interface Trick {
    plays: TrickPlay[];
    winnerPlayerId: string | null;
}

export interface TrickPlay {
    playerId: string;
    card: Card;
}
export interface PlayerPublicInfo {
    username: string;
    playerId: string;
    handSize: number; // count only; no card details
}


export interface PublicGameView {
    gameId: string;
    gameState: 'BIDDING' | 'PLAYING' | 'COMPLETED';
    bids: BidDTO[]; // FIXED: Now properly typed instead of any[]
    currentTrick: Trick; // FIXED: Now properly typed instead of any
    teamAScore: number;
    teamBScore: number;
    teamA: PlayerPublicInfo[]; // FIXED: Now uses PlayerPublicInfo instead of PlayerInfo
    teamB: PlayerPublicInfo[]; // FIXED: Now uses PlayerPublicInfo instead of PlayerInfo
    challengeUsedByPlayer: Record<string, boolean>;
    winnerTeamId?: string | null; // FIXED: Added null option
    tieBreaker: boolean; // FIXED: Now required instead of optional
    seatingOrder: PlayerPublicInfo[]; // NEW: Added missing seatingOrder field
}


export interface PrivateGameView {
    publicPart: PublicGameView;
    hand: Card[];
    yourTurn: boolean;
    challengeUsed: boolean;
}


export interface Card {
    suit: string;
    rank: string;
}

export interface PlayCardMsg {
    playerId: string;
    card: Card;
    declareBela: boolean;
}

interface GameWebSocketOptions {
    onQueueStatusUpdate?: (status: QueueStatusDTO) => void;
    onMatchFound?: (match: MatchDTO) => void;
    onPublicGameUpdate?: (gameView: PublicGameView) => void;
    onPrivateGameUpdate?: (gameView: PrivateGameView) => void;
    onGameDisconnect?: () => void;
}

export function useGameWebSocket(options: GameWebSocketOptions = {}) {
    const { user, token, isAuthenticated, isLoading } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const clientRef = useRef<Client | null>(null);
    const subscriptionsRef = useRef<Map<string, any>>(new Map());
    const reconnectTimeoutRef = useRef<number | null>(null);
    const reconnectAttempts = useRef(0);
    const connectPromiseRef = useRef<Promise<void> | null>(null);

    // 🔥 FIX: Use ref for options to prevent callback recreation
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const checkServerHealth = useCallback(async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }


            const healthUrl = '/actuator/health';

            const response = await fetch(healthUrl, {
                signal: controller.signal,
                method: 'GET',
                headers,
                mode: 'cors',
            });

            clearTimeout(timeoutId);
            console.log('Health check response:', response.status, response.statusText);
            return response.ok;
        } catch (error) {
            console.log('Server health check failed:', error);
            return false;
        }
    }, [token]);

    // Reset reconnect attempts on successful connection
    const resetReconnectAttempts = useCallback(() => {
        reconnectAttempts.current = 0;
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    }, []);
    const unsubscribeFromRankedQueue = useCallback(() => {
        console.log('🔇 Unsubscribing from ranked queue channels...');

        const existingQueueSub = subscriptionsRef.current.get('queueStatus');
        const existingMatchSub = subscriptionsRef.current.get('matchFound');

        if (existingQueueSub) {
            console.log('🧹 Unsubscribing from queue status updates...');
            try {
                existingQueueSub.unsubscribe();
            } catch (error) {
                console.warn('Failed to unsubscribe from queue subscription:', error);
            }
            subscriptionsRef.current.delete('queueStatus');
        }

        if (existingMatchSub) {
            console.log('🧹 Unsubscribing from match found notifications...');
            try {
                existingMatchSub.unsubscribe();
            } catch (error) {
                console.warn('Failed to unsubscribe from match subscription:', error);
            }
            subscriptionsRef.current.delete('matchFound');
        }

        console.log('✅ Unsubscribed from ranked queue channels');
    }, []);



    const connect = useCallback(async () => {
        // Return existing connection promise if already connecting
        if (connectPromiseRef.current) {
            console.log('Connection already in progress, returning existing promise');
            return connectPromiseRef.current;
        }

        // Add detailed logging for debugging
        console.log('=== WebSocket Connect Debug ===');
        console.log('Auth loading:', isLoading);
        console.log('Is authenticated:', isAuthenticated);
        console.log('Full user object:', user);
        console.log('User username:', user?.username);
        console.log('Token:', token ? `${token.substring(0, 20)}...` : 'No token');
        console.log('Environment:', import.meta.env.DEV ? 'development' : 'production');

        // Wait for auth to finish loading - MOST IMPORTANT FIX
        if (isLoading) {
            console.log('Auth is still loading, cannot connect yet');
            setConnectionError('Authentication still loading');
            return Promise.reject(new Error('Authentication still loading'));
        }

        // Check if user exists and has username
        if (!isAuthenticated) {
            console.warn('Cannot connect: Not authenticated');
            setConnectionError('Authentication required');
            return Promise.reject(new Error('Authentication required'));
        }

        if (!user) {
            console.warn('Cannot connect: No user data available');
            setConnectionError('User data not available');
            return Promise.reject(new Error('User data not available'));
        }

        if (!user.username) {
            console.warn('Cannot connect: Username not available');
            setConnectionError('Username not available');
            return Promise.reject(new Error('Username not available'));
        }

        // Don't connect if already connected
        if (isConnected) {
            console.log('Already connected, skipping...');
            return Promise.resolve();
        }

        // Check server health before attempting WebSocket connection
        const isServerHealthy = await checkServerHealth();
        if (!isServerHealthy) {
            const errorMessage = 'Not connected to the server';
            setConnectionError(errorMessage);
            setIsConnecting(false);
            return Promise.reject(new Error(errorMessage));
        }

        setIsConnecting(true);
        setConnectionError(null);

        // Create and store the connection promise
        connectPromiseRef.current = new Promise<void>((resolve, reject) => {
            try {
                console.log('Attempting to connect WebSocket for user:', user.username);

                // Clean up existing client if any
                if (clientRef.current) {
                    console.log('Deactivating existing STOMP client...');
                    clientRef.current.deactivate();
                    clientRef.current = null;
                }

                const client = new Client({
                    webSocketFactory: () => {
                        console.log('=== Creating SockJS connection ===');

                        // Try the username query parameter approach first (simpler to debug)
                        let wsUrl = '/ws';
                        if (user?.username) {
                            wsUrl = `/ws?user=${encodeURIComponent(user.username)}`;
                            console.log('Using WebSocket URL with username query parameter:', wsUrl);
                        } else {
                            console.error('No username available for WebSocket connection');
                        }

                        const sockjs = new SockJS(wsUrl);

                        sockjs.onopen = () => {
                            console.log('✅ SockJS transport opened successfully');
                            console.log('Transport URL:', sockjs.url);
                            console.log('Transport protocol:', sockjs.protocol);
                        };

                        sockjs.onclose = (e) => {
                            console.log('❌ SockJS transport closed:', {
                                code: e.code,
                                reason: e.reason,
                                wasClean: e.wasClean
                            });
                        };

                        sockjs.onerror = (e) => {
                            console.error('💥 SockJS transport error:', e);
                        };

                        return sockjs;
                    },

                    // For debugging, let's also add the username to STOMP headers
                    connectHeaders: (() => {
                        const headers: Record<string, string> = {};

                        if (user?.username) {
                            console.log('Adding username to STOMP connect headers as X-Player-Name');
                            headers['X-Player-Name'] = user.username;

                            // Also try the login header (some implementations use this)
                            headers['login'] = user.username;
                        }

                        if (token) {
                            console.log('Adding JWT token to STOMP connect headers');
                            headers['Authorization'] = `Bearer ${token}`;

                            // Some implementations might expect just the token without Bearer
                            headers['auth-token'] = token;
                        }

                        console.log('STOMP connect headers:', headers);
                        return headers;
                    })(),

                    debug: (str) => {
                        console.log('🔍 STOMP Debug:', str);
                    },

                    reconnectDelay: 0,
                    heartbeatIncoming: 4000,
                    heartbeatOutgoing: 4000,

                    onConnect: (frame: Frame) => {
                        console.log('🎉 === STOMP Connected Successfully ===');
                        console.log('Full connection frame:', frame);
                        console.log('Connection frame headers:', frame.headers);

                        // Check what the server says about our identity
                        const serverUser = frame.headers['user-name'] || frame.headers['user'] || frame.headers['principal'];
                        if (serverUser) {
                            console.log('✅ Server confirmed user identity:', serverUser);
                        } else {
                            console.warn('⚠️ No user identity found in connection frame headers');
                            console.log('Available frame headers:', Object.keys(frame.headers));
                        }

                        setIsConnected(true);
                        setIsConnecting(false);
                        setConnectionError(null);
                        resetReconnectAttempts();
                        connectPromiseRef.current = null;
                        resolve();
                    },

                    onStompError: (frame: Frame) => {
                        console.error('💥 === STOMP Connection Error ===');
                        console.error('Error frame:', frame);
                        console.error('Error headers:', frame.headers);
                        console.error('Error body:', frame.body);

                        const errorMessage = frame.headers['message'] || frame.body || 'STOMP connection failed';
                        console.error('Parsed error message:', errorMessage);

                        // Check for authentication-related errors
                        const isAuthError = errorMessage.toLowerCase().includes('auth') ||
                            errorMessage.toLowerCase().includes('unauthorized') ||
                            errorMessage.toLowerCase().includes('user') ||
                            errorMessage.toLowerCase().includes('principal') ||
                            errorMessage.toLowerCase().includes('forbidden') ||
                            errorMessage.toLowerCase().includes('access denied');

                        if (isAuthError) {
                            console.error('🔒 Authentication failed - backend rejected user identity');
                            setConnectionError('Authentication failed - backend could not identify user');
                        } else {
                            setConnectionError(`Connection failed: ${errorMessage}`);
                        }

                        setIsConnected(false);
                        setIsConnecting(false);
                        connectPromiseRef.current = null;
                        reject(new Error(errorMessage));
                    },

                    onWebSocketClose: (event: CloseEvent) => {
                        console.log('WebSocket closed:', event.code, event.reason, event.wasClean);

                        // 🔥 FORCE CLEANUP: Unsubscribe from all subscriptions
                        subscriptionsRef.current.forEach((subscription, key) => {
                            try {
                                console.log(`🧹 Force unsubscribing from ${key} on close...`);
                                subscription.unsubscribe();
                            } catch (error) {
                                console.warn(`Failed to unsubscribe from ${key} on close:`, error);
                            }
                        });
                        subscriptionsRef.current.clear();

                        setIsConnected(false);
                        setIsConnecting(false);
                        connectPromiseRef.current = null;

                        // Only auto-reconnect if it wasn't a manual disconnect
                        if (event.code !== 1000 && event.code !== 1001) {
                            const maxAttempts = 3;
                            const baseDelay = 5000;

                            if (reconnectAttempts.current < maxAttempts) {
                                const delay = baseDelay * Math.pow(2, reconnectAttempts.current);
                                console.log(`Scheduling reconnect attempt ${reconnectAttempts.current + 1}/${maxAttempts} in ${delay}ms`);

                                reconnectTimeoutRef.current = window.setTimeout(() => {
                                    reconnectAttempts.current++;
                                    connect().catch(error => {
                                        console.error('Reconnection failed:', error);
                                    });
                                }, delay);
                            } else {
                                console.log('Max reconnection attempts reached');
                                setConnectionError('Failed to connect after multiple attempts');
                            }
                        }
                    },

                    onWebSocketError: (event: Event) => {
                        console.error('WebSocket error:', event);
                        setConnectionError('WebSocket connection failed');
                        setIsConnected(false);
                        setIsConnecting(false);
                        connectPromiseRef.current = null;
                        reject(new Error('WebSocket connection failed'));
                    },
                });

                clientRef.current = client;
                console.log('Activating STOMP client...');
                client.activate();
            } catch (error) {
                console.error('Error during WebSocket connection setup:', error);
                setIsConnecting(false);
                setConnectionError('Failed to initialize WebSocket connection');
                connectPromiseRef.current = null;
                reject(error);
            }
        });

        return connectPromiseRef.current;
    }, [user, token, isAuthenticated, isLoading, isConnected, checkServerHealth, resetReconnectAttempts]);

    // Auto-connect when auth becomes ready
    useEffect(() => {
        if (!isLoading && isAuthenticated && user?.username && !isConnected && !isConnecting && !connectionError) {
            console.log('Auth is ready, attempting auto-connect...');
            connect().catch((error: any) => {
                console.error('Auto-connect failed:', error);
            });
        }
    }, [connect, isLoading, isAuthenticated, user, isConnected, isConnecting, connectionError]);

    const disconnect = useCallback(() => {
        console.log('Disconnecting WebSocket...');
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        // 🔥 FIX: Properly unsubscribe before clearing
        subscriptionsRef.current.forEach((subscription, key) => {
            try {
                console.log(`Unsubscribing from ${key}...`);
                subscription.unsubscribe();
            } catch (error) {
                console.warn(`Failed to unsubscribe from ${key}:`, error);
            }
        });
        subscriptionsRef.current.clear();

        if (clientRef.current) {
            clientRef.current.deactivate();
            clientRef.current = null;
        }

        connectPromiseRef.current = null;
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionError(null);
    }, []);

    const subscribeToRankedQueue = useCallback(() => {
        if (!clientRef.current || !isConnected) {
            console.warn('Cannot subscribe: WebSocket not connected');
            return;
        }

        // 🔥 FORCE CLEANUP: Always unsubscribe from existing subscriptions first
        const existingQueueSub = subscriptionsRef.current.get('queueStatus');
        const existingMatchSub = subscriptionsRef.current.get('matchFound');

        if (existingQueueSub) {
            console.log('🧹 Cleaning up existing queue subscription...');
            try {
                existingQueueSub.unsubscribe();
            } catch (error) {
                console.warn('Failed to unsubscribe from existing queue subscription:', error);
            }
            subscriptionsRef.current.delete('queueStatus');
        }

        if (existingMatchSub) {
            console.log('🧹 Cleaning up existing match subscription...');
            try {
                existingMatchSub.unsubscribe();
            } catch (error) {
                console.warn('Failed to unsubscribe from existing match subscription:', error);
            }
            subscriptionsRef.current.delete('matchFound');
        }

        console.log('Subscribing to ranked queue channels...');
        const client = clientRef.current;

        // Subscribe to queue status updates
        const queueSubscription = client.subscribe('/user/queue/ranked/status', (message: IMessage) => {
            try {
                console.log('Received queue status update:', message.body);
                const status: QueueStatusDTO = JSON.parse(message.body);
                optionsRef.current.onQueueStatusUpdate?.(status);
            } catch (error) {
                console.error('Failed to parse queue status message:', error);
            }
        });

        const matchSubscription = client.subscribe('/user/queue/match-found', (message: IMessage) => {
            try {
                console.log('Received match found notification:', message.body);
                const match: MatchDTO = JSON.parse(message.body);
                optionsRef.current.onMatchFound?.(match);
            } catch (error) {
                console.error('Failed to parse match message:', error);
            }
        });

        subscriptionsRef.current.set('queueStatus', queueSubscription);
        subscriptionsRef.current.set('matchFound', matchSubscription);
        console.log('✅ Successfully subscribed to ranked queue channels');
    }, [isConnected]);

    const subscribeToGame = useCallback((gameId: string) => {
        if (!clientRef.current || !isConnected) {
            console.warn('Cannot subscribe to game: WebSocket not connected');
            return;
        }

        console.log('Subscribing to game channels for gameId:', gameId);
        const client = clientRef.current;

        // Subscribe to public game updates - corrected channel format
        const publicSubscription = client.subscribe(`/topic/games/${gameId}`, (message: IMessage) => {
            try {
                console.log('Received public game update:', message.body);
                const gameView: PublicGameView = JSON.parse(message.body);
                optionsRef.current.onPublicGameUpdate?.(gameView);
            } catch (error) {
                console.error('Failed to parse public game message:', error);
            }
        });

        // Subscribe to private game updates - corrected channel format
        const privateSubscription = client.subscribe(`/user/queue/games/${gameId}`, (message: IMessage) => {
            try {
                console.log('Received private game update:', message.body);
                const gameView: PrivateGameView = JSON.parse(message.body);
                optionsRef.current.onPrivateGameUpdate?.(gameView);
            } catch (error) {
                console.error('Failed to parse private game message:', error);
            }
        });

        subscriptionsRef.current.set(`game-${gameId}-public`, publicSubscription);
        subscriptionsRef.current.set(`game-${gameId}-private`, privateSubscription);
        console.log('Successfully subscribed to game channels');
    }, [isConnected]);

    const playCard = useCallback((gameId: string, card: Card, declareBela: boolean) => {
        if (!clientRef.current || !isConnected || !user?.username) {
            console.warn('Cannot play card: WebSocket not connected or user not available');
            return;
        }

        console.log('Playing card:', card, 'declareBela:', declareBela);

        const message: PlayCardMsg = {
            playerId: user.username, // Use username as playerId as per the guide
            card,
            declareBela
        };

        clientRef.current.publish({
            destination: `/app/games/${gameId}/play`,
            body: JSON.stringify(message)
        });

        console.log('Card play message sent:', message);
    }, [isConnected, user]);

    const placeBid = useCallback((gameId: string, pass: boolean, trump?: string) => {
        if (!clientRef.current || !isConnected || !user?.username) {
            console.warn('Cannot place bid: WebSocket not connected or user not available');
            return;
        }

        console.log('Placing bid:', { pass, trump });

        const message = {
            playerId: user.username,
            pass,
            trump: trump || null
        };

        clientRef.current.publish({
            destination: `/app/games/${gameId}/bid`,
            body: JSON.stringify(message)
        });

        console.log('Bid message sent:', message);
    }, [isConnected, user]);
    const challenge = useCallback((gameId: string) => {
        if (!clientRef.current || !isConnected || !user?.username) {
            console.warn('Cannot challenge: WebSocket not connected or user not available');
            return;
        }

        console.log('Issuing challenge');

        const message = {
            playerId: user.username
        };

        clientRef.current.publish({
            destination: `/app/games/${gameId}/challenge`,
            body: JSON.stringify(message)
        });

        console.log('Challenge message sent:', message);
    }, [isConnected, user]);
    const refreshGameState = useCallback((gameId: string) => {
        if (!clientRef.current || !isConnected) {
            console.warn('Cannot refresh game state: WebSocket not connected');
            return;
        }

        console.log('Refreshing game state for game:', gameId);

        clientRef.current.publish({
            destination: `/app/games/${gameId}/refresh`,
            body: JSON.stringify({})
        });

        console.log('Refresh message sent');
    }, [isConnected]);

    const cancelMatch = useCallback((gameId: string) => {
        if (!clientRef.current || !isConnected) {
            console.warn('Cannot cancel match: WebSocket not connected');
            return;
        }

        console.log('Cancelling match:', gameId);

        clientRef.current.publish({
            destination: `/app/games/${gameId}/cancel`,
            body: JSON.stringify({})
        });

        console.log('Cancel message sent');
    }, [isConnected]);

    // Add cleanup function for game subscriptions
    const unsubscribeFromGame = useCallback((gameId: string) => {
        console.log('Unsubscribing from game channels for gameId:', gameId);

        const publicSub = subscriptionsRef.current.get(`game-${gameId}-public`);
        const privateSub = subscriptionsRef.current.get(`game-${gameId}-private`);

        if (publicSub) {
            try {
                publicSub.unsubscribe();
                subscriptionsRef.current.delete(`game-${gameId}-public`);
                console.log('Unsubscribed from public game channel');
            } catch (error) {
                console.warn('Failed to unsubscribe from public game channel:', error);
            }
        }

        if (privateSub) {
            try {
                privateSub.unsubscribe();
                subscriptionsRef.current.delete(`game-${gameId}-private`);
                console.log('Unsubscribed from private game channel');
            } catch (error) {
                console.warn('Failed to unsubscribe from private game channel:', error);
            }
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        isConnecting,
        connectionError,
        connect,
        disconnect,
        subscribeToRankedQueue,
        unsubscribeFromRankedQueue,
        subscribeToGame,
        unsubscribeFromGame,
        playCard,
        placeBid,
        challenge,
        refreshGameState,
        cancelMatch,
    };

}