import type { ReactNode } from 'react';
import { cx } from './cx';

export interface SegmentedOption<T extends string> {
    value: T;
    label: ReactNode;
}

export interface SegmentedProps<T extends string> {
    /** The group's accessible name. */
    label: string;
    options: SegmentedOption<T>[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
}

/** A segmented control (spec §3.7): a notched track of aria-pressed buttons. */
export function Segmented<T extends string>({ label, options, value, onChange, className }: SegmentedProps<T>) {
    return (
        <div role="group" aria-label={label} className={cx('ui-seg', className)}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className="ui-seg__item"
                    aria-pressed={option.value === value}
                    onClick={() => {
                        if (option.value !== value) onChange(option.value);
                    }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
