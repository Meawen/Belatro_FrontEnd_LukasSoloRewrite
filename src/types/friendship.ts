import type {User} from './user';

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface Friendship {
    id: string | null;
    fromUser: User | null;
    toUser: User | null;
    status: FriendshipStatus | null;
    createdAt: string | null; // ISO date string
}

export interface CreateFriendshipDTO {
    fromUserId: string | null;
    toUserId: string | null;
    status: FriendshipStatus | null;
}