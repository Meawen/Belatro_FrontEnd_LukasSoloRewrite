export interface LoginRequestDTO {
    username: string | null;
    password: string | null;
}

export interface SignupRequestDTO {
    username: string | null;
    email: string | null;
    password: string | null;
}

export interface UserLoginDetailsDTO {
    id: string | null;
    username: string | null;
}

export interface JwtResponseDTO {
    token: string | null;
    user: UserLoginDetailsDTO | null;
    message: string | null;
}