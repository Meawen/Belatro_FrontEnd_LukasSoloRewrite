import { useId, type ReactNode } from 'react';
import { cx } from './cx';

export interface SwitchProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    helper?: ReactNode;
    disabled?: boolean;
    name?: string;
    id?: string;
    className?: string;
}

/** An on/off switch (spec §3.7): a native checkbox with role="switch", its label tied by a stable id. */
export function Switch({ label, checked, onChange, helper, disabled, name, id, className }: SwitchProps) {
    const autoId = useId();
    const controlId = id ?? autoId;
    const helperId = `${controlId}-note`;
    return (
        <div className={cx('ui-switch', className)}>
            <input
                id={controlId}
                type="checkbox"
                role="switch"
                className="ui-switch__input"
                name={name}
                checked={checked}
                disabled={disabled}
                aria-describedby={helper ? helperId : undefined}
                onChange={(event) => onChange(event.target.checked)}
            />
            <label htmlFor={controlId} className="ui-switch__label">
                <span className="t-body">{label}</span>
                <span className="ui-switch__track" aria-hidden="true">
                    <span className="ui-switch__knob" />
                </span>
            </label>
            {helper && (
                <p id={helperId} className="t-footnote text-text-3">
                    {helper}
                </p>
            )}
        </div>
    );
}
