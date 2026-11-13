import type { ReactNode } from 'react';
import type { RuleSection } from '../../components/info/rulesData';

/** One titled part of a document: an h2 on Privacy and Terms, an h3 in the Rules page's full rules. */
export interface DocSection {
    title: string;
    body: ReactNode;
}

/** Privacy or Terms in one language (spec §1.2: long prose as per-language documents). */
export interface LegalDoc {
    /** "Last updated: …", above the opening line. */
    updated: string;
    /** The opening line, before the first section. */
    intro: string;
    /** The sections, in order. */
    sections: DocSection[];
}

/** The Rules guide's eight steps (RulesGuide), each with its own picture. */
export type GuideStep = 'teams' | 'cards' | 'bidding' | 'follow' | 'declarations' | 'hand' | 'challenge' | 'ranks';

/** The Rules page's prose in one language. */
export interface RulesDoc {
    /** The opening line above the guide. */
    intro: string;
    /** Each guide step's title and its one or two lines. */
    steps: Record<GuideStep, { title: string; text: string }>;
    /** The full rules by section id, the ids `#hash` links use; RULE_SECTIONS gives the order. */
    sections: Record<RuleSection, DocSection>;
}
