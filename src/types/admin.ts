import type {UserDto} from './user';

export interface AdminUserListResponse {
    users: UserDto[];
    total: number;
}

export interface ForgetUserRequest {
    userId: string;
    reason?: string;
}

export interface AdminStats {
    totalUsers: number;
    activeUsers: number;
    totalMatches: number;
    totalLobbies: number;
    pendingDeletions: number;
}