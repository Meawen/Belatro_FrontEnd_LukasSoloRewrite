import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';

export interface MainLayoutProps {
    children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
        { name: 'Play', href: '/play', icon: '🎮' },
        { name: 'Lobbies', href: '/lobbies', icon: '🃏' },
        { name: 'Profile', href: '/profile', icon: '👤' },
        { name: 'Friends', href: '/friends', icon: '👥' },
        { name: 'Leaderboard', href: '/users', icon: '📊' },
    ];

    const adminNavigation = [
        { name: 'Admin Panel', href: '/admin', icon: '⚙️' },
    ];

    const isActiveRoute = (href: string) => {
        return location.pathname === href || location.pathname.startsWith(href + '/');
    };

    const isAdmin = user?.roles?.includes('ROLE_ADMIN');

    return (
        <div className="min-h-screen bg-emerald-950">
            {/* Header */}
            <header className="bg-emerald-900/95 backdrop-blur border-b border-emerald-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo & Brand */}
                        <div className="flex items-center gap-4">
                            <Link to="/" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-emerald-900 font-bold">
                                    🃏
                                </div>
                                <span className="text-xl font-bold text-white">Belatro</span>
                            </Link>
                        </div>

                        {/* Navigation */}
                        <nav className="hidden md:flex items-center gap-6">
                            {navigation.map((item) => (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        isActiveRoute(item.href)
                                            ? 'bg-amber-600 text-emerald-900 font-bold'
                                            : 'text-emerald-200 hover:text-white hover:bg-emerald-800'
                                    }`}
                                >
                                    <span>{item.icon}</span>
                                    <span>{item.name}</span>
                                </Link>
                            ))}

                            {isAdmin && (
                                <div className="border-l border-emerald-700 pl-6">
                                    {adminNavigation.map((item) => (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                isActiveRoute(item.href)
                                                    ? 'bg-red-600 text-white'
                                                    : 'text-emerald-200 hover:text-white hover:bg-emerald-800'
                                            }`}
                                        >
                                            <span>{item.icon}</span>
                                            <span>{item.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </nav>

                        {/* User Menu */}
                        <div className="flex items-center gap-4">
                            {user ? (
                                <div className="flex items-center gap-3">
                                    <div className="hidden sm:block text-right">
                                        <div className="text-sm font-medium text-white">
                                            {user.username}
                                        </div>
                                        <div className="text-xs text-emerald-300">
                                            ELO: {user.eloRating || 1200}
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-emerald-900 font-bold text-sm">
                                        {user.username?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <Button
                                        onClick={logout}
                                        variant="outline"
                                        size="small"
                                        className="border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white"
                                    >
                                        Logout
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <Link to="/login">
                                        <Button
                                            variant="outline"
                                            size="small"
                                            className="border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white"
                                        >
                                            Login
                                        </Button>
                                    </Link>
                                    <Link to="/register">
                                        <Button
                                            variant="primary"
                                            size="small"
                                            className="bg-amber-600 hover:bg-amber-500 text-emerald-900 font-bold"
                                        >
                                            Register
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                <div className="md:hidden border-t border-emerald-800">
                    <div className="px-4 py-2">
                        <div className="flex gap-2 overflow-x-auto">
                            {navigation.map((item) => (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                        isActiveRoute(item.href)
                                            ? 'bg-amber-600 text-emerald-900 font-bold'
                                            : 'text-emerald-200 hover:text-white hover:bg-emerald-800'
                                    }`}
                                >
                                    <span>{item.icon}</span>
                                    <span>{item.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children || <Outlet />}
            </main>

            {/* Footer */}
            <footer className="bg-emerald-900/95 border-t border-emerald-800 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-yellow-600 rounded flex items-center justify-center text-emerald-900 font-bold text-sm">
                                🃏
                            </div>
                            <span className="text-emerald-300">© 2024 Belatro. All rights reserved.</span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-emerald-300">
                            <Link to="/about" className="hover:text-white transition-colors">
                                About
                            </Link>
                            <Link to="/privacy" className="hover:text-white transition-colors">
                                Privacy
                            </Link>
                            <Link to="/terms" className="hover:text-white transition-colors">
                                Terms
                            </Link>
                            <Link to="/support" className="hover:text-white transition-colors">
                                Support
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};