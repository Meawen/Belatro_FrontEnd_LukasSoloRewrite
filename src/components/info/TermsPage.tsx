import React from 'react';
import { LegalText, PublicPage } from './PublicPage';
import { useT } from '../../i18n/t';
import { useDoc, type DocLoaders } from '../../i18n/docs/useDoc';
import type { LegalDoc } from '../../i18n/docs/types';

// spec §1.2, §10: each language's text is its own chunk, fetched only when shown
const TERMS: DocLoaders<LegalDoc> = {
    hr: () => import('../../i18n/docs/terms.hr').then((module) => module.doc),
    en: () => import('../../i18n/docs/terms.en').then((module) => module.doc),
};

/** The terms of use (R-40; open beta §1.2): legal text in each language, its own chunk; the owner reviews both (R1). */
export const TermsPage: React.FC = () => {
    const t = useT();
    const doc = useDoc(TERMS);
    return <PublicPage title={t.titles.terms}>{doc && <LegalText doc={doc} />}</PublicPage>;
};
