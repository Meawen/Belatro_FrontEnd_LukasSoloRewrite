import React from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../ui/cx';
import { useT } from '../../i18n/t';

/** The players' one contact address; Cloudflare Email Routing forwards it to the owner. */
export const SUPPORT_EMAIL = 'support@stiglja.com';

/** The support address as a mail link, for running text. */
export const SupportEmailLink: React.FC = () => (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent underline underline-offset-2 hover:text-text">
        {SUPPORT_EMAIL}
    </a>
);

export interface LegalLinksProps {
    className?: string;
}

const LINK = 'inline-flex min-h-11 items-center text-text-2 underline-offset-4 hover:text-text hover:underline';

/**
 * The links every visitor may follow, signed in or not: in the footer, on the sign-in page and
 * on the public pages (R-40). Only routed pages and the support address.
 */
export const LegalLinks: React.FC<LegalLinksProps> = ({ className = '' }) => {
    const t = useT();
    return (
        <nav aria-label={t.shell.links.label} className={cx('t-footnote flex flex-wrap items-center gap-x-5', className)}>
            <Link to="/rules" className={LINK}>{t.shell.links.rules}</Link>
            <Link to="/privacy" className={LINK}>{t.shell.links.privacy}</Link>
            <Link to="/terms" className={LINK}>{t.shell.links.terms}</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>{t.shell.links.contact} {SUPPORT_EMAIL}</a>
        </nav>
    );
};
