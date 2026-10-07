import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ActiveGameBanner } from './ActiveGameBanner';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';
import { UnverifiedEmailBanner } from './UnverifiedEmailBanner';

export interface AppLayoutProps {
    children?: React.ReactNode;
    showSidebar?: boolean;
}

/** Below Tailwind's md breakpoint (768 px) the sidebar is a drawer behind a menu button (R-37). */
const SMALL_SCREEN_QUERY = '(max-width: 767.98px)';

function isSmallScreen(): boolean {
    // no matchMedia (jsdom, very old browsers): lay out for a desktop
    return typeof window.matchMedia === 'function' && window.matchMedia(SMALL_SCREEN_QUERY).matches;
}

function useSmallScreen(): boolean {
    const [small, setSmall] = useState(isSmallScreen);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const query = window.matchMedia(SMALL_SCREEN_QUERY);
        const onChange = () => setSmall(query.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);
    return small;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
                                                        children,
                                                        showSidebar = false
                                                    }) => {
    const smallScreen = useSmallScreen();
    // The drawer starts closed and closes again after every navigation
    const [menuOpen, setMenuOpen] = useState(false);
    const { pathname } = useLocation();
    useEffect(() => setMenuOpen(false), [pathname]);

    return (
        <div className="min-h-screen bg-emerald-950 flex flex-col">
            {/* Main Content Area */}
            <div className="flex flex-1">
                {/* Sidebar: in the page on a wide screen, a drawer on a small one */}
                {showSidebar && !smallScreen && <Sidebar />}
                {showSidebar && smallScreen && menuOpen && (
                    <div className="fixed inset-0 z-40 flex overflow-y-auto">
                        <Sidebar />
                        <button
                            type="button"
                            aria-label="Close menu"
                            className="flex-1 bg-black/50"
                            onClick={() => setMenuOpen(false)}
                        />
                    </div>
                )}

                {/* Page Content */}
                <main className="flex-1 min-w-0">
                    {showSidebar && smallScreen && (
                        <div className="flex items-center px-4 py-3 border-b border-emerald-800 bg-emerald-900">
                            <button
                                type="button"
                                aria-label="Menu"
                                aria-expanded={menuOpen}
                                onClick={() => setMenuOpen((open) => !open)}
                                className="p-2 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                        </div>
                    )}
                    <ActiveGameBanner />
                    <UnverifiedEmailBanner />
                    <div className="py-8">
                        {children || <Outlet />}
                    </div>
                </main>
            </div>

            {/* Footer */}
            <Footer />
        </div>
    );
};