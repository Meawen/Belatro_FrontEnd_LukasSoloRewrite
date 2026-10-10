import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ME_CHANGED, useMe } from '../../hooks/useUser';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';
import { Banner } from '../ui';

/** Unverified accounts may play casual, not ranked; say so on every page until confirmed. */
export const UnverifiedEmailBanner: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const { data: me, refetch } = useMe(isAuthenticated);
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

    if (!isAuthenticated || !me || me.emailVerified) return null;

    const address = me.pendingEmail ?? me.email;

    // The button also fires ME_CHANGED, so the re-fetch above runs too: if the address was
    // confirmed in another tab since this page loaded, the banner goes.
    const handleNothingToConfirm = () => {
        setUnconfirmable(address);
    };

    return (
        <Banner label="Email confirmation" icon="mail">
            {address ? (
                <span className="flex flex-col items-start gap-2">
                    {unconfirmable === address ? (
                        <span>Add or change your email address to play ranked.</span>
                    ) : (
                        // no promise of a mail: an address another account holds is accepted but never mailed
                        <span>Confirm {address} to play ranked: use the link if one arrived, or ask for a new one.</span>
                    )}
                    {/* a new address gets a fresh button, not the old one's "nothing to confirm" */}
                    <ResendConfirmationButton key={address} onNothingToConfirm={handleNothingToConfirm} />
                </span>
            ) : (
                <span>
                    Add an email address to play ranked.{' '}
                    {/* X-11: e-mail management lives in Settings → Account (D-32) */}
                    <Link to="/settings" className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-2">
                        Open settings
                    </Link>
                </span>
            )}
        </Banner>
    );
};
