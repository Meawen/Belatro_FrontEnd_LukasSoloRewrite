
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../common';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { isNetworkOrServerFailure, SOMETHING_WENT_WRONG } from '../../utils/errorMessage';

export interface LoginFormProps {
    onSuccess?: () => void;
    onSwitchToSignup?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
                                                        onSuccess,
                                                        onSwitchToSignup,
                                                    }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { login, isLoginLoading } = useAuth();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Login form submitted:', { username: formData.username });

        if (!validateForm()) {
            console.log('Form validation failed:', errors);
            return;
        }

        try {
            setErrors({}); // Clear any previous errors
            console.log('Attempting login with:', { username: formData.username });

            const result = await login({
                username: formData.username.trim(),
                password: formData.password
            });

            console.log('Login successful:', { username: result.user?.username });
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
        <div className="card max-w-md mx-auto">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
                <p className="text-slate-400">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    error={errors.username}
                    placeholder="Enter your username"
                    fullWidth
                    leftIcon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    }
                />

                <Input
                    label="Password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    placeholder="Enter your password"
                    fullWidth
                    leftIcon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    }
                />

                {errors.submit && (
                    <div className="text-red-500 text-sm text-center bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                        {errors.submit}
                    </div>
                )}

                <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    isLoading={isLoginLoading}
                    disabled={isLoginLoading}
                >
                    {isLoginLoading ? 'Signing In...' : 'Sign In'}
                </Button>


            </form>

            <div className="text-center mt-4">
                <Link to="/forgot-password" className="text-sm text-yellow-500 hover:text-yellow-400">
                    Forgot password?
                </Link>
            </div>

            {onSwitchToSignup && (
                <div className="text-center mt-6">
                    <span className="text-slate-400">Don't have an account? </span>
                    <button
                        onClick={onSwitchToSignup}
                        className="text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
                        type="button"
                    >
                        Sign up
                    </button>
                </div>
            )}
        </div>
    );
};