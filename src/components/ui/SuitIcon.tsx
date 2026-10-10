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
    return (
        <img
            src={suitIconUrl(boja)}
            alt={label ?? ''}
            aria-hidden={label ? undefined : true}
            width={17 * size}
            height={16 * size}
            draggable={false}
            className={cx('pixelated inline-block shrink-0', className)}
        />
    );
}
