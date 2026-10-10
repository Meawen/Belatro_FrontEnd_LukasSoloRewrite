import { FriendsList } from '../components/profile/FriendList';
import { Page } from '../components/layout/Page';

/** /friends (spec §4.11). Phase 9 owns this module. */
export function FriendsPage() {
    return (
        <Page title="Friends">
            <FriendsList />
        </Page>
    );
}
