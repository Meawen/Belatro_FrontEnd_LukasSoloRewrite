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

/** One titled part of a public page: an h2, or an h3 inside a larger part (the Rules page's full rules). */
export const Section: React.FC<{ title: string; level?: 2 | 3; id?: string; children: React.ReactNode }> = ({ title, level = 2, id, children }) => {
    const Heading = level === 3 ? 'h3' : 'h2';
    return (
        <section id={id} className="scroll-mt-6 space-y-3">
            <Heading className="t-headline text-text">{title}</Heading>
            {children}
        </section>
    );
};
