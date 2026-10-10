import type { InputHTMLAttributes, Ref } from 'react';
import { Field, type FieldFrameProps } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>, FieldFrameProps {
    ref?: Ref<HTMLInputElement>;
}

/** A text field (spec §3.7): the label tied by a stable useId id; helper and error described. */
export function Input({ id, label, hideLabel, helper, error, className, ref, ...rest }: InputProps) {
    return (
        <Field id={id} label={label} hideLabel={hideLabel} helper={helper} error={error} className={className}>
            {(control) => <input ref={ref} className="ui-field__control" {...rest} {...control} />}
        </Field>
    );
}
