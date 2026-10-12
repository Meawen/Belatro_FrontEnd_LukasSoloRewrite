import type { ReactNode } from 'react';
import { Panel, PlayingCard } from '../ui';
import { Footer } from '../layout/Footer';
import { Wordmark } from '../layout/Wordmark';
import type { GameCard } from '../../types/game';

/** The accent links of the auth pages: "Sign up", "Forgot password?", "Back to sign in"… (spec §4.2) */
export const AUTH_LINK = 'font-semibold text-accent underline-offset-4 hover:underline';

/** The static fan above the panel (X-1): three aces from the card art, left to right. */
const FAN: { card: GameCard; className: string }[] = [
    { card: { boja: 'HERC', rank: 'AS' }, className: 'translate-y-1.5 -rotate-8' },
    { card: { boja: 'KARA', rank: 'AS' }, className: '-ml-8' },
    { card: { boja: 'PIK', rank: 'AS' }, className: '-ml-8 translate-y-1.5 rotate-8' },
];

export interface AuthFrameProps {
    /** The panel's content, its title (the page's only h1) first. */
    children: ReactNode;
}

/**
 * The frame of sign-in, sign-up and the e-mail pages (spec §4.2, §4.3; X-1): on --bg with a dithered-felt
 * band behind the top third, the pixel wordmark, a static fan of Herc As, Karo As and Pik As, the tagline,
 * one notched panel (the full width inside the 16-px gutter on phones, 400 px centred on desktop), and the
 * footer links below (R-40).
 */
export function AuthFrame({ children }: AuthFrameProps) {
    return (
        <div className="relative isolate flex min-h-dvh flex-col bg-bg text-text">
            <div aria-hidden="true" className="felt absolute inset-x-0 top-0 -z-10 h-[33dvh] shadow-[inset_0_-3px_0_var(--edge)]" />
            <main className="flex flex-1 flex-col items-center px-4 pt-[calc(28px+var(--safe-top))] pb-12">
                <Wordmark className="t-display" />
                <div aria-hidden="true" className="mt-5 flex items-start justify-center">
                    {FAN.map(({ card, className }) => (
                        <span key={card.boja} className={`px-shadow ${className}`}>
                            <PlayingCard card={card} size="trick" alt="" />
                        </span>
                    ))}
                </div>
                <p className="t-callout mt-5">Belot for four, online.</p>
                <Panel padding="lg" className="mt-6 w-full max-w-[400px]">
                    {children}
                </Panel>
            </main>
            <Footer width="read" />
        </div>
    );
}
