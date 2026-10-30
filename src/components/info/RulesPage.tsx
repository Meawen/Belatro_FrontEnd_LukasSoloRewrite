import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { isExpired } from '../../services/tokenRenewal';
import { useT } from '../../i18n/t';
import { useDoc, type DocLoaders } from '../../i18n/docs/useDoc';
import type { RulesDoc } from '../../i18n/docs/types';
import { AppShell } from '../layout/AppShell';
import { Page } from '../layout/Page';
import { PixelIcon } from '../ui';
import { PublicPage, Section } from './PublicPage';
import { RulesGuide } from './RulesGuide';
import { RULE_SECTIONS, type RuleSection } from './rulesData';

// spec §1.2, §10: each language's text is its own chunk, fetched only when shown
const RULES: DocLoaders<RulesDoc> = {
    hr: () => import('../../i18n/docs/rules.hr').then((module) => module.doc),
    en: () => import('../../i18n/docs/rules.en').then((module) => module.doc),
};

const isRuleSection = (id: string): id is RuleSection => (RULE_SECTIONS as readonly string[]).includes(id);

/**
 * How Belot is played on Stiglja, as the server enforces it (R-41); English approved by the owner, Croatian a draft for
 * R1; each language's text is its own chunk (open beta §1.2, §10). The page opens with a short visual guide; the full
 * rules wait one tap away, every word kept (ranks spec §9, owner 2026-10-11). Signed in it sits in the shell, with the
 * sidebar, like every other page; signed out, in the public frame (owner 2026-10-11). Nothing for the moment the
 * session is read.
 */
export const RulesPage: React.FC = () => {
    const { isAuthenticated, isLoading, token } = useAuth();
    const { hash } = useLocation();
    const reduced = useReducedMotion();
    const t = useT();
    const doc = useDoc(RULES);
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<RuleSection | null>(null);

    const openRule = useCallback((rule: RuleSection) => {
        setOpen(true);
        setTarget(rule);
    }, []);

    // a page opened at one of the sections (/rules#rules-ranks) opens the full rules there
    useEffect(() => {
        const id = hash.slice(1);
        if (isRuleSection(id)) openRule(id);
    }, [hash, openRule]);

    // once the disclosure is open, bring the section into view (after the session is read and the rules have arrived:
    // until then nothing renders)
    useEffect(() => {
        if (!open || !target || isLoading || !doc) return;
        document.getElementById(target)?.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
        setTarget(null);
    }, [open, target, reduced, isLoading, doc]);

    if (isLoading) return null;

    const rules = doc && (
        <>
            <p>{doc.intro}</p>

            <RulesGuide steps={doc.steps} onOpenRule={openRule} />

            <details
                id="full-rules"
                open={open}
                onToggle={(event) => setOpen(event.currentTarget.open)}
                className="group space-y-8"
            >
                <summary className="focus-inside notch flex min-h-11 cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
                    <PixelIcon name="chevron" className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                    <span className="flex flex-col">
                        <h2 className="t-headline text-text">{t.rules.full.heading}</h2>
                        <span className="t-footnote text-text-2">{t.rules.full.note}</span>
                    </span>
                </summary>

                {RULE_SECTIONS.map((id) => (
                    <Section key={id} title={doc.sections[id].title} level={3} id={id}>
                        {doc.sections[id].body}
                    </Section>
                ))}
            </details>
        </>
    );

    // an expired stored token reads as signed out here: the shell's requests would 401 and sign the reader out of
    // a page anyone may read (R-41)
    if (!isAuthenticated || (token && isExpired(token))) return <PublicPage title={t.titles.rules}>{rules}</PublicPage>;
    return (
        <AppShell>
            <Page title={t.titles.rules} width="read">
                <div className="t-body space-y-8">{rules}</div>
            </Page>
        </AppShell>
    );
};
