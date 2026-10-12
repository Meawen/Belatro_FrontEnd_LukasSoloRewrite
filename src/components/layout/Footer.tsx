import React from 'react';
import { LegalLinks } from './LegalLinks';

export const Footer: React.FC = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-emerald-900 border-t border-emerald-700 py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center text-emerald-900 font-bold">
                            S
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Stiglja</h3>
                            <div className="text-emerald-400 text-sm">
                                © {currentYear} Stiglja. All rights reserved.
                            </div>
                        </div>
                    </div>

                    {/* Only routed pages and the support address (R-40) */}
                    <LegalLinks className="text-emerald-300" />
                </div>
            </div>
        </footer>
    );
};
