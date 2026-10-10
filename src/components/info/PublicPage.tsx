import React from 'react';
import { PublicFrame } from '../layout/PublicFrame';

export interface PublicPageProps {
    title: string;
    children: React.ReactNode;
}

/** The frame of the pages anyone may read, signed in or not: Privacy, Terms and Rules (spec §4.15). */
export const PublicPage: React.FC<PublicPageProps> = ({ title, children }) => (
    // PublicFrame is outside the app shell, so the way back to a running game comes there too (it hides when signed out)
    <PublicFrame title={title}>
        <div className="space-y-8">{children}</div>
    </PublicFrame>
);

/** One titled part of a public page. */
export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="space-y-3">
        <h2 className="t-headline text-text">{title}</h2>
        {children}
    </section>
);
