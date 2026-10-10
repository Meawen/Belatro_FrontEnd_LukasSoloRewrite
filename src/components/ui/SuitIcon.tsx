import { useState } from 'react';
import { suitIconUrl } from '../../services/cardArt';
import type { Boja } from '../../types/game';
import { cx } from './cx';

export interface SuitIconProps {
    boja: Boja;
    /** 1: 17×16, 2: 34×32 (the art's grid, spec §3.5). */
    size?: 1 | 2;
    /** Only when the icon stands for the suit on its own. */
    label?: string;
    className?: string;
}

/** The suit's own icon from the card art, drawn pixel for pixel. */
export function SuitIcon({ boja, size = 1, label, className }: SuitIconProps) {
    const url = suitIconUrl(boja);
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const width = 17 * size;
    const height = 16 * size;

    // a PNG that fails never shows the browser's broken-image glyph: the slot keeps the suit's letter (spec §3.6)
    if (failedUrl === url) {
        return (
            <span
                role={label ? 'img' : undefined}
                aria-label={label}
                aria-hidden={label ? undefined : true}
                style={{ width: `${width}px`, height: `${height}px` }}
                className={cx('inline-flex shrink-0 items-center justify-center t-caption', className)}
            >
                {boja[0]}
            </span>
        );
    }
    return (
        <img
            src={url}
            alt={label ?? ''}
            aria-hidden={label ? undefined : true}
            width={width}
            height={height}
            draggable={false}
            className={cx('pixelated inline-block shrink-0 object-contain', className)}
            onError={() => setFailedUrl(url)}
        />
    );
}
