import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { isNetworkOrServerFailure, SOMETHING_WENT_WRONG } from '../../utils/errorMessage';
import { AUTH_LINK } from './AuthFrame';
import { useReturnState } from './returnState';

export interface LoginFormProps {
    onSuccess?: () => void;
}

/** Sign in (spec §4.2). "Sign up" is the other URL (X-2); both links carry the return path (§4.1). */
export function LoginForm({ onSuccess }: LoginFormProps) {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { login, isLoginLoading } = useAuth();
    const returnState = useReturnState();

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
            newErrors.username = 'Username is required';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
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
                submit: isNetworkOrServerFailure(status) ? SOMETHING_WENT_WRONG : error instanceof Error ? error.message : 'Login failed'
            });
        }
    };

    return (
        <>
            <div className="mb-6 text-center">
                <h1 className="t-title">Welcome Back</h1>
                <p className="t-callout mt-2 text-text-2">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label="Username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    error={errors.username}
                    placeholder="Enter your username"
                />

                <Input
                    label="Password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    placeholder="Enter your password"
                />

                <ErrorAlert message={errors.submit ?? null} />

                <Button type="submit" block loading={isLoginLoading}>
                    {isLoginLoading ? 'Signing In...' : 'Sign In'}
                </Button>
            </form>

            <p className="t-callout mt-4 text-center">
                <Link to="/forgot-password" state={returnState} className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>
                    Forgot password?
                </Link>
            </p>

            <p className="t-callout mt-1 text-center text-text-2">
                Don't have an account?{' '}
                <Link to="/signup" state={returnState} className={`inline-flex min-h-11 items-center ${AUTH_LINK}`}>
                    Sign up
                </Link>
            </p>
        </>
    );
}
