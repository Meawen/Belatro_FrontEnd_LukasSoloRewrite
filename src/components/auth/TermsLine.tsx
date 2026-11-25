import { useT } from '../../i18n/t';

/** A link inside running text (the R-40 line): underlined, in the accent. */
const TEXT_LINK = 'text-accent underline underline-offset-2 hover:text-text';

/**
 * R-40: the Terms and the Privacy notice, under the button that makes an account (the sign-up form, Google's name step).
 * They open in a new tab, so what was typed stays.
 */
export function TermsLine() {
    const t = useT();
    return (
        <p className="t-footnote text-center text-text-2">
            {t.auth.signUp.termsBefore}{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>{t.auth.signUp.termsLink}</a>{t.auth.signUp.termsBetween}{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>{t.auth.signUp.privacyLink}</a>.
        </p>
    );
}
