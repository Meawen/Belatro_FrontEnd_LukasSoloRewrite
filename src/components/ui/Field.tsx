import { useId, type ReactNode } from 'react';
import { cx } from './cx';

export interface FieldFrameProps {
    label: string;
    /** Keeps the label for assistive tech only. */
    hideLabel?: boolean;
    helper?: ReactNode;
    error?: string | null;
    className?: string;
}

interface FieldProps extends FieldFrameProps {
    /** The control's id, when the caller passed one. */
    id?: string;
    /** Renders the control with the ids and ARIA the frame worked out. */
    children: (control: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode;
    /** Something drawn after the control inside the box (the Select chevron). */
    adornment?: ReactNode;
}

/** The label, box, helper and error around an Input or a Select (spec §3.7). */
export function Field({ id, label, hideLabel, helper, error, className, children, adornment }: FieldProps) {
    const autoId = useId();
    const controlId = id ?? autoId;
    const noteId = `${controlId}-note`;
    const note = error || helper;
    return (
        <div className={cx('ui-field', className)}>
            <label htmlFor={controlId} className={cx('t-callout font-semibold text-text-2', hideLabel && 'sr-only')}>
                {label}
            </label>
            <div className={cx('ui-field__box', error && 'ui-field__box--error')}>
                {children({ id: controlId, 'aria-describedby': note ? noteId : undefined, 'aria-invalid': error ? true : undefined })}
                {adornment}
            </div>
            {note && (
                <p id={noteId} className={cx('t-footnote', error ? 'text-danger-text' : 'text-text-3')}>
                    {note}
                </p>
            )}
        </div>
    );
}
