import React from 'react';
import { AdminStats } from './AdminStats';
import { UserManagement } from './UserManagement';
import { useMe } from '../../hooks/useUser';
import { ErrorState, Loader, Panel } from '../ui';

/** /admin (spec §4.14): only for ROLE_ADMIN per GET /user/me; the real statistics and the user management. */
export const AdminDashboard: React.FC = () => {
    // Roles come only from GET /user/me; the stored login user never carried them.
    const { data: me, error } = useMe();

    if (!me && !error) {
        return <Loader text="Checking permissions..." />;
    }

    const isAdmin = me?.roles?.includes('ROLE_ADMIN') ?? false;

    if (!isAdmin) {
        return (
            <Panel>
                <ErrorState icon="lock" title="Access Denied" body="You don't have permission to access the admin panel." />
            </Panel>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <AdminStats />
            <UserManagement />
        </div>
    );
};
