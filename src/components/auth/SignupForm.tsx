import React, { useState } from 'react';
import { Button, Input } from '../common';
import { useAuth } from '../../hooks/useAuth';

export interface SignupFormProps {
    onSuccess?: () => void;
    onSwitchToLogin?: () => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({
                                                          onSuccess,
                                                          onSwitchToLogin,
                                                      }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { signup, isSignupLoading } = useAuth();

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
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Signup form submitted:', formData);

        if (!validateForm()) {
            console.log('Form validation failed:', errors);
            return;
        }

        try {
            setErrors({}); // Clear any previous errors
            console.log('Attempting signup with:', {
                username: formData.username,
                email: formData.email
            });

            const result = await signup({
                username: formData.username,
                email: formData.email,
                password: formData.password
            });

            console.log('Signup successful:', result);
            onSuccess?.();
        } catch (error) {
            console.error('Signup error:', error);
            setErrors({
                submit: error instanceof Error ? error.message : 'Registration failed'
            });
        }
    };

    return (
        <div className="card max-w-md mx-auto">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
                <p className="text-slate-400">Join the game today</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    error={errors.username}
                    placeholder="Choose a username"
                    fullWidth
                    leftIcon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    }
                />

                <Input
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    placeholder="Enter your email"
                    fullWidth
                    leftIcon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
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
                    placeholder="Create a password"
                    fullWidth
                    leftIcon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    }
                />

                <Input
                    label="Confirm Password"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                    placeholder="Confirm your password"
                    fullWidth
                    leftIcon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                    isLoading={isSignupLoading}
                    disabled={isSignupLoading}
                >
                    {isSignupLoading ? 'Creating Account...' : 'Create Account'}
                </Button>


            </form>

            {onSwitchToLogin && (
                <div className="text-center mt-6">
                    <span className="text-slate-400">Already have an account? </span>
                    <button
                        onClick={onSwitchToLogin}
                        className="text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
                        type="button"
                    >
                        Sign in
                    </button>
                </div>
            )}
        </div>
    );
};