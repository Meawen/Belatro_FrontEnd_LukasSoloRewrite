import { FriendsList } from '../components/profile/FriendList';
import { Page } from '../components/layout/Page';
import { useT } from '../i18n/t';

/** /friends (spec §4.11). Phase 9 owns this module. */
export function FriendsPage() {
    const t = useT();
    return (
        <Page title={t.titles.friends}>
            <FriendsList />
        </Page>
    );
}
