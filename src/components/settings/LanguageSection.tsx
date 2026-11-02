import { useId } from 'react';
import { Panel, Segmented } from '../ui';
import { useLang } from '../../i18n/lang';
import { switchLang, useT } from '../../i18n/t';

/** Language (open beta §1.1): the site's language, kept on this device and, signed in, on the account. */
export function LanguageSection() {
    const lang = useLang();
    const t = useT();
    const headingId = useId();
    return (
        <Panel as="section" padding="lg" aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="t-title">
                {t.settings.language.heading}
            </h2>
            <p className="t-callout text-text-2">{t.settings.language.body}</p>
            <Segmented
                label={t.settings.language.heading}
                options={[
                    { value: 'hr', label: t.settings.language.hr },
                    { value: 'en', label: t.settings.language.en },
                ]}
                value={lang}
                onChange={switchLang}
                className="self-start"
            />
        </Panel>
    );
}
