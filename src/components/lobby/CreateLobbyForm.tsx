import React, { useState } from 'react';
import { Button, Input, Select, Checkbox } from '../common';
import { useLobbies } from '../../hooks/useLobby';
import type { CreateLobbyDTO } from '../../types/lobby';

export interface CreateLobbyFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

interface CreateLobbyFormData {
    name: string;
    gameMode: string;
    privateLobby: boolean;
    password: string;
}

export const CreateLobbyForm: React.FC<CreateLobbyFormProps> = ({
                                                                    onSuccess,
                                                                    onCancel
                                                                }) => {
    const [formData, setFormData] = useState<CreateLobbyFormData>({
        name: '',
        gameMode: 'CASUAL',
        privateLobby: false,
        password: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { createLobby, isCreating } = useLobbies();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate form
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Lobby name is required';
        }

        if (formData.privateLobby && !formData.password.trim()) {
            newErrors.password = 'Password is required for private lobbies';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            // The caller becomes the host server-side; the server also fixes the mode to CASUAL.
            const lobbyData: CreateLobbyDTO = {
                name: formData.name.trim(),
                privateLobby: formData.privateLobby,
                password: formData.privateLobby ? formData.password : null
            };

            await createLobby(lobbyData);
            onSuccess();
        } catch (error) {
            setErrors({
                submit: error instanceof Error ? error.message : 'Failed to create lobby'
            });
        }
    };

    const handleChange = (field: keyof CreateLobbyFormData, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Lobby Name */}
            <div>
                <Input
                    label="Lobby Name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    error={errors.name}
                    placeholder="Enter lobby name..."
                    required
                    maxLength={50}
                />
            </div>

            {/* Game Mode */}
            <div>
                <Select
                    label="Game Mode"
                    value={formData.gameMode}
                    onChange={(e) => handleChange('gameMode', e.target.value)}
                    options={[
                        { value: 'CASUAL', label: '🎮 Casual' },
                        { value: 'RANKED', label: '🏆 Ranked' }
                    ]}
                    required
                />
                <p className="text-xs text-slate-400 mt-1">
                    {formData.gameMode === 'RANKED'
                        ? 'Ranked games affect your ELO rating'
                        : 'Casual games are for fun and practice'
                    }
                </p>
            </div>

            {/* Private Lobby */}
            <div>
                <Checkbox
                    label="Private Lobby"
                    description="Private lobbies require a password to join"
                    checked={formData.privateLobby}
                    onChange={(checked) => handleChange('privateLobby', checked)}
                />
            </div>

            {/* Password (if private) */}
            {formData.privateLobby && (
                <div>
                    <Input
                        label="Password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleChange('password', e.target.value)}
                        error={errors.password}
                        placeholder="Enter lobby password..."
                        required
                        maxLength={20}
                    />
                </div>
            )}

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
                    disabled={isCreating}
                    className="flex-1"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={isCreating}
                    className="flex-1"
                >
                    {isCreating ? 'Creating...' : 'Create Lobby'}
                </Button>
            </div>
        </form>
    );
};