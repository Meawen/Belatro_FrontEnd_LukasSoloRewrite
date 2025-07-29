import React, { useState, useRef, useEffect } from 'react';
import type { User } from '../../types/user';

interface UserDropdownProps {
    user: User;
    onLogout: () => void;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({ user, onLogout }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const eloRating = user.eloRating || 1200;
    const level = user.level || 1;

    const getRankIcon = (elo: number): string => {
        if (elo >= 2000) return '👑';
        if (elo >= 1800) return '💎';
        if (elo >= 1600) return '🏆';
        if (elo >= 1400) return '🥈';
        if (elo >= 1200) return '🥉';
        return '🆕';
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-lg">
                    {getRankIcon(eloRating)}
                </div>
                <div className="text-left hidden sm:block">
                    <div className="font-medium">{user.username}</div>
                    <div className="text-xs text-slate-400">Level {level} • {eloRating} ELO</div>
                </div>
                <span className="text-slate-400">
          {isOpen ? '▲' : '▼'}
        </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-50">
                    {/* User Info */}
                    <div className="p-4 border-b border-slate-700">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-xl">
                                {getRankIcon(eloRating)}
                            </div>
                            <div>
                                <div className="font-semibold text-white">{user.username}</div>
                                <div className="text-sm text-slate-400">{user.email}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-700/50 p-2 rounded text-center">
                                <div className="text-purple-400 font-semibold">{eloRating}</div>
                                <div className="text-slate-400">ELO Rating</div>
                            </div>
                            <div className="bg-slate-700/50 p-2 rounded text-center">
                                <div className="text-green-400 font-semibold">{level}</div>
                                <div className="text-slate-400">Level</div>
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                        <a
                            href="/profile"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left"
                            onClick={() => setIsOpen(false)}
                        >
                            <span>👤</span>
                            View Profile
                        </a>
                        <a
                            href="/settings"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left"
                            onClick={() => setIsOpen(false)}
                        >
                            <span>⚙️</span>
                            Settings
                        </a>
                        <a
                            href="/matches"
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left"
                            onClick={() => setIsOpen(false)}
                        >
                            <span>📊</span>
                            Match History
                        </a>
                        <div className="border-t border-slate-700 my-2" />
                        <button
                            onClick={() => {
                                onLogout();
                                setIsOpen(false);
                            }}
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 w-full text-left"
                        >
                            <span>🚪</span>
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};