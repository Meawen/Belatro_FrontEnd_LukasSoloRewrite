import React from 'react';
import { Link } from 'react-router-dom';

/** The players' one contact address; Cloudflare Email Routing forwards it to the owner. */
export const SUPPORT_EMAIL = 'support@stiglja.com';

/** The support address as a mail link, for running text. */
export const SupportEmailLink: React.FC = () => (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-amber-400 hover:text-amber-300 underline">
        {SUPPORT_EMAIL}
    </a>
);

export interface LegalLinksProps {
    className?: string;
}

/**
 * The links every visitor may follow, signed in or not: in the footer, on the sign-in page and
 * on the public pages (R-40). Only routed pages and the support address.
 */
export const LegalLinks: React.FC<LegalLinksProps> = ({ className = '' }) => (
    <nav aria-label="Site links" className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-sm ${className}`}>
        <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white transition-colors">Contact: {SUPPORT_EMAIL}</a>
    </nav>
);
