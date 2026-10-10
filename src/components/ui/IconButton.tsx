import { Button, type ButtonProps } from './Button';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './icons';
import { cx } from './cx';

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'block' | 'aria-label'> {
    /** Required: an icon-only button is named by its label (spec §3.5). */
    'aria-label': string;
    icon: IconName;
}

/** An icon-only button with a 44×44 hit area (spec §3.7, §3.9). */
export function IconButton({ icon, variant = 'quiet', className, ...rest }: IconButtonProps) {
    return (
        <Button variant={variant} className={cx('ui-btn--icon', className)} {...rest}>
            <PixelIcon name={icon} />
        </Button>
    );
}
