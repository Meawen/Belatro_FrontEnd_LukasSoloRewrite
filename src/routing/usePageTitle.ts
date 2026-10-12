import { useEffect } from 'react';

/** The site's name: index.html's <title> (R-39) and the end of every page's title. */
export const SITE_NAME = 'Stiglja';

/** "{title} · Stiglja" as the document's title while the page shows (X-16); "Stiglja" again after. */
export function usePageTitle(title: string): void {
    useEffect(() => {
        document.title = `${title} · ${SITE_NAME}`;
        return () => {
            document.title = SITE_NAME;
        };
    }, [title]);
}
