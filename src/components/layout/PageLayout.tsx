import React from 'react';
import { Link } from 'react-router-dom';

export interface PageLayoutProps {
    title: string;
    subtitle?: string;
    breadcrumbs?: Array<{ label: string; href?: string }>;
    actions?: React.ReactNode;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showBackButton?: boolean;
    onBack?: () => void;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
                                                          title,
                                                          subtitle,
                                                          breadcrumbs,
                                                          actions,
                                                          children,
                                                          maxWidth = 'full',
                                                          showBackButton = false,
                                                          onBack
                                                      }) => {
    const maxWidthClasses = {
        sm: 'max-w-2xl',
        md: 'max-w-4xl',
        lg: 'max-w-6xl',
        xl: 'max-w-7xl',
        full: 'max-w-full'
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            window.history.back();
        }
    };

    return (
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidthClasses[maxWidth]}`}>
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="mb-4" aria-label="Breadcrumb">
                    <ol className="flex items-center gap-2 text-sm">
                        {breadcrumbs.map((breadcrumb, index) => (
                            <li key={index} className="flex items-center gap-2">
                                {index > 0 && (
                                    <span className="text-slate-500" aria-hidden="true">
                                        /
                                    </span>
                                )}
                                {breadcrumb.href ? (
                                    <Link
                                        to={breadcrumb.href}
                                        className="text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        {breadcrumb.label}
                                    </Link>
                                ) : (
                                    <span className="text-slate-300" aria-current="page">
                                        {breadcrumb.label}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
            )}

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
                <div className="flex-1">
                    {/* Back Button */}
                    {showBackButton && (
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 text-sm"
                        >
                            <span>←</span>
                            <span>Back</span>
                        </button>
                    )}

                    {/* Title and Subtitle */}
                    <div>
                        <h1 className="text-3xl font-bold text-white leading-tight">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-slate-400 mt-2 text-lg">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                {actions && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {actions}
                    </div>
                )}
            </div>

            {/* Page Content */}
            <div className="pb-8">{children}</div>
        </div>
    );
};