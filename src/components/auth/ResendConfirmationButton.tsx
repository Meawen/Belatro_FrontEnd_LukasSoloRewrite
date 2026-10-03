import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';
// direct module import (not the ../../hooks barrel) keeps tests off the WebSocket hooks
import { useMutation } from '../../hooks/useApi';
import { notifyMeChanged } from '../../hooks/useUser';
import { userService } from '../../services/userService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure, WAIT_AND_RETRY } from '../../utils/errorMessage';

export interface ResendConfirmationButtonProps {
    /** Opens the change-of-address form. Without it, "nothing to confirm" links to the profile, where the form is. */
    onChangeEmail?: () => void;
    /** Told when the server answers 409 "Nothing to confirm", so a caller can stop asking to confirm the address. */
    onNothingToConfirm?: () => void;
}

const ADD_OR_CHANGE = 'Add or change your email address';

/** Re-sends the confirmation link for the pending (or legacy unconfirmed) address. */
export const ResendConfirmationButton: React.FC<ResendConfirmationButtonProps> = ({ onChangeEmail, onNothingToConfirm }) => {
    const [message, setMessage] = useState<string | null>(null);
    // the line's colour follows the outcome: a sent link reads as success, anything else as failure
    const [failed, setFailed] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    // 409: the address on file can never be confirmed (or there is none). Another resend would
    // answer the same, so the button gives way to the prompt for a new address.
    const [nothingToConfirm, setNothingToConfirm] = useState(false);
    // stops a second click that lands before React re-renders the button as disabled
    const sending = useRef(false);
    const resend = useMutation(() => userService.resendEmailConfirmation());

    const handleClick = async () => {
        if (sending.current) return;
        sending.current = true;
        setMessage(null);
        setHint(null);
        try {
            await resend.mutate();
            setFailed(false);
            // no promise of a mail: the address may belong to another account by now
            setMessage('If the address can still be confirmed, a new link is on its way.');
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0;
            setFailed(true);
            setMessage(isNetworkOrServerFailure(status) ? 'We could not send the email. Try again.' : errorMessage(error, 'Could not send the email'));
            if (status === 409) {
                setNothingToConfirm(true);
                onNothingToConfirm?.();
                // what the page shows may be stale (for example confirmed in another tab)
                notifyMeChanged();
            }
            if (status === 429) setHint(WAIT_AND_RETRY);
        } finally {
            sending.current = false;
        }
    };

    if (nothingToConfirm) {
        return (
            <span className="inline-flex flex-wrap items-center gap-2">
                <span role="status" className="text-sm text-amber-200">{message}</span>
                {onChangeEmail ? (
                    <Button variant="outline" size="small" onClick={onChangeEmail}>
                        {ADD_OR_CHANGE}
                    </Button>
                ) : (
                    <Link to="/profile" className="text-sm underline text-amber-200 hover:text-white">
                        {ADD_OR_CHANGE}
                    </Link>
                )}
            </span>
        );
    }

    return (
        <span className="inline-flex flex-wrap items-center gap-2">
            <Button
                variant="outline"
                size="small"
                onClick={handleClick}
                disabled={resend.isLoading}
                isLoading={resend.isLoading}
            >
                Resend confirmation email
            </Button>
            {message && <span role="status" className={`text-sm ${failed ? 'text-red-300' : 'text-emerald-200'}`}>{message}</span>}
            {hint && <span className="text-sm text-slate-400">{hint}</span>}
        </span>
    );
};
