import { useCallback, useLayoutEffect, useReducer, useRef } from 'react';

/**
 * Focus on a control that goes (the declaration moment's button, when play opens or on a tap) would drop to <body>:
 * it moves on once the commit is done, to my hand's tab stop (its first playable card), else to the table itself
 * (`table`, which takes focus only from code), and only if nothing else, a sheet, has taken it. The control calls
 * `lost` as it goes with focus on it; a render follows, even when the control closed on its own.
 */
export function useTableFocus() {
    const table = useRef<HTMLElement>(null);
    const refocus = useRef(false);
    const [, render] = useReducer((n: number) => n + 1, 0);
    const lost = useCallback(() => {
        refocus.current = true;
        render();
    }, []);
    useLayoutEffect(() => {
        if (!refocus.current) return;
        refocus.current = false;
        const active = document.activeElement;
        if (active && active !== document.body) return;
        (table.current?.querySelector<HTMLElement>('[data-testid="hand-card"][tabindex="0"]:enabled') ?? table.current)?.focus();
    });
    return { table, lost };
}
