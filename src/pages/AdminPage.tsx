import { AdminDashboard } from '../components/admin/AdminDashboard';
import { Page } from '../components/layout/Page';

/** /admin (spec §4.14); AdminDashboard checks the role itself. Phase 9 owns this module. */
export function AdminPage() {
    return (
        <Page title="Admin">
            <AdminDashboard />
        </Page>
    );
}
