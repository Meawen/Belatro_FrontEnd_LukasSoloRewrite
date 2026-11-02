import type { ReactNode } from 'react';
import { Panel, PixelIcon, type IconName } from '../ui';

export interface LandingDoorProps {
    icon: IconName;
    title: string;
    body: string;
    /** The highlighted door (spec §4: Škola bele): the accent edge. */
    main?: boolean;
    /** The door's one button, and its error line. */
    children: ReactNode;
}

/** One of the landing page's three doors (spec §4): a panel with its name, one line, and its button at the foot. */
export function LandingDoor({ icon, title, body, main = false, children }: LandingDoorProps) {
    return (
        <Panel as="article" padding="lg" edge={main ? 'accent' : 'default'} className="flex h-full flex-col gap-3">
            <h2 className="t-title flex items-center gap-2"><PixelIcon name={icon} />{title}</h2>
            <p className="t-callout text-text-2">{body}</p>
            <div className="mt-auto flex flex-col items-start gap-2 pt-1">{children}</div>
        </Panel>
    );
}
