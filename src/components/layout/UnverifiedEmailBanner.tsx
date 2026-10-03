import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ME_CHANGED, useMe } from '../../hooks/useUser';
import { ResendConfirmationButton } from '../auth/ResendConfirmationButton';

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
        <div
            role="region"
            aria-label="Email confirmation"
            className="bg-amber-900/30 border-b border-amber-600/40 px-6 py-3 flex flex-wrap items-center gap-3 text-sm text-amber-100"
        >
            {address ? (
                <>
                    {unconfirmable === address ? (
                        <span>Add or change your email address to play ranked.</span>
                    ) : (
                        // no promise of a mail: an address another account holds is accepted but never mailed
                        <span>Confirm {address} to play ranked: use the link if one arrived, or ask for a new one.</span>
                    )}
                    {/* a new address gets a fresh button, not the old one's "nothing to confirm" */}
                    <ResendConfirmationButton key={address} onNothingToConfirm={handleNothingToConfirm} />
                </>
            ) : (
                <span>
                    Add an email address to play ranked.{' '}
                    <Link to="/profile" className="underline text-amber-200 hover:text-white">Open your profile</Link>
                </span>
            )}
        </div>
    );
};
