import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLinks } from '../layout/LegalLinks';

export interface PublicPageProps {
    title: string;
    children: React.ReactNode;
}

/** The frame of the pages anyone may read, signed in or not: Privacy, Terms and Rules. */
export const PublicPage: React.FC<PublicPageProps> = ({ title, children }) => (
    <div className="min-h-screen bg-emerald-950 text-emerald-100">
        <div className="max-w-3xl mx-auto px-4 py-10">
            <Link to="/" className="text-amber-400 hover:text-amber-300 font-bold">
                ← Stiglja
            </Link>
            <h1 className="text-3xl font-bold text-white mt-6 mb-8">{title}</h1>
            <div className="space-y-8 leading-relaxed">{children}</div>
            <footer className="mt-12 pt-6 border-t border-emerald-800">
                <LegalLinks className="text-emerald-300" />
            </footer>
        </div>
    </div>
);

/** One titled part of a public page. */
export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {children}
    </section>
);
