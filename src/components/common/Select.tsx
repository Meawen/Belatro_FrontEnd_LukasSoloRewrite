import React from 'react';

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
    label?: string;
    error?: string;
    options: SelectOption[];
    placeholder?: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const Select: React.FC<SelectProps> = ({
                                                  label,
                                                  error,
                                                  options,
                                                  placeholder,
                                                  className = '',
                                                  required,
                                                  ...props
                                              }) => {
    const baseClasses = 'w-full px-4 py-3 bg-slate-800 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-200';

    const stateClasses = error
        ? 'border-red-500 focus:border-red-400 focus:ring-red-400/50'
        : 'border-slate-600 focus:border-purple-400 focus:ring-purple-400/50';

    const classes = [baseClasses, stateClasses, className].filter(Boolean).join(' ');

    return (
        <div className="space-y-2">
            {label && (
                <label className="block text-sm font-medium text-slate-200">
                    {label}
                    {required && <span className="text-red-400 ml-1">*</span>}
                </label>
            )}

            <select className={classes} {...props}>
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label}
                    </option>
                ))}
            </select>

            {error && (
                <p className="text-red-400 text-sm">{error}</p>
            )}
        </div>
    );
};