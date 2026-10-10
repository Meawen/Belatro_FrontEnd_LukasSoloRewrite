import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { cx } from '../ui/cx';
import { ActiveGameBanner } from './ActiveGameBanner';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { UnverifiedEmailBanner } from './UnverifiedEmailBanner';
import { TAB_BAR_QUERY } from './nav';
import { useMediaQuery } from './useMediaQuery';

// a 16-px gutter (32 px from 768 px), never inside the notch of a phone held sideways
const GUTTER =
    'pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] md:pl-[max(2rem,var(--safe-left))] md:pr-[max(2rem,var(--safe-right))]';

/**
 * The app shell (spec §4.1) around every signed-in page except the game, which has none (X-8): the
 * sidebar, or the tab bar below 768 px and in landscape up to 500 px tall; the banners at the top of the
 * content; the footer (R-40). As a layout route it shows the matched page (<Outlet />); the 404 and the
 * leaderboard pass their page as children.
 */
export function AppShell({ children }: { children?: ReactNode }) {
    const tabBar = useMediaQuery(TAB_BAR_QUERY);
    return (
        <div className="flex min-h-dvh bg-bg text-text">
            {!tabBar && <Sidebar />}
            <div className={cx('flex min-w-0 flex-1 flex-col', tabBar && 'pb-[calc(64px+var(--safe-bottom))]')}>
                <main className={cx('flex-1 pt-(--safe-top)', GUTTER)}>
                    <div className="mx-auto flex max-w-[880px] flex-col gap-2 pt-4 empty:hidden">
                        <ActiveGameBanner />
                        <UnverifiedEmailBanner />
                    </div>
                    {children ?? <Outlet />}
                </main>
                <Footer />
            </div>
            {tabBar && <TabBar />}
        </div>
    );
}
