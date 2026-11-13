import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ME_CHANGED, useMe } from '../../hooks/useUser';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';
import { Banner } from '../ui';
import { useT } from '../../i18n/t';
import { formatLongDate } from '../../i18n/format';

/** Unverified accounts may play casual, not ranked; say so on every page until confirmed. */
export const UnverifiedEmailBanner: React.FC = () => {
    const { isAuthenticated, isGuest } = useAuth();
    // a guest has no address and no Settings (spec §3.3): nothing to confirm, so nothing to ask
    const { data: me, refetch } = useMe(isAuthenticated && !isGuest);
    const t = useT();
    const { pathname } = useLocation();
    // The address a resend answered 409 "Nothing to confirm" for: it can never be confirmed
    // (for example a malformed legacy value), so stop asking to confirm it.
    const [unconfirmable, setUnconfirmable] = useState<string | null>(null);
    // refetch is a new function on every render; the listener below registers once
    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;

    // This banner stays mounted across navigation and keeps its own /user/me: re-fetch when the
    // page changes the address or password (or a resend finds nothing to confirm).
    useEffect(() => {
        if (!isAuthenticated) return;
        const onMeChanged = () => {
            refetchRef.current().catch(() => {});
        };
        window.addEventListener(ME_CHANGED, onMeChanged);
        return () => window.removeEventListener(ME_CHANGED, onMeChanged);
    }, [isAuthenticated]);

    // a guest has no address and no Settings (spec §3.3): nothing to confirm
    // Doma's ranked button says the same and offers the same resend (spec §5)
    if (!isAuthenticated || isGuest || !me || me.emailVerified || pathname === '/dashboard') return null;

    const address = me.pendingEmail ?? me.email;
    // spec §2.1 (D-25): an unconfirmed account is removed on this day; null for one that never is (or an unreadable day)
    const removeDay = formatLongDate(me.verifyBy ?? '');
    const removal = removeDay ? t.shell.unverified.removeBy(removeDay) : null;

    // The button also fires ME_CHANGED, so the re-fetch above runs too: if the address was
    // confirmed in another tab since this page loaded, the banner goes.
    const handleNothingToConfirm = () => {
        setUnconfirmable(address);
    };

    return (
        <Banner label={t.shell.unverified.label} icon="mail">
            {address ? (
                <span className="flex flex-col items-start gap-2">
                    {unconfirmable === address ? (
                        <span>{t.shell.unverified.unconfirmable}{removal && <>{' '}{removal}</>}</span>
                    ) : (
                        // no promise of a mail: an address another account holds is accepted but never mailed
                        <span>{t.shell.unverified.confirm(address)}{removal && <>{' '}{removal}</>}</span>
                    )}
                    {/* a new address gets a fresh button, not the old one's "nothing to confirm" */}
                    <ResendConfirmationButton key={address} onNothingToConfirm={handleNothingToConfirm} />
                </span>
            ) : (
                <span>
                    {t.shell.unverified.noAddress}{removal && <>{' '}{removal}</>}{' '}
                    {/* X-11: e-mail management lives in Settings → Account (D-32) */}
                    <Link to="/settings" className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-2">
                        {t.shell.unverified.openSettings}
                    </Link>
                </span>
            )}
        </Banner>
    );
};
