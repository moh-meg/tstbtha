import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { ArabicFooter } from './components/ArabicFooter';
import { FplSquadModal } from './components/FplSquadModal';
import { HeroTitle } from './components/HeroTitle';
import { LeagueBrandBadge } from './components/LeagueBrandBadge';
import { MatchCard } from './components/MatchCard';
import { MatchCardSkeleton } from './components/MatchCardSkeleton';
import { PosterBackground } from './components/PosterBackground';
import type { MatchItem, PlayerItem } from './types/match';
import { fetchMatchesData, fetchPlayersData } from './utils/matchesService';

const AUTO_REFRESH_INTERVAL_MS = 60_000;

export default function App() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState<boolean>(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerItem | null>(null);
  const hasLoadedPlayersRef = useRef(false);

  const loadMatches = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setIsLoading(true);
    }

    const result = await fetchMatchesData();
    setMatches(result.matches);

    if (isInitial) {
      setIsLoading(false);
    }
  }, []);

  const loadPlayers = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) {
      setIsLoadingPlayers(true);
    }

    const result = await fetchPlayersData();
    setPlayers(result.players);
    hasLoadedPlayersRef.current = true;

    if (showSpinner) {
      setIsLoadingPlayers(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const runInitialLoad = async () => {
      const result = await fetchMatchesData();
      if (!active) {
        return;
      }
      setMatches(result.matches);
      setIsLoading(false);
    };

    void runInitialLoad();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadMatches(false);
        if (hasLoadedPlayersRef.current) {
          void loadPlayers(false);
        }
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadMatches, loadPlayers]);

  const handleToggleMatch = useCallback(
    (matchId: string) => {
      setSelectedPlayer(null);
      setExpandedMatchId((prev) => {
        const nextId = prev === matchId ? null : matchId;
        if (nextId !== null && !hasLoadedPlayersRef.current && !isLoadingPlayers) {
          void loadPlayers(true);
        }
        return nextId;
      });
    },
    [isLoadingPlayers, loadPlayers],
  );

  const handleSelectPlayer = useCallback((player: PlayerItem) => {
    setSelectedPlayer(player);
  }, []);

  const handleCloseSquadModal = useCallback(() => {
    setSelectedPlayer(null);
  }, []);

  const leagueLogoUrl =
    typeof import.meta.env.VITE_LEAGUE_LOGO_URL === 'string' &&
    import.meta.env.VITE_LEAGUE_LOGO_URL.trim()
      ? import.meta.env.VITE_LEAGUE_LOGO_URL.trim()
      : undefined;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-7">
        <PosterBackground />

        <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 flex-col">
          {/* Top-Left Branding */}
          <div className="flex w-full items-start justify-start">
            <LeagueBrandBadge logoUrl={leagueLogoUrl} />
          </div>

          {/* Centered Hero + Match Cards */}
          <main className="mx-auto flex w-full max-w-[850px] flex-1 flex-col items-center justify-center pb-4">
            <HeroTitle />

            <section
              aria-label="Match Results"
              aria-busy={isLoading}
              className="flex w-full flex-col gap-5 sm:gap-7 md:gap-8"
            >
              {isLoading ? (
                <>
                  <MatchCardSkeleton />
                  <MatchCardSkeleton />
                </>
              ) : (
                matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    players={players}
                    isLoadingPlayers={isLoadingPlayers}
                    isExpanded={expandedMatchId === match.id}
                    onToggle={() => handleToggleMatch(match.id)}
                    selectedPlayerId={selectedPlayer?.id ?? null}
                    onSelectPlayer={handleSelectPlayer}
                  />
                ))
              )}
            </section>
          </main>

          {/* Centered Arabic Footer */}
          <ArabicFooter />
        </div>

        <FplSquadModal
          player={selectedPlayer}
          players={players}
          onClose={handleCloseSquadModal}
        />
      </div>
    </MotionConfig>
  );
}
