import React from 'react';
import { cx } from '../ui/cx';
import { LegalLinks } from './LegalLinks';

export interface FooterProps {
    /** The column it lines up with: 'list' (880 px, the shell) or 'read' (680 px, the public frame). */
    width?: 'list' | 'read';
}

/** At the bottom of every page but the game (R-40 as amended): the year, the card art's credit and the routed links. */
export const Footer: React.FC<FooterProps> = ({ width = 'list' }) => (
    <footer className="mt-auto px-4 pt-5 pb-8 shadow-[inset_0_3px_0_var(--edge)] md:px-8">
        <div className={cx('mx-auto flex flex-col gap-1 md:flex-row md:items-center md:justify-between', width === 'read' ? 'max-w-[680px]' : 'max-w-[880px]')}>
            {/* The card art's credit (owner, 2026-10-11) */}
            <p className="t-footnote text-text-3">© {new Date().getFullYear()} Stiglja · Card art by Maks Markovic</p>
            {/* Only routed pages and the support address (R-40) */}
            <LegalLinks />
        </div>
    </footer>
);
