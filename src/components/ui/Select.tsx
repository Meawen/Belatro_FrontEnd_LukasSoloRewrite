import type { Ref, SelectHTMLAttributes } from 'react';
import { Field, type FieldFrameProps } from './Field';
import { PixelIcon } from './PixelIcon';

export interface SelectOption {
    value: string;
    label: string;
}

export interface SelectProps
    extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'onChange' | 'value'>, FieldFrameProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    ref?: Ref<HTMLSelectElement>;
}

/** A native select in the field frame (spec §3.7); unlike today's, its label is tied. */
export function Select({ id, label, hideLabel, helper, error, className, options, value, onChange, ref, ...rest }: SelectProps) {
    return (
        <Field
            id={id}
            label={label}
            hideLabel={hideLabel}
            helper={helper}
            error={error}
            className={className}
            adornment={<PixelIcon name="chevron" className="pointer-events-none absolute right-3 rotate-90 text-text-2" />}
        >
            {(control) => (
                <select ref={ref} className="ui-field__control ui-field__control--select" value={value} onChange={(event) => onChange(event.target.value)} {...rest} {...control}>
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            )}
        </Field>
    );
}
