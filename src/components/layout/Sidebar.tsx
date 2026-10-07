import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMe } from '../../hooks/useUser';

interface SidebarItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
    requiresAuth?: boolean;
}

interface SidebarProps {
    children?: React.ReactNode;
    customItems?: SidebarItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ children, customItems }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { user, logout, isAuthenticated } = useAuth();
    const location = useLocation();

    const defaultItems: SidebarItem[] = [
        {
            label: 'Dashboard',
            href: '/dashboard',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
            requiresAuth: false
        },
        {
            label: 'Play Game',
            href: '/play',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707M9 10v1.586a1 1 0 00.293.707l.707.707M9 10L5.636 6.636a1 1 0 00-.707-.293H3.515a1 1 0 00-.707.293L1.1 8.343" />
                </svg>
            ),
            requiresAuth: true
        },
        {
            label: 'Game Lobbies',
            href: '/lobbies',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
            requiresAuth: true
        },
        {
            label: 'Profile',
            href: '/profile',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
            requiresAuth: true
        },
        {
            label: 'Friends',
            href: '/friends',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
            ),
            requiresAuth: true
        },
        {
            label: 'Leaderboard',
            href: '/users',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            requiresAuth: false // Allow viewing leaderboard without auth
        },
        {
            label: 'Match History',
            href: '/matches',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h6m-6 4h6" />
                </svg>
            ),
            requiresAuth: true
        },
        {
            label: 'Admin Panel',
            href: '/admin',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            ),
            adminOnly: true,
            requiresAuth: true
        },
    ];

    const items = customItems || defaultItems;

    // Roles come from GET /user/me; the stored login user (UserLoginDetailsDTO) has none.
    const { data: me } = useMe(isAuthenticated);
    const isAdmin = me?.roles?.includes('ROLE_ADMIN') ?? false;

    // Filter items based on auth status and admin permissions
    const filteredItems = items.filter(item => {
        // Check admin permissions
        if (item.adminOnly && !isAdmin) return false;

        // Check auth requirements
        if (item.requiresAuth && !isAuthenticated) return false;

        return true;
    });

    const isActiveRoute = (href: string) => {
        return location.pathname === href || location.pathname.startsWith(href + '/');
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <aside className={`bg-emerald-900 border-r border-emerald-700 transition-all duration-300 flex flex-col ${
            isCollapsed ? 'w-16' : 'w-64'
        }`}>
            {/* Header with Logo and Toggle */}
            <div className="p-4 border-b border-emerald-700">
                {!isCollapsed && (
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-emerald-900 font-bold">
                            B
                        </div>
                        <h1 className="text-xl font-bold text-white">Belatro</h1>
                    </div>
                )}

                {isCollapsed && (
                    <div className="flex justify-center mb-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-emerald-900 font-bold">
                            B
                        </div>
                    </div>
                )}

                {/* Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-full p-2 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-800 transition-colors flex items-center justify-center group"
                    title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                >
                    {isCollapsed ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 p-4 space-y-1">
                {filteredItems.map((item) => {
                    const isActive = isActiveRoute(item.href);

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                                isActive
                                    ? 'bg-amber-600 text-emerald-900 font-bold shadow-sm'
                                    : 'text-emerald-200 hover:text-white hover:bg-emerald-800'
                            }`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <div className="flex-shrink-0">
                                {item.icon}
                            </div>
                            {!isCollapsed && (
                                <span className="flex-1">{item.label}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* User Section */}
            {isAuthenticated && user && (
                <div className="p-4 border-t border-emerald-700">
                    {!isCollapsed ? (
                        <div className="space-y-3">
                            {/* User Info */}
                            <div className="bg-emerald-800/50 rounded-lg p-3 border border-emerald-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-emerald-900 font-bold text-sm">
                                        {user.username?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-white truncate">
                                            {user.username}
                                        </div>
                                        <div className="text-xs text-emerald-300 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Player
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Logout Button */}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-200 hover:text-white hover:bg-emerald-800 transition-all duration-200 group"
                            >
                                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Collapsed User Avatar */}
                            <div className="flex justify-center">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-emerald-900 font-bold text-sm border border-emerald-700/50">
                                    {user.username?.charAt(0).toUpperCase() || '?'}
                                </div>
                            </div>

                            {/* Collapsed Logout Button */}
                            <button
                                onClick={handleLogout}
                                className="w-full p-2.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition-all duration-200 flex justify-center group"
                                title="Logout"
                            >
                                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {children}
        </aside>
    );
};