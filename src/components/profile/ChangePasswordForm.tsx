import React, { useState } from 'react';
import { Button, Input } from '../common';
// direct module import (not the ../../hooks barrel): keeps component tests from
// loading every hook module, incl. the WebSocket ones
import { useMutation } from '../../hooks/useApi';
import { userService } from '../../services/userService';
import { ApiError } from '../../services/api';
import type { ChangePasswordRequest } from '../../types/user';

export interface ChangePasswordFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

interface ChangePasswordFormData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onSuccess, onCancel }) => {
    const [formData, setFormData] = useState<ChangePasswordFormData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const changePasswordMutation = useMutation((request: ChangePasswordRequest) =>
        userService.changePassword(request)
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};
        if (!formData.currentPassword) {
            newErrors.currentPassword = 'Current password is required';
        }
        if (!formData.newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (formData.newPassword.length < 6) {
            newErrors.newPassword = 'Password must be at least 6 characters';
        }
        if (formData.confirmPassword !== formData.newPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            await changePasswordMutation.mutate({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword
            });
            onSuccess();
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                setErrors({ submit: 'Current password is incorrect' });
            } else {
                setErrors({
                    submit: error instanceof Error ? error.message : 'Failed to change password'
                });
            }
        }
    };

    const handleChange = (field: keyof ChangePasswordFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    // noValidate: the form renders its own inline errors below each field, so
    // native browser constraint bubbles must not pre-empt handleSubmit
    return (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <Input
                label="Current Password"
                type="password"
                value={formData.currentPassword}
                onChange={(e) => handleChange('currentPassword', e.target.value)}
                error={errors.currentPassword}
                placeholder="Enter current password..."
                required
            />
            <Input
                label="New Password"
                type="password"
                value={formData.newPassword}
                onChange={(e) => handleChange('newPassword', e.target.value)}
                error={errors.newPassword}
                placeholder="Enter new password..."
                required
            />
            <Input
                label="Confirm New Password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                error={errors.confirmPassword}
                placeholder="Repeat new password..."
                required
            />

            {errors.submit && (
                <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                    {errors.submit}
                </div>
            )}

            <div className="flex gap-3 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={changePasswordMutation.isLoading}
                    className="flex-1"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={changePasswordMutation.isLoading}
                    isLoading={changePasswordMutation.isLoading}
                    className="flex-1"
                >
                    Change Password
                </Button>
            </div>
        </form>
    );
};
