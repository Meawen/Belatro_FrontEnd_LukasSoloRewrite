import { useSyncExternalStore, type JSX } from 'react';
import { gameSocket } from '../../services/gameSocket';
import { Button } from '../common/Button';

/**
 * R-30: while a held game socket is down after a lost or failed connection, say so and offer an
 * immediate retry. gameSocket keeps retrying on its own meanwhile (5, 10, 20 s, then every 30 s).
 * Renders nothing otherwise, and never holds the socket itself: the page that mounts it does.
 * Mounted on the game page and on /play (Phase 7).
 */
export function ReconnectBanner(): JSX.Element | null {
    const { isReconnecting } = useSyncExternalStore(gameSocket.onStateChange, gameSocket.getState);
    if (!isReconnecting) return null;
    return (
        <div
            role="status"
            className="max-w-5xl mx-auto mb-4 flex items-center justify-between gap-4 rounded-lg border border-amber-500/40 bg-amber-900/30 px-4 py-3 text-amber-100"
        >
            <span>Reconnecting…</span>
            <Button variant="secondary" size="small" onClick={() => gameSocket.retryNow()}>Retry</Button>
        </div>
    );
}
