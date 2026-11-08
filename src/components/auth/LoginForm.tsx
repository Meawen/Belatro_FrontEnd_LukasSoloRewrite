import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, type ButtonVariant } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { errorMessage, isNetworkOrServerFailure } from '../../utils/errorMessage';
import { localiseLoginError } from '../../i18n/serverErrors';
import { cat, useT } from '../../i18n/t';
import { AUTH_LINK } from './AuthFrame';
import { useReturnState } from './returnState';

export interface LoginFormProps {
    onSuccess?: () => void;
    /** Sign In's variant: secondary under a friend's table door, whose "Sit down as a guest" is the page's primary (AuthPage). */
    submitVariant?: ButtonVariant;
    /** 2 under a friend's table door, whose own h1 opens the page (AuthPage, R1-01); 1 everywhere else. */
    headingLevel?: 1 | 2;
}

/** Sign in (spec §4.2). "Sign up" is the other URL (X-2); both links carry the return path (§4.1). */
export function LoginForm({ onSuccess, submitVariant = 'primary', headingLevel = 1 }: LoginFormProps) {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { login, isLoginLoading } = useAuth();
    const returnState = useReturnState();
    const t = useT();
    const Heading = headingLevel === 2 ? 'h2' : 'h1';

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.username.trim()) {
            newErrors.username = cat().forms.usernameRequired;
        }

        if (!formData.password) {
            newErrors.password = cat().forms.passwordRequired;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            setErrors({}); // Clear any previous errors

            await login({
                username: formData.username.trim(),
                password: formData.password
            });

            onSuccess?.();
        } catch (error) {
            console.error('Login error:', error);
            // a 500 while the backend's session store is down, or no answer: not the raw text
            const status = error instanceof ApiError ? error.status : 0;
            setErrors({
                submit: isNetworkOrServerFailure(status) ? cat().errors.generic : error instanceof ApiError ? localiseLoginError(error) : errorMessage(error, cat().auth.signIn.failed)
            });
        }
    };

    return (
        <>
            <div className="mb-6 text-center">
                <Heading className="t-title">{t.auth.signIn.heading}</Heading>
                <p className="t-callout mt-2 text-text-2">{t.auth.signIn.subtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label={t.forms.username}
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    error={errors.username}
                    placeholder={t.auth.signIn.usernamePlaceholder}
                />

                <Input
                    label={t.forms.password}
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    placeholder={t.auth.signIn.passwordPlaceholder}
                />

                <ErrorAlert message={errors.submit ?? null} />

                <Button type="submit" variant={submitVariant} block loading={isLoginLoading}>
                    {isLoginLoading ? t.auth.signIn.submitting : t.auth.signIn.submit}
                </Button>
            </form>

            <p className="t-callout mt-4 text-center">
                <Link to="/forgot-password" state={returnState} className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>
                    {t.auth.signIn.forgot}
                </Link>
            </p>

            <p className="t-callout mt-1 text-center text-text-2">
                {t.auth.signIn.noAccount}{' '}
                <Link to="/signup" state={returnState} className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>
                    {t.auth.signIn.signUpLink}
                </Link>
            </p>
        </>
    );
}
