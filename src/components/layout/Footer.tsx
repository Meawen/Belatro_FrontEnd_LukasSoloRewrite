import React from 'react';
import { Link } from "react-router-dom";

export const Footer: React.FC = () => {
    const currentYear = new Date().getFullYear();

    const footerLinks = {
        game: [
            { label: 'How to Play', href: '/guide' },
            { label: 'Rules', href: '/rules' },
            { label: 'Tournaments', href: '/tournaments' },
            { label: 'Leaderboard', href: '/users' },
        ],
        community: [
            { label: 'Discord', href: '#' },
            { label: 'Reddit', href: '#' },
            { label: 'Twitter', href: '#' },
            { label: 'YouTube', href: '#' },
        ],
        support: [
            { label: 'Help Center', href: '/help' },
            { label: 'Contact Us', href: '/contact' },
            { label: 'Bug Reports', href: '/bugs' },
            { label: 'Feature Requests', href: '/features' },
        ],
        legal: [
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms of Service', href: '/terms' },
            { label: 'Code of Conduct', href: '/conduct' },
            { label: 'DMCA', href: '/dmca' },
        ],
    };

    return (
        <footer className="bg-emerald-900 border-t border-emerald-700 py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                    {/* Brand */}
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-emerald-900 font-bold">
                                S
                            </div>
                            <h3 className="text-lg font-bold text-white">Stiglja</h3>
                        </div>
                        <p className="text-emerald-300 mb-4 max-w-md">
                            The ultimate online Belot experience. Challenge players worldwide,
                            climb the ranks, and master the traditional card game.
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-emerald-400">
                                Made with passion for card game enthusiasts
                            </div>
                        </div>
                    </div>

                    {/* Game Links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Game</h4>
                        <ul className="space-y-2">
                            {footerLinks.game.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.href}
                                        className="text-emerald-300 hover:text-white transition-colors text-sm"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Community Links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Community</h4>
                        <ul className="space-y-2">
                            {footerLinks.community.map((link, index) => (
                                <li key={index}>
                                    <a
                                        href={link.href}
                                        className="text-emerald-300 hover:text-white transition-colors text-sm"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support Links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Support</h4>
                        <ul className="space-y-2">
                            {footerLinks.support.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.href}
                                        className="text-emerald-300 hover:text-white transition-colors text-sm"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-emerald-800 mt-8 pt-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-emerald-400 text-sm">
                            © {currentYear} Stiglja. All rights reserved.
                        </div>

                        <div className="flex items-center gap-6">
                            {footerLinks.legal.map((link, index) => (
                                <Link
                                    key={index}
                                    to={link.href}
                                    className="text-emerald-400 hover:text-emerald-200 transition-colors text-sm"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};