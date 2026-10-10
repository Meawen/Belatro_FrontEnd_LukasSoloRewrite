import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ListRow, Sheet } from '../ui';
import { cx } from '../ui/cx';
import { MORE_ITEMS, TAB_ITEMS, isCurrent, useIsAdmin, visibleItems } from './nav';
import { NavIcon } from './NavIcon';

const TAB = 'press focus-inside t-footnote flex h-16 w-full flex-col items-center justify-center gap-1.5';

/**
 * The phone navigation (spec §4.1, D-25): a bottom material bar, 64 px plus the safe-area inset, with
 * Play, Lobbies, Matches, Profile and More. More is a sheet with the other destinations and Log out
 * (a full page load to /, useAuth); every navigation closes it. AppShell shows this bar instead of
 * the sidebar below 768 px, and in landscape up to 500 px tall.
 */
export function TabBar() {
    const location = useLocation();
    const { logout } = useAuth();
    const isAdmin = useIsAdmin();
    const [moreOpen, setMoreOpen] = useState(false);
    const more = visibleItems(MORE_ITEMS, isAdmin);
    const inMore = more.some((item) => isCurrent(item, location.pathname));

    // every navigation gets a new key, also a tap on the page already shown: More closes
    useEffect(() => setMoreOpen(false), [location.key]);

    return (
        <>
            <nav
                aria-label="Main navigation"
                className="material-bar fixed inset-x-0 bottom-0 z-(--z-bar) pb-(--safe-bottom) pl-(--safe-left) pr-(--safe-right)"
            >
                <ul className="mx-auto flex max-w-[600px]">
                    {TAB_ITEMS.map((item) => {
                        const current = isCurrent(item, location.pathname);
                        return (
                            <li key={item.to} className="flex-1">
                                <Link
                                    to={item.to}
                                    aria-current={current ? 'page' : undefined}
                                    className={cx(TAB, current ? 'text-accent' : 'text-text-2')}
                                >
                                    <NavIcon name={item.icon} />
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                    <li className="flex-1">
                        <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-expanded={moreOpen}
                            onClick={() => setMoreOpen(true)}
                            className={cx(TAB, inMore ? 'text-accent' : 'text-text-2')}
                        >
                            <NavIcon name="more" />
                            More
                        </button>
                    </li>
                </ul>
            </nav>
            <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
                <ul className="flex flex-col gap-2">
                    {more.map((item) => (
                        <li key={item.to}>
                            <ListRow
                                as="link"
                                to={item.to}
                                aria-current={isCurrent(item, location.pathname) ? 'page' : undefined}
                                leading={<NavIcon name={item.icon} />}
                                title={item.label}
                            />
                        </li>
                    ))}
                    <li>
                        <ListRow
                            as="button"
                            onClick={() => void logout()}
                            leading={<NavIcon name="logout" />}
                            title="Log out"
                            chevron={false}
                        />
                    </li>
                </ul>
            </Sheet>
        </>
    );
}
