import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { m } from 'motion/react';
import { spring } from '../../motion/tokens';
import { cardId } from '../board/model/rules';
import { Chip, Panel, PlayingCard, Segmented, Tag } from '../ui';
import { cx } from '../ui/cx';
import { RankChip } from '../rank/RankChip';
import { useElementWidth } from '../rank/useElementWidth';
import { useT } from '../../i18n/t';
import type { RulesDoc } from '../../i18n/docs/types';
import {
    BID_HAND,
    DECLARATIONS,
    FOLLOW_HAND,
    FOLLOW_LED,
    PLAIN_HIGH_FIRST,
    RULE_RANKS,
    TRUMP_HIGH_FIRST,
    cardPoints,
    type RuleSection,
} from './rulesData';

/** Eight cards and seven gaps fit at 71 px from this inner width; below it the cards are 35.5 (ranks spec §9.1). */
const BIG_ROW_PX = 624;

/** The card width and gap for a row in a container this wide: whole art-pixel multiples, so the art stays crisp. */
function cardSize(width: number) {
    return width >= BIG_ROW_PX ? { w: 71, gap: 8 } : { w: 35.5, gap: 3 };
}

function useCardSize() {
    const ref = useRef<HTMLDivElement>(null);
    const width = useElementWidth(ref, 640);
    return { ref, ...cardSize(width) };
}

interface StepProps {
    n: number;
    title: string;
    rule: RuleSection;
    text: ReactNode;
    onOpenRule: (rule: RuleSection) => void;
    children: ReactNode;
}

/** One step: a number, a title, the picture, at most two short lines, and the way to the full rule. */
function Step({ n, title, rule, text, onOpenRule, children }: StepProps) {
    const t = useT();
    const open = (event: MouseEvent) => {
        event.preventDefault();
        onOpenRule(rule);
    };
    return (
        <li>
            <Panel as="article" className="flex flex-col gap-3">
                <div className="flex items-baseline gap-3">
                    <span aria-hidden="true" className="t-score tabular-nums text-accent">
                        {n}
                    </span>
                    <h3 className="t-headline">{title}</h3>
                </div>
                {children}
                <p className="t-callout text-text-2">{text}</p>
                <a href={`#${rule}`} onClick={open} className="t-callout -my-2 inline-flex min-h-11 items-center self-start text-text-2 hover:text-text">
                    {t.rules.guide.fullRule}
                </a>
            </Panel>
        </li>
    );
}

/** Step 1: the table, partners opposite. */
function Table() {
    const t = useT();
    return (
        <div className="relative h-32 w-64 max-w-full bg-felt-a shadow-[inset_0_0_0_3px_var(--rim)] notch-6">
            <span className="absolute top-2 left-1/2 -translate-x-1/2"><Tag tone="team-a">{t.rules.guide.partner}</Tag></span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2"><Tag tone="team-a">{t.common.you}</Tag></span>
            <span className="absolute top-1/2 left-2 -translate-y-1/2"><Tag tone="team-b">{t.rules.guide.opponent}</Tag></span>
            <span className="absolute top-1/2 right-2 -translate-y-1/2"><Tag tone="team-b">{t.rules.guide.opponent}</Tag></span>
        </div>
    );
}

/** Step 2: one suit's order and points, as another suit or as trump; the cards fly to their new places. */
function CardOrder() {
    const t = useT();
    const [trump, setTrump] = useState(false);
    const { ref, w, gap } = useCardSize();
    const order = trump ? TRUMP_HIGH_FIRST : PLAIN_HIGH_FIRST;
    const h = (w * 95) / 71;
    return (
        <div className="flex flex-col gap-3">
            <Segmented
                label={t.rules.guide.order.label}
                options={[
                    { value: 'plain', label: t.rules.guide.order.plain },
                    { value: 'trump', label: t.rules.guide.trump },
                ]}
                value={trump ? 'trump' : 'plain'}
                onChange={(value) => setTrump(value === 'trump')}
                className="self-start"
            />
            <div ref={ref} className="w-full">
                {/* keyed on the card size: once the row is measured (or a phone turns) the cards are placed afresh, not slid
                    from where the fallback width put them; only a switch of order slides them */}
                <ol key={w} aria-label={trump ? t.rules.guide.order.trumpList : t.rules.guide.order.plainList} className="relative" style={{ height: h + 22 }}>
                    {order.map((rank, i) => (
                        <m.li
                            key={rank}
                            className="absolute top-0 left-0 flex flex-col items-center gap-1"
                            style={{ width: w }}
                            initial={false}
                            animate={{ x: i * (w + gap) }}
                            transition={spring.ui}
                        >
                            <PlayingCard card={{ boja: 'HERC', rank }} width={w} />
                            <span data-testid="points" className="t-caption tabular-nums text-text-2">
                                {cardPoints(rank, trump)}
                            </span>
                        </m.li>
                    ))}
                </ol>
            </div>
        </div>
    );
}

/** Step 3: six cards, two to come, then name a trump or pass. */
function Bidding() {
    const t = useT();
    const { ref, w } = useCardSize();
    return (
        <div ref={ref} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-1">
                {BID_HAND.map((card) => (
                    <PlayingCard key={cardId(card)} card={card} width={w} />
                ))}
                <span className="ml-2 flex gap-1" aria-label={t.rules.guide.toCome} role="img">
                    <PlayingCard back={1} width={w} />
                    <PlayingCard back={1} width={w} />
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                <Chip tone="trump" suit="HERC">
                    {t.board.bid.call(t.cards.suit.HERC)}
                </Chip>
                <Chip>{t.board.pass}</Chip>
            </div>
        </div>
    );
}

/** Step 4: a trick to try: tap a card, read whether it may be played and why. */
function FollowSuit() {
    const t = useT();
    const [chosen, setChosen] = useState<string | null>(null);
    const { ref, w } = useCardSize();
    const pick = FOLLOW_HAND.find((entry) => cardId(entry.card) === chosen) ?? null;
    return (
        <div ref={ref} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Chip tone="trump" suit="HERC">
                    {t.rules.guide.trump}
                </Chip>
                <span className="t-footnote text-text-2">{t.rules.guide.follow.question}</span>
            </div>
            <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col items-center gap-1">
                    <PlayingCard card={FOLLOW_LED} width={w} />
                    <span className="t-caption text-text-2">{t.rules.guide.follow.led}</span>
                </div>
                <ul aria-label={t.rules.guide.follow.yourCards} className="flex flex-wrap items-end gap-1 pt-2">
                    {FOLLOW_HAND.map(({ card }) => {
                        const id = cardId(card);
                        const on = chosen === id;
                        return (
                            <li key={id}>
                                <m.button
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => setChosen(id)}
                                    animate={{ y: on ? -8 : 0 }}
                                    whileTap={{ scale: 0.96 }}
                                    transition={spring.quick}
                                    className="focus-inside block min-h-11 min-w-11 p-1"
                                >
                                    <PlayingCard card={card} width={w} />
                                </m.button>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <p data-testid="follow-verdict" aria-live="polite" className={cx('t-callout', !pick ? 'text-text-2' : pick.legal ? 'text-success' : 'text-danger-text')}>
                {pick ? t.rules.guide.follow.verdict[pick.verdict] : t.rules.guide.follow.prompt}
            </p>
        </div>
    );
}

/** Step 5: what declarations look like, with their points. */
function Declarations() {
    const { ref, w } = useCardSize();
    return (
        <div ref={ref} className="flex flex-wrap items-end gap-x-6 gap-y-3">
            {DECLARATIONS.map(({ label, cards }) => (
                <div key={label} className="flex flex-col items-start gap-1">
                    <div className="flex">
                        {cards.map((card, i) => (
                            <PlayingCard key={cardId(card)} card={card} width={w} style={i ? { marginLeft: -w * 0.45 } : undefined} />
                        ))}
                    </div>
                    <span className="t-callout font-semibold tabular-nums">{label}</span>
                </div>
            ))}
        </div>
    );
}

/** Step 7: a foul the game lets through. */
function Foul() {
    const t = useT();
    const { ref, w } = useCardSize();
    return (
        <div ref={ref} className="flex pb-2">
            <span className="relative">
                <PlayingCard card={{ boja: 'KARA', rank: 'AS' }} width={w} />
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    <Tag tone="bad">{t.rules.guide.illegal}</Tag>
                </span>
            </span>
        </div>
    );
}

export interface RulesGuideProps {
    /** Each step's title and lines, from the Rules document in the site's language. */
    steps: RulesDoc['steps'];
    /** Opens the full rules at a section. */
    onOpenRule: (rule: RuleSection) => void;
}

/**
 * The Rules page's visual guide (ranks spec §9.1, owner 2026-10-11): eight short steps built from the real cards,
 * two of them to try; each links to its full rule.
 */
export function RulesGuide({ steps, onOpenRule }: RulesGuideProps) {
    const t = useT();
    const step = { onOpenRule };
    return (
        <section aria-labelledby="rules-guide" className="space-y-3">
            <h2 id="rules-guide" className="t-headline text-text">
                {t.rules.guide.heading}
            </h2>
            <ol aria-label={t.rules.guide.heading} className="flex flex-col gap-3">
                <Step n={1} title={steps.teams.title} rule="rules-scoring" text={steps.teams.text} {...step}>
                    <Table />
                </Step>
                <Step n={2} title={steps.cards.title} rule="rules-cards" text={steps.cards.text} {...step}>
                    <CardOrder />
                </Step>
                <Step n={3} title={steps.bidding.title} rule="rules-bidding" text={steps.bidding.text} {...step}>
                    <Bidding />
                </Step>
                <Step n={4} title={steps.follow.title} rule="rules-playing" text={steps.follow.text} {...step}>
                    <FollowSuit />
                </Step>
                <Step n={5} title={steps.declarations.title} rule="rules-declarations" text={steps.declarations.text} {...step}>
                    <Declarations />
                </Step>
                <Step n={6} title={steps.hand.title} rule="rules-scoring" text={steps.hand.text} {...step}>
                    <div className="flex flex-wrap gap-2">
                        <Tag tone="warn">{t.rules.guide.padanje}</Tag>
                        <Tag tone="win">{t.rules.guide.capot}</Tag>
                    </div>
                </Step>
                <Step n={7} title={steps.challenge.title} rule="rules-challenge" text={steps.challenge.text} {...step}>
                    <Foul />
                </Step>
                <Step n={8} title={steps.ranks.title} rule="rules-ranks" text={steps.ranks.text} {...step}>
                    <div className="flex flex-wrap gap-1.5">
                        {RULE_RANKS.map((rank) => (
                            <RankChip key={rank.key} rank={rank} />
                        ))}
                    </div>
                </Step>
            </ol>
        </section>
    );
}
