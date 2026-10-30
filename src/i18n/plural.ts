import type { Lang } from './lang';

/** A word's forms by count: Croatian has three (1 partija, 2 partije, 5 partija), English two. */
export type PluralForms = { one: string; few?: string; other: string };

const RULES: Record<Lang, Intl.PluralRules> = { hr: new Intl.PluralRules('hr'), en: new Intl.PluralRules('en') };

/**
 * The form of the word for `n` by `lang`'s rules (spec §1.1); the caller writes `${n} ${plural(…)}`. A catalog passes
 * its own language, so each catalog counts by its own rules whatever the site's language is.
 */
export function plural(n: number, forms: PluralForms, lang: Lang): string {
    const category = RULES[lang].select(n);
    if (category === 'one') return forms.one;
    if (category === 'few') return forms.few ?? forms.other;
    return forms.other;
}
