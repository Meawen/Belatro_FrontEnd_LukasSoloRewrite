import { useEffect } from 'react';
import { useLang } from '../i18n/lang';
import { useT } from '../i18n/t';

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

    // spec §1.1: the page's language and its description follow the site's language
    const lang = useLang();
    const description = useT().meta.description;
    useEffect(() => {
        document.documentElement.lang = lang;
        document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    }, [lang, description]);
}
