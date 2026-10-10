import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Page } from '../layout/Page';
import { Button, EmptyState, ErrorState, Loader, Pager, Panel, PixelIcon } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { useMatchSummary } from '../../hooks/useMatchHistory';
import { MatchRow } from './MatchRow';
import { RecentForm } from './RecentForm';
import { MATCHES_PAGE_SIZE, matchesPath, pageFromSearch, type MatchesBackState } from './matchesPath';

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Match History, /matches (spec §4.9; D-30): one list from the summary endpoint only (R-9 as amended),
 * the page in the URL (?page=n, 1-based) so Back from a match returns to it, the Recent form strip, a
 * MatchRow per match (the whole row opens /matches/:id) and the pager.
 */
export function MatchHistory() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [search] = useSearchParams();
    const page = pageFromSearch(search);
    const { matchSummary, isLoading, error, refetch } = useMatchSummary(user?.id, page - 1, MATCHES_PAGE_SIZE);
    // a failed answer shows the error state; it must not surface as an unhandled rejection
    const reload = () => {
        refetch().catch(() => {});
    };
    const rows = error ? undefined : matchSummary;
    const full = rows?.length === MATCHES_PAGE_SIZE;
    const back: MatchesBackState = { page };

    let body: ReactNode;
    if (error) {
        body = (
            <Panel>
                <ErrorState
                    title="Unable to load match history"
                    body="Something went wrong while fetching your matches"
                    action={<Button variant="secondary" onClick={reload}>Try again</Button>}
                />
            </Panel>
        );
    } else if (!rows) {
        body = <Loader text="Loading your match history..." />;
    } else if (rows.length === 0 && page > 1) {
        body = <EmptyState icon="list" title="No more matches" />;
    } else if (rows.length === 0) {
        body = (
            <EmptyState
                icon="cards"
                title="No matches yet"
                body="Play a game and it shows up here."
                action={<Button onClick={() => navigate('/dashboard')}>Find a game</Button>}
            />
        );
    } else {
        body = (
            <>
                <RecentForm summaries={rows} />
                <ul className="flex flex-col gap-2">
                    {rows.map((summary, index) => (
                        <li key={summary.matchId ?? index}>
                            <MatchRow summary={summary} state={back} />
                        </li>
                    ))}
                </ul>
            </>
        );
    }

    return (
        <Page
            title="Match History"
            meta={rows ? counted(rows.length, 'match', 'matches') : undefined}
            actions={
                <Button variant="secondary" size="sm" loading={isLoading} leftIcon={<PixelIcon name="refresh" />} onClick={reload}>
                    {isLoading && rows ? 'Refreshing...' : 'Refresh'}
                </Button>
            }
        >
            <div className="flex flex-col gap-3">
                {isLoading && rows && <Loader layout="inline" text="Loading matches..." className="notch self-center bg-surface-2 px-3 py-1.5" />}
                {body}
                {rows && (rows.length > 0 || page > 1) && (
                    <Panel padding="none" className="px-4 py-3">
                        <Pager
                            page={page - 1}
                            hasNext={full}
                            onPage={(next) => navigate(matchesPath(next + 1))}
                            note={full ? `· ${MATCHES_PAGE_SIZE} matches per page` : undefined}
                            disabled={isLoading}
                        />
                    </Panel>
                )}
            </div>
        </Page>
    );
}
