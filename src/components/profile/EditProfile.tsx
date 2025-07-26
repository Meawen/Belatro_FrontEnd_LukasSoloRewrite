import React, { useState } from 'react';
import { Button, Input } from '../common';
import { useUser } from '../../hooks/useUser';
import type { User, UserUpdateDTO } from '../../types/user';

export interface EditProfileProps {
    user: User;
    onSuccess: () => void;
    onCancel: () => void;
}

interface EditProfileFormData {
    username: string;
    email: string;
}

export const EditProfile: React.FC<EditProfileProps> = ({
                                                            user,
                                                            onSuccess,
                                                            onCancel
                                                        }) => {
    const [formData, setFormData] = useState<EditProfileFormData>({
        username: user.username || '',
        email: user.email || ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { updateUser, isUpdating } = useUser(user.id || undefined);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate form
        const newErrors: Record<string, string> = {};

        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            const updateData: UserUpdateDTO = {
                username: formData.username.trim(),
                email: formData.email.trim(),
                passwordHashed: null,
                eloRating: null,
                level: null,
                expPoints: null,
                lastLogin: null,
                gamesPlayed: null
            };

            await updateUser(updateData);
            onSuccess();
        } catch (error) {
            setErrors({
                submit: error instanceof Error ? error.message : 'Failed to update profile'
            });
        }
    };

    const handleChange = (field: keyof EditProfileFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <Input
                label="Username"
                type="text"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                error={errors.username}
                placeholder="Enter username..."
                required
                maxLength={30}
            />

            {/* Email */}
            <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                error={errors.email}
                placeholder="Enter email address..."
                required
            />

            {/* Submit Error */}
            {errors.submit && (
                <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
                    {errors.submit}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isUpdating}
                    className="flex-1"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={isUpdating}
                    isLoading={isUpdating}
                    className="flex-1"
                >
                    Save Changes
                </Button>
            </div>
        </form>
    );
};