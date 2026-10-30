import React from 'react';
import { LegalText, PublicPage } from './PublicPage';
import { useT } from '../../i18n/t';
import { useDoc, type DocLoaders } from '../../i18n/docs/useDoc';
import type { LegalDoc } from '../../i18n/docs/types';

// spec §1.2, §10: each language's text is its own chunk, fetched only when shown
const PRIVACY: DocLoaders<LegalDoc> = {
    hr: () => import('../../i18n/docs/privacy.hr').then((module) => module.doc),
    en: () => import('../../i18n/docs/privacy.en').then((module) => module.doc),
};

/** The privacy notice (R-40; open beta §1.2): legal text in each language, its own chunk; the owner reviews both (R1). */
export const PrivacyPage: React.FC = () => {
    const t = useT();
    const doc = useDoc(PRIVACY);
    return <PublicPage title={t.titles.privacy}>{doc && <LegalText doc={doc} />}</PublicPage>;
};
