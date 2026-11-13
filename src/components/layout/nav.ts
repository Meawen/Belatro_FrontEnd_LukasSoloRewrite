import { useAuth } from '../../hooks/useAuth';
import { useMe } from '../../hooks/useUser';
import type { IconName } from '../ui';
import type { Catalog } from '../../i18n/catalog/types';

/** One destination of the main navigation (spec §4.1). */
export interface NavItem {
    /** Its name: the page's title (titles.*), so the link and the page's heading read the same. */
    title: keyof Catalog['titles'];
    to: string;
    icon: IconName;
    /** Only for ROLE_ADMIN per GET /user/me (spec §4.1 AC 4). */
    adminOnly?: boolean;
    /** Other paths (and everything under them) on which this item is the current page. */
    also?: readonly string[];
}

/** Every destination, in the sidebar's order (spec §4.1). */
export const NAV_ITEMS: readonly NavItem[] = [
    { title: 'home', to: '/dashboard', icon: 'home' },
    { title: 'ranked', to: '/play', icon: 'play' },
    { title: 'tables', to: '/lobbies', icon: 'cards', also: ['/lobby'] },
    { title: 'matches', to: '/matches', icon: 'list' },
    { title: 'friends', to: '/friends', icon: 'people' },
    { title: 'leaderboard', to: '/users', icon: 'trophy' },
    { title: 'profile', to: '/profile', icon: 'user' },
    { title: 'settings', to: '/settings', icon: 'gear' },
    { title: 'rules', to: '/rules', icon: 'book' },
    { title: 'admin', to: '/admin', icon: 'shield', adminOnly: true },
];

const TAB_PATHS = ['/dashboard', '/lobbies', '/matches', '/profile'];

/** The phone tab bar's links: Home, Tables, Matches, Profile (then More). */
export const TAB_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => TAB_PATHS.includes(item.to));

/** Under More: Ranked, Friends, Leaderboard, Settings, Rules, Admin (then Log out). */
export const MORE_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => !TAB_PATHS.includes(item.to));

/** The tab bar replaces the sidebar below 768 px, and in landscape up to 500 px tall (spec §4.1, R-37 amended). */
export const TAB_BAR_QUERY = '(max-width: 767.98px), (orientation: landscape) and (max-height: 500px)';

/** The sidebar shows only icons below 1024 px (X-9). */
export const SIDEBAR_ICONS_QUERY = '(max-width: 1023.98px)';

/** True when `pathname` is the item's page or lies under it. */
export function isCurrent(item: NavItem, pathname: string): boolean {
    return [item.to, ...(item.also ?? [])].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** The items this viewer may see: Admin only for an admin. */
export function visibleItems(items: readonly NavItem[], isAdmin: boolean): NavItem[] {
    return items.filter((item) => !item.adminOnly || isAdmin);
}

/** Roles come from GET /user/me; the stored login user (UserLoginDetailsDTO) has none. */
export function useIsAdmin(): boolean {
    const { isAuthenticated } = useAuth();
    const { data: me } = useMe(isAuthenticated);
    return me?.roles?.includes('ROLE_ADMIN') ?? false;
}
