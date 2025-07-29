import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserDropdown } from './UserDropdown';

export const Header: React.FC = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user, isAuthenticated, logout } = useAuth();

    const navigationItems = [
        { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
        { label: 'Lobbies', href: '/lobbies', icon: '🎮' },
        { label: 'Match History', href: '/matches', icon: '📊' },
        { label: 'Leaderboard', href: '/leaderboard', icon: '🏆' },
        { label: 'Users', href: '/users', icon: '👥' },
    ];

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <header className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="text-2xl">🃏</div>
                        <h1 className="text-xl font-bold text-white">Belatro</h1>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-1">
                        {navigationItems.map((item) => (
                            <Link
                                key={item.href}
                                to={item.href}
                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                                <span>{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* User Menu */}
                    <div className="flex items-center gap-4">
                        {isAuthenticated && user ? (
                            <UserDropdown
                                user={user}
                                onLogout={handleLogout}
                            />
                        ) : (
                            <div className="flex gap-2">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-transparent border-2 border-slate-600 text-white hover:bg-slate-800 hover:border-slate-500 rounded-lg transition-all duration-200"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold btn-primary rounded-lg transition-all duration-200"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        )}

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                            <span className="sr-only">Open main menu</span>
                            {isMobileMenuOpen ? '✕' : '☰'}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <div className="md:hidden py-4 border-t border-slate-700">
                        <nav className="space-y-1">
                            {navigationItems.map((item) => (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span>{item.icon}</span>
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
};