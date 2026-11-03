import { cx } from '../ui/cx';
import { useLang, type Lang } from '../../i18n/lang';
import { catalogReady, switchLang, useT } from '../../i18n/t';

/**
 * The compact HR · EN switch (spec §1.1) in the signed-in shell's top row and the public frame's header. A shell
 * component, not a design-system one: it knows the language store. The codes read the same in both languages; a 44-px
 * target each.
 */
export function LangSwitch() {
    const lang = useLang();
    const t = useT();
    const button = (code: Lang, text: string) => (
        <button
            type="button"
            aria-pressed={lang === code}
            className={cx('notch focus-inside press inline-flex min-h-11 min-w-11 items-center justify-center px-2', lang === code ? 'font-semibold text-text' : 'text-text-2 hover:text-text')}
            onClick={() => {
                // the language already shown: nothing to store or send; English switches once its catalog is here, and a
                // press on an EN whose catalog never arrived tries again (Ruling 62)
                if (lang !== code || !catalogReady(code)) switchLang(code);
            }}
        >
            {text}
        </button>
    );
    return (
        <div role="group" aria-label={t.langSwitch.label} className="t-callout flex items-center">
            {button('hr', 'HR')}
            <span aria-hidden="true" className="text-text-3">·</span>
            {button('en', 'EN')}
        </div>
    );
}
