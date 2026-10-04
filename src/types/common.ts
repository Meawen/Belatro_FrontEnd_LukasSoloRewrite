export interface ApiError {
    message: string;
    status?: number;
}

export interface PaginationParams {
    page?: number;
    size?: number;
}

export interface ApiResponse<T> {
    data: T;
    message?: string;
    success: boolean;
}

/** A Spring Data page as the backend serializes it (e.g. GET /user/findAll). */
export interface Page<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    /** zero-based page index */
    number: number;
    size: number;
}

export interface Void {}

export interface Instant {
    // Timestamp representation - will be string in JSON
}

export type Role = 'ROLE_USER' | 'ROLE_ADMIN';

export type GameMode = 'CASUAL' | 'RANKED';

export type LobbyStatus = 'WAITING' | 'CLOSED';