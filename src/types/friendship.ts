import type {User} from './user';

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface Friendship {
    id: string | null;
    fromUser: User | null;
    toUser: User | null;
    status: FriendshipStatus | null;
    createdAt: string | null; // ISO date string
}

/** POST /friendship. The caller is the sender. */
export interface CreateFriendshipDTO {
    toUserId: string;
}