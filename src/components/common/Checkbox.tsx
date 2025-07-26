import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label?: string;
    description?: string;
    error?: string;
    onChange: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({
                                                      label,
                                                      description,
                                                      error,
                                                      onChange,
                                                      checked,
                                                      disabled,
                                                      className = '',
                                                      ...props
                                                  }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.checked);
    };

    return (
        <div className="space-y-2">
            <label className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="relative flex items-center justify-center mt-0.5">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={handleChange}
                        disabled={disabled}
                        className="sr-only"
                        {...props}
                    />
                    <div className={`w-5 h-5 border-2 rounded transition-all duration-200 ${
                        checked
                            ? 'bg-purple-600 border-purple-600'
                            : error
                                ? 'border-red-500 bg-slate-800'
                                : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                    }`}>
                        {checked && (
                            <svg
                                className="w-3 h-3 text-white absolute top-0.5 left-0.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        )}
                    </div>
                </div>

                <div className="flex-1">
                    {label && (
                        <span className="text-slate-200 font-medium">
              {label}
            </span>
                    )}
                    {description && (
                        <p className="text-slate-400 text-sm mt-1">
                            {description}
                        </p>
                    )}
                </div>
            </label>

            {error && (
                <p className="text-red-400 text-sm ml-8">{error}</p>
            )}
        </div>
    );
};