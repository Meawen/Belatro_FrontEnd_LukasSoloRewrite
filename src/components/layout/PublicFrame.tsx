import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PixelIcon } from '../ui';
import { usePageTitle } from '../../routing/usePageTitle';
import { ActiveGameBanner } from './ActiveGameBanner';
import { Footer } from './Footer';
import { LangSwitch } from './LangSwitch';

export interface PublicFrameProps {
    /** The page's only h1 (`display`) and its document title. */
    title: string;
    children: ReactNode;
}

/**
 * The frame of the pages anyone may read (spec §4.15): Rules, Privacy and Terms, and signed out the
 * leaderboard's prompt (M-13) and Not found (§4.16). A 680-px reading column under "‹ Stiglja", then
 * the footer. Outside the app shell, so the way back to a running game comes here too (R-33); the
 * banner hides when signed out. The HR · EN switch sits beside "‹ Stiglja" (spec §1.1, open beta S6).
 */
export function PublicFrame({ title, children }: PublicFrameProps) {
    usePageTitle(title);
    return (
        <div className="flex min-h-dvh flex-col bg-bg text-text">
            <main className="flex-1 px-4 pt-[calc(16px+var(--safe-top))] pb-12 md:px-8">
                <div className="mx-auto max-w-[680px]">
                    <div className="mb-3 empty:hidden">
                        <ActiveGameBanner />
                    </div>
                    {/* spec §1.1, Ruling 24: the HR · EN switch here too, for a reader who lands on a public page signed out */}
                    <div className="flex items-center justify-between gap-3">
                        <Link
                            to="/"
                            className="notch focus-inside press t-callout -ml-2 inline-flex min-h-11 items-center gap-2 px-2 text-text-2 hover:text-text"
                        >
                            <PixelIcon name="back" />
                            Stiglja
                        </Link>
                        <LangSwitch />
                    </div>
                    <h1 className="t-display mt-3 break-words">{title}</h1>
                    <div className="t-body mt-6">{children}</div>
                </div>
            </main>
            <Footer width="read" />
        </div>
    );
}
