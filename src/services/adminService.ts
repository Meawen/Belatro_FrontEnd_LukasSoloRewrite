import { apiClient } from './api';
import type {
    UserDto,
    Void,
} from '../types';

export const adminService = {
    async listUsers(): Promise<UserDto[]> {
        return apiClient.get<UserDto[]>('/admin/users');
    },

    async forgetUser(id: string): Promise<Void> {
        return apiClient.delete<Void>(`/admin/user/${id}`);
    }
};