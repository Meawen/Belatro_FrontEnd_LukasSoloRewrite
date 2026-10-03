import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ErrorAlert, Input } from '../common';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure, SOMETHING_WENT_WRONG, WAIT_AND_RETRY } from '../../utils/errorMessage';
import { EMAIL_PATTERN } from './credentialRules';

export const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [hint, setHint] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // stops a second submit that lands before React re-renders the button as disabled
    const sending = useRef(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sending.current) return;
        const address = email.trim();
        setHint(null);
        if (!EMAIL_PATTERN.test(address)) {
            setError('Email is invalid');
            return;
        }
        setError(null);
        sending.current = true;
        setIsSubmitting(true);
        try {
            await authService.forgotPassword(address);
            setSent(true);
        } catch (err) {
            const status = err instanceof ApiError ? err.status : 0;
            // a network failure or a 5xx carries the browser's or Spring's text ("Failed to fetch", "Internal Server Error")
            setError(isNetworkOrServerFailure(status) ? SOMETHING_WENT_WRONG : errorMessage(err, SOMETHING_WENT_WRONG));
            if (status === 429) setHint(WAIT_AND_RETRY);
        } finally {
            sending.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
            <div className="card max-w-md w-full space-y-6">
                <h1 className="text-2xl font-bold text-white text-center">Forgot your password?</h1>

                {sent ? (
                    // The same sentence whether or not the address has an account.
                    <p className="text-emerald-200 text-center">
                        If that address has an account, we sent a link to reset your password. The link works for 15 minutes.
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            fullWidth
                        />
                        <ErrorAlert message={error} />
                        {hint && <p className="text-sm text-slate-400">{hint}</p>}
                        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
                            Send reset link
                        </Button>
                    </form>
                )}

                <p className="text-center text-sm">
                    <Link to="/login" className="text-yellow-500 hover:text-yellow-400">Back to sign in</Link>
                </p>
            </div>
        </div>
    );
};
