import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import { backUrl, faceUrl, isArtDecoded, markArtDecoded } from '../../services/cardArt';
import { cardLabel } from '../game/gameView';
import type { GameCard } from '../../types/game';
import { cx } from './cx';
import { ART_H, ART_W, crispCardWidth, intendedCardWidth, type CardSize } from './cardWidth';

export type { CardSize } from './cardWidth';

function subscribeToViewport(onChange: () => void) {
    window.addEventListener('resize', onChange);
    return () => window.removeEventListener('resize', onChange);
}

export interface PlayingCardProps {
    /** The face; without one the card shows its back. */
    card?: GameCard;
    /** Which back (1 red, the opponents' back of X-13; 2 teal; 3 purple). */
    back?: 1 | 2 | 3;
    size?: CardSize;
    /** An intended CSS width instead of `size` (e.g. the board's targets); still made crisp. */
    width?: number;
    /** Defaults to the card's name ("As Herc"); a back is decorative. */
    alt?: string;
    className?: string;
    style?: CSSProperties;
}

const FRAME = 'absolute inset-0 notch shadow-[inset_0_0_0_3px_var(--ink)]';

/**
 * A card from the art (spec §3.6): crisp per density. Until its image has decoded, and if it fails, a
 * face shows a pixel-framed text card and a back its colour, in the same box (no layout change).
 */
export function PlayingCard({ card, back = 1, size = 'trick', width, alt, className, style }: PlayingCardProps) {
    const viewportWidth = useSyncExternalStore(subscribeToViewport, () => window.innerWidth, () => 1024);
    const dpr = useSyncExternalStore(subscribeToViewport, () => window.devicePixelRatio || 1, () => 1);
    const cssWidth = crispCardWidth(width ?? intendedCardWidth(size, { width: viewportWidth, dpr }), dpr);
    const url = card ? faceUrl(card) : backUrl(back);
    const name = alt ?? (card ? cardLabel(card) : '');
    const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const failed = failedUrl === url;
    const shown = !failed && (loadedUrl === url || isArtDecoded(url));
    // the text card speaks only once the image is gone; until then the image carries the name
    const speaks = failed && name !== '';

    return (
        <span
            className={cx('ui-card relative inline-block shrink-0 align-top', className)}
            style={{ ...style, width: `${cssWidth}px`, height: `${(cssWidth * ART_H) / ART_W}px` }}
        >
            {!shown &&
                (card ? (
                    <span
                        role={speaks ? 'img' : undefined}
                        aria-label={speaks ? name : undefined}
                        aria-hidden={speaks ? undefined : true}
                        className={cx(FRAME, 'flex items-center justify-center px-1 text-center bg-text text-ink t-caption')}
                    >
                        {cardLabel(card)}
                    </span>
                ) : (
                    <span aria-hidden="true" className={cx(FRAME, back === 1 ? 'bg-danger' : 'bg-surface-3')} />
                ))}
            {!failed && (
                <img
                    src={url}
                    alt={name}
                    aria-hidden={name ? undefined : true}
                    draggable={false}
                    decoding="async"
                    className={cx('pixelated absolute inset-0 block size-full select-none', !shown && 'opacity-0')}
                    onLoad={() => {
                        markArtDecoded(url);
                        setLoadedUrl(url);
                    }}
                    onError={() => setFailedUrl(url)}
                />
            )}
        </span>
    );
}
