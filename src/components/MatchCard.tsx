import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchItem, PlayerItem, TeamPlayCounts } from '../types/match';
import { MatchPlayersPanel } from './MatchPlayersPanel';
import { TeamLogoSlot } from './TeamLogoSlot';

interface MatchCardProps {
  match: MatchItem;
  players: readonly PlayerItem[];
  isLoadingPlayers: boolean;
  homeCounts?: TeamPlayCounts | null;
  awayCounts?: TeamPlayCounts | null;
  isLoadingCounts?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  selectedPlayerId: string | null;
  onSelectPlayer: (player: PlayerItem) => void;
}

function TeamCountsSide({
  teamName,
  counts,
  isLoading,
  testId,
}: {
  teamName: string;
  counts?: TeamPlayCounts | null;
  isLoading: boolean;
  testId: string;
}) {
  const formatVal = (val: number | undefined) => {
    if (counts && typeof val === 'number' && Number.isFinite(val)) {
      return String(val);
    }
    return isLoading ? '—' : '0';
  };

  return (
    <dl
      dir="rtl"
      aria-label={teamName}
      data-testid={testId}
      className="grid grid-cols-2 gap-x-2 gap-y-1.5 px-2.5 py-2 text-center sm:grid-cols-4 sm:gap-1.5 sm:px-3.5 sm:py-2"
    >
      <div className="flex flex-col items-center justify-center">
        <dt className="text-[10px] font-semibold leading-tight text-white/75">الإجمالي</dt>
        <dd
          data-testid={`${testId}-total`}
          className="mt-0.5 text-xs sm:text-sm font-black leading-none text-white tabular-nums"
        >
          {formatVal(counts?.total)}
        </dd>
      </div>
      <div className="flex flex-col items-center justify-center" title="لعبوا / مكتملون">
        <dt className="text-[10px] font-semibold leading-tight text-white/75">لعبوا</dt>
        <dd
          data-testid={`${testId}-played`}
          className="mt-0.5 text-xs sm:text-sm font-black leading-none text-[#6EE7B7] tabular-nums"
        >
          {formatVal(counts?.played)}
        </dd>
      </div>
      <div className="flex flex-col items-center justify-center">
        <dt className="text-[10px] font-semibold leading-tight text-white/75">يلعبون حالياً</dt>
        <dd
          data-testid={`${testId}-playing`}
          className="mt-0.5 text-xs sm:text-sm font-black leading-none text-[#FDE047] tabular-nums"
        >
          {formatVal(counts?.playing)}
        </dd>
      </div>
      <div className="flex flex-col items-center justify-center">
        <dt className="text-[10px] font-semibold leading-tight text-white/75">متبقون</dt>
        <dd
          data-testid={`${testId}-remaining`}
          className="mt-0.5 text-xs sm:text-sm font-black leading-none text-[#7DD3FC] tabular-nums"
        >
          {formatVal(counts?.remaining)}
        </dd>
      </div>
    </dl>
  );
}

export function MatchCard({
  match,
  players,
  isLoadingPlayers,
  homeCounts = null,
  awayCounts = null,
  isLoadingCounts = false,
  isExpanded,
  onToggle,
  selectedPlayerId,
  onSelectPlayer,
}: MatchCardProps) {
  const hasScores =
    typeof match.homeScore === 'number' &&
    Number.isFinite(match.homeScore) &&
    typeof match.awayScore === 'number' &&
    Number.isFinite(match.awayScore);

  const panelId = `match-players-panel-${match.id}`;

  return (
    <article
      aria-label={`${match.stage}: ${match.homeTeam.name} vs ${match.awayTeam.name}`}
      data-testid="match-card"
      className="w-full bg-[#EFEFEF] shadow-[0_10px_28px_rgba(0,18,74,0.34)] transition-transform duration-150 ease-out hover:-translate-y-0.5"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="flex w-full min-h-[104px] sm:min-h-[126px] md:min-h-[138px] cursor-pointer items-stretch bg-[#EFEFEF] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFD60A]"
      >
        {/* Left Box: Team 1 Logo */}
        <TeamLogoSlot team={match.homeTeam} side="left" />

        {/* Center Section: Top Red Header Bar + Score Display */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#EFEFEF]">
          <div className="relative flex h-8 sm:h-10 md:h-[42px] items-center justify-center bg-[#FF3B30] px-8 sm:px-10">
            <h2 className="font-poster-display text-stroke-stage truncate text-center text-sm sm:text-lg md:text-[21px] tracking-[0.06em] uppercase">
              {match.stage}
            </h2>
            <ChevronDown
              aria-hidden="true"
              className={`absolute right-2 sm:right-3 h-4 w-4 sm:h-5 sm:w-5 text-white/95 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              strokeWidth={2.75}
            />
          </div>

          <div className="flex flex-1 items-center justify-center px-2 sm:px-5 md:px-7 py-2">
            {hasScores ? (
              <div
                data-testid="score-split"
                className="font-poster-score grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-8 md:gap-12 tabular-nums leading-none text-[#0F0F12]"
              >
                <span
                  data-testid="home-score"
                  className="justify-self-start text-[clamp(1.75rem,7.2vw,2.45rem)] sm:text-[58px] md:text-[72px]"
                >
                  {match.homeScore}
                </span>
                <span
                  aria-hidden="true"
                  className="justify-self-center text-[clamp(1.45rem,5.8vw,2rem)] sm:text-[50px] md:text-[62px]"
                >
                  -
                </span>
                <span
                  data-testid="away-score"
                  className="justify-self-end text-[clamp(1.75rem,7.2vw,2.45rem)] sm:text-[58px] md:text-[72px]"
                >
                  {match.awayScore}
                </span>
              </div>
            ) : (
              <div
                data-testid="score-pending"
                className="font-poster-score tabular-nums leading-none text-[#0F0F12] text-[44px] sm:text-[60px] md:text-[72px]"
              >
                -
              </div>
            )}
          </div>
        </div>

        {/* Right Box: Team 2 Logo */}
        <TeamLogoSlot team={match.awayTeam} side="right" />
      </button>

      {/* Aggregated Team Player Counts Bar (ONLY Total, Played, Playing, Remaining per team) */}
      <div
        dir="ltr"
        data-testid="team-matchup-counts-bar"
        className="grid grid-cols-2 divide-x divide-white/15 border-t-2 border-[#0038C7] bg-[#0B1B4D] text-white"
      >
        <TeamCountsSide
          teamName={match.homeTeam.name}
          counts={homeCounts}
          isLoading={isLoadingCounts}
          testId="home-team-counts"
        />
        <TeamCountsSide
          teamName={match.awayTeam.name}
          counts={awayCounts}
          isLoading={isLoadingCounts}
          testId="away-team-counts"
        />
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <MatchPlayersPanel
              match={match}
              players={players}
              isLoading={isLoadingPlayers}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={onSelectPlayer}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
