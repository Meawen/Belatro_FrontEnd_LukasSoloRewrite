import { useSyncExternalStore, type JSX } from 'react';
import { gameSocket } from '../../services/gameSocket';
import { Button } from '../ui/Button';
import { PixelIcon } from '../ui/PixelIcon';

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
        <div role="status" className="flex items-center justify-between gap-3 notch bg-warn-fill px-3 py-1.5 text-text t-callout font-semibold">
            <span className="inline-flex items-center gap-2">
                <PixelIcon name="refresh" />
                <span>Reconnecting…</span>
            </span>
            <Button variant="secondary" size="sm" onClick={() => gameSocket.retryNow()}>Retry</Button>
        </div>
    );
}
