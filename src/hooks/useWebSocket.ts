
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
    onOpen?: (event: Event) => void;
    onMessage?: (event: MessageEvent) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (event: Event) => void;
    reconnectAttempts?: number;
    reconnectInterval?: number;
    protocols?: string | string[];
}

interface WebSocketState {
    socket: WebSocket | null;
    lastMessage: MessageEvent | null;
    readyState: number;
    isConnected: boolean;
}

export function useWebSocket(
    url: string | null,
    options: UseWebSocketOptions = {}
) {
    const {
        onOpen,
        onMessage,
        onClose,
        onError,
        reconnectAttempts = 3,
        reconnectInterval = 3000,
        protocols,
    } = options;

    const [state, setState] = useState<WebSocketState>({
        socket: null,
        lastMessage: null,
        readyState: WebSocket.CLOSED,
        isConnected: false,
    });

    const reconnectCount = useRef(0);
    const reconnectTimeoutRef = useRef<number | null>(null);

    const connect = useCallback(() => {
        if (!url) return;

        try {
            const ws = new WebSocket(url, protocols);

            ws.onopen = (event) => {
                setState(prev => ({
                    ...prev,
                    socket: ws,
                    readyState: ws.readyState,
                    isConnected: true,
                }));
                reconnectCount.current = 0;
                onOpen?.(event);
            };

            ws.onmessage = (event) => {
                setState(prev => ({
                    ...prev,
                    lastMessage: event,
                }));
                onMessage?.(event);
            };

            ws.onclose = (event) => {
                setState(prev => ({
                    ...prev,
                    socket: null,
                    readyState: WebSocket.CLOSED,
                    isConnected: false,
                }));

                onClose?.(event);

                // Attempt to reconnect if not a manual close
                if (!event.wasClean && reconnectCount.current < reconnectAttempts) {
                    reconnectCount.current++;
                    reconnectTimeoutRef.current = window.setTimeout(() => {
                        connect();
                    }, reconnectInterval);
                }
            };

            ws.onerror = (event) => {
                setState(prev => ({
                    ...prev,
                    readyState: ws.readyState,
                }));
                onError?.(event);
            };

            setState(prev => ({
                ...prev,
                socket: ws,
                readyState: ws.readyState,
            }));
        } catch (error) {
            console.error('WebSocket connection failed:', error);
        }
    }, [url, protocols, onOpen, onMessage, onClose, onError, reconnectAttempts, reconnectInterval]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (state.socket) {
            state.socket.close();
        }
    }, [state.socket]);

    const sendMessage = useCallback((message: string | ArrayBufferLike | Blob | ArrayBufferView) => {
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(message);
        } else {
            console.warn('WebSocket is not connected');
        }
    }, [state.socket]);

    const sendJsonMessage = useCallback((message: any) => {
        sendMessage(JSON.stringify(message));
    }, [sendMessage]);

    useEffect(() => {
        if (url) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [url, connect, disconnect]);

    return {
        ...state,
        sendMessage,
        sendJsonMessage,
        connect,
        disconnect,
    };
}