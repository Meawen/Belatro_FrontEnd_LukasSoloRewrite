import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, EmptyState, ErrorState, Input, Loader, Panel, PixelIcon, Segmented, Sheet, Tag } from '../ui';
import { ErrorAlert } from '../common/ErrorAlert';
import { useMediaQuery } from '../layout/useMediaQuery';
import { useAdmin } from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import type { UserDto } from '../../types/user';
import { errorMessage } from '../../utils/errorMessage';

/** Phones get one panel per user instead of the table (spec §4.14). */
export const USER_ROWS_QUERY = '(max-width: 767.98px)';

type SortBy = 'username' | 'email';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: 'username', label: 'Username' },
    { value: 'email', label: 'Email' },
];

const getRoleDisplay = (roles: string[] | null) => {
    if (!roles || roles.length === 0) return 'User';
    return roles.map(role => role.replace('ROLE_', '')).join(', ');
};

const StatusTag = ({ user }: { user: UserDto }) =>
    user.deletionRequested ? <Tag tone="bad">Deletion Requested</Tag> : <Tag>Active</Tag>;

export const UserManagement: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortBy>('username');
    const headingId = useId();

    const { users, isLoading, error, forgetUser, refetch, isForgettingUser } = useAdmin();
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const asPanels = useMediaQuery(USER_ROWS_QUERY);

    // Filter and sort users
    const filteredUsers = React.useMemo(() => {
        if (!users) return [];

        let filtered = users.filter((user: UserDto) => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return user.username?.toLowerCase().includes(term) ||
                    user.email?.toLowerCase().includes(term) ||
                    user.id?.toLowerCase().includes(term);
            }
            return true;
        });

        filtered.sort((a: UserDto, b: UserDto) => {
            switch (sortBy) {
                case 'username':
                    return (a.username || '').localeCompare(b.username || '');
                case 'email':
                    return (a.email || '').localeCompare(b.email || '');
                default:
                    return 0;
            }
        });

        return filtered;
    }, [users, searchTerm, sortBy]);

    const askToDelete = (user: UserDto) => {
        setDeleteError(null);
        setSelectedUser(user);
        setConfirming(true);
    };

    const handleForgetUser = async () => {
        if (!selectedUser?.id) return;
        setDeleteError(null);
        try {
            await forgetUser(selectedUser.id);
            setConfirming(false);
        } catch (failure) {
            // X-7: a failed delete says so (it only reached the console), and the dialog stays open
            setDeleteError(errorMessage(failure, 'Failed to delete the user'));
        }
    };

    // the refetch after a delete keeps the list (and the dialog) on screen: the loader is for the first load only
    if (isLoading && users.length === 0) {
        return <Loader text="Loading users..." />;
    }

    if (error && users.length === 0) {
        return (
            <Panel>
                <ErrorState
                    title="Error Loading Users"
                    body="Failed to load user management"
                    action={
                        <Button variant="secondary" onClick={() => refetch().catch(() => {})}>
                            Try Again
                        </Button>
                    }
                />
            </Panel>
        );
    }

    const actions = (user: UserDto) => (
        <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/profile/${user.id}`)}>
                View
            </Button>
            {user.id !== currentUser?.id && (
                <Button variant="danger" size="sm" disabled={isForgettingUser} onClick={() => askToDelete(user)}>
                    Delete
                </Button>
            )}
        </div>
    );

    const identity = (user: UserDto) => {
        const isMe = user.id === currentUser?.id;
        return (
            <div className="flex min-w-0 items-center gap-3">
                <Avatar size="sm" initial={user.username || '?'} tone={isMe ? 'accent' : 'neutral'} />
                <div className="min-w-0">
                    <div className="t-headline flex flex-wrap items-center gap-2 break-words">
                        {user.username || 'Unknown'}
                        {isMe && <Tag tone="you">You</Tag>}
                    </div>
                    <div className="t-footnote break-all text-text-3">ID: {user.id}</div>
                </div>
            </div>
        );
    };

    let list;
    if (filteredUsers.length === 0) {
        list = (
            <Panel>
                <EmptyState
                    icon="people"
                    title="No Users Found"
                    body={searchTerm ? 'No users match your search criteria.' : 'No users available.'}
                />
            </Panel>
        );
    } else if (asPanels) {
        list = (
            <ul className="flex flex-col gap-2">
                {filteredUsers.map((user: UserDto) => (
                    <li key={user.id}>
                        <Panel className="flex flex-col gap-3">
                            {identity(user)}
                            <p className="t-footnote break-all text-text-2">{user.email || 'N/A'}</p>
                            <div className="flex flex-wrap gap-2">
                                <Tag>{getRoleDisplay(user.roles)}</Tag>
                                <StatusTag user={user} />
                            </div>
                            {actions(user)}
                        </Panel>
                    </li>
                ))}
            </ul>
        );
    } else {
        list = (
            <Panel padding="none" className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="t-caption text-text-2">
                            <th scope="col" className="px-4 py-3">User</th>
                            <th scope="col" className="px-4 py-3">Email</th>
                            <th scope="col" className="px-4 py-3">Role</th>
                            <th scope="col" className="px-4 py-3">Status</th>
                            <th scope="col" className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user: UserDto) => (
                            <tr key={user.id} className="border-t-2 border-edge align-middle">
                                <td className="px-4 py-3">{identity(user)}</td>
                                <td className="t-callout break-all px-4 py-3 text-text-2">{user.email || 'N/A'}</td>
                                <td className="px-4 py-3">
                                    <Tag>{getRoleDisplay(user.roles)}</Tag>
                                </td>
                                <td className="px-4 py-3">
                                    <StatusTag user={user} />
                                </td>
                                <td className="px-4 py-3">{actions(user)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Panel>
        );
    }

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 id={headingId} className="t-title">
                        User Management
                    </h2>
                    <p className="t-callout mt-1 text-text-2">
                        {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
                    </p>
                </div>
                <Button variant="secondary" size="sm" leftIcon={<PixelIcon name="refresh" />} onClick={() => refetch().catch(() => {})}>
                    Refresh
                </Button>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <Input
                    className="flex-1"
                    label="Search users"
                    hideLabel
                    type="text"
                    placeholder="Search by username, email, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Segmented label="Sort by" options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
            </div>

            {list}

            <Sheet open={confirming} onClose={() => setConfirming(false)} title="Confirm User Deletion" dismissible={!isForgettingUser}>
                {selectedUser && (
                    <div className="flex flex-col gap-4">
                        <div className="notch bg-surface-2 px-4 py-3 shadow-[inset_3px_0_0_var(--danger)]">
                            <p className="t-headline flex items-center gap-2 text-danger-text">
                                <PixelIcon name="warning" />
                                Warning
                            </p>
                            <p className="t-callout mt-2">
                                Delete the account of{' '}
                                <strong>{selectedUser.username}</strong>? This cannot be undone.
                            </p>
                            {/* What AdminService.forgetUser removes (R-40); the rest is the owner's manual 30-day process */}
                            <p className="t-callout mt-2">
                                Deletes the user record; friendships, match history and rank history remain.
                            </p>
                        </div>

                        <ErrorAlert message={deleteError} />

                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={isForgettingUser}>
                                Cancel
                            </Button>
                            <Button variant="danger" onClick={handleForgetUser} loading={isForgettingUser}>
                                Delete User
                            </Button>
                        </div>
                    </div>
                )}
            </Sheet>
        </section>
    );
};
