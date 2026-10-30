import React from 'react';
import { AdminStats } from './AdminStats';
import { UserManagement } from './UserManagement';
import { useMe } from '../../hooks/useUser';
import { ErrorState, Loader, Panel } from '../ui';
import { useT } from '../../i18n/t';

/** /admin (spec §4.14): only for ROLE_ADMIN per GET /user/me; the real statistics and the user management. */
export const AdminDashboard: React.FC = () => {
    // Roles come only from GET /user/me; the stored login user never carried them.
    const { data: me, error } = useMe();
    const t = useT();

    if (!me && !error) {
        return <Loader text={t.admin.checking} />;
    }

    const isAdmin = me?.roles?.includes('ROLE_ADMIN') ?? false;

    if (!isAdmin) {
        return (
            <Panel>
                <ErrorState icon="lock" title={t.admin.denied} body={t.admin.deniedBody} />
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
