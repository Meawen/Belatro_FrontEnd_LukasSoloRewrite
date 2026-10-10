import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Avatar, Button, IconButton, PixelIcon } from '../ui';
import { cx } from '../ui/cx';
import { NAV_ITEMS, SIDEBAR_ICONS_QUERY, isCurrent, useIsAdmin, visibleItems } from './nav';
import { NavIcon } from './NavIcon';
import { useMediaQuery } from './useMediaQuery';
import { Wordmark } from './Wordmark';

/**
 * The desktop navigation (spec §4.1, D-25): shown when the tab bar is not. 232 px with labels from
 * 1024 px; 72 px with icons only between 768 and 1023 px (X-9), each link then named by aria-label.
 * The player and Log out sit at the bottom; Log out ends in a full page load to / (useAuth).
 */
export function Sidebar() {
    const { pathname } = useLocation();
    const { user, logout } = useAuth();
    const isAdmin = useIsAdmin();
    const compact = useMediaQuery(SIDEBAR_ICONS_QUERY);

    return (
        <aside
            className={cx(
                'sticky top-0 flex h-dvh shrink-0 flex-col bg-surface pt-(--safe-top) pb-(--safe-bottom) pl-(--safe-left) shadow-[inset_-3px_0_0_var(--edge)]',
                compact ? 'w-[72px]' : 'w-[232px]',
            )}
        >
            <div className={cx('flex h-16 shrink-0 items-center', compact ? 'justify-center' : 'px-5')}>
                <Wordmark compact={compact} className="t-title" />
            </div>
            <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                <ul className="flex flex-col gap-1">
                    {visibleItems(NAV_ITEMS, isAdmin).map((item) => {
                        const current = isCurrent(item, pathname);
                        return (
                            <li key={item.to}>
                                <Link
                                    to={item.to}
                                    aria-current={current ? 'page' : undefined}
                                    aria-label={compact ? item.label : undefined}
                                    className={cx(
                                        'notch focus-inside press t-callout flex min-h-11 items-center gap-3 font-semibold',
                                        compact ? 'justify-center' : 'px-3',
                                        current ? 'bg-surface-2 text-accent' : 'text-text-2 hover:bg-surface-2 hover:text-text',
                                    )}
                                >
                                    <NavIcon name={item.icon} />
                                    {!compact && <span className="truncate">{item.label}</span>}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
            {user && (
                <div className={cx('flex shrink-0 flex-col gap-2 p-3 shadow-[inset_0_3px_0_var(--edge)]', compact && 'items-center')}>
                    <div className={cx('flex min-w-0 items-center gap-3', !compact && 'px-1')}>
                        <Avatar initial={user.username ?? '?'} tone="accent" />
                        {!compact && <span className="t-callout min-w-0 truncate font-semibold">{user.username}</span>}
                    </div>
                    {compact ? (
                        <IconButton icon="logout" aria-label="Log out" onClick={() => void logout()} />
                    ) : (
                        <Button variant="quiet" leftIcon={<PixelIcon name="logout" />} className="justify-start" onClick={() => void logout()}>
                            Log out
                        </Button>
                    )}
                </div>
            )}
        </aside>
    );
}
