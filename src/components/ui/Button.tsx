import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    /** md: 44 px tall; sm: 36 px to see inside a 44-px hit area. */
    size?: 'md' | 'sm';
    /** Decorative, before the label. */
    leftIcon?: ReactNode;
    /** Disables the button and blinks a square; the label stays the accessible name. */
    loading?: boolean;
    /** Full width. */
    block?: boolean;
    ref?: Ref<HTMLButtonElement>;
}

/**
 * The button (spec §3.7). Feedback is CSS `:active` (down 2 px, 90 ms), on press. `type` defaults to
 * "button"; a form's submit button says `type="submit"`. `className` is for layout only.
 */
export function Button({
    variant = 'primary',
    size = 'md',
    leftIcon,
    loading = false,
    block = false,
    disabled,
    type = 'button',
    className,
    children,
    ref,
    ...rest
}: ButtonProps) {
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cx('ui-btn', `ui-btn--${variant}`, size === 'sm' && 'ui-btn--sm', block && 'ui-btn--block', className)}
            {...rest}
        >
            {loading ? (
                <span className="ui-btn__busy" aria-hidden="true" />
            ) : (
                leftIcon && <span className="inline-flex" aria-hidden="true">{leftIcon}</span>
            )}
            {children !== undefined && children !== null && <span>{children}</span>}
        </button>
    );
}
