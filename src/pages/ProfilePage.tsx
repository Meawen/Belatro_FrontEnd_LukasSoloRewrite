import { useParams } from 'react-router-dom';
import { UserProfile } from '../components/profile';
import { Page } from '../components/layout/Page';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n/t';

/** /profile, your own (spec §4.10). UserProfile draws the h1: the name beside the avatar. */
export function ProfilePage() {
    const { user } = useAuth();
    const t = useT();
    return (
        <Page title={t.titles.profile} heading={null}>
            <UserProfile userId={user?.id || undefined} />
        </Page>
    );
}

/** /profile/:userId, another player's (spec §4.10): its own component, so a new id mounts afresh; UserProfile draws the h1. */
export function UserProfilePage() {
    const { userId } = useParams<{ userId: string }>();
    const t = useT();
    return (
        <Page title={t.titles.profile} heading={null}>
            <UserProfile userId={userId} />
        </Page>
    );
}
