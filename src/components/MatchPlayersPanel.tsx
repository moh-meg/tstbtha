import { useEffect, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import type { MatchItem, PlayerItem, TeamInfo } from '../types/match';
import {
  formatPlayerScore,
  getPlayersForTeam,
  isArabicText,
  resolveTeamLogoUrl,
} from '../utils/matchesService';

interface MatchPlayersPanelProps {
  match: MatchItem;
  players: readonly PlayerItem[];
  isLoading: boolean;
  selectedPlayerId: string | null;
  onSelectPlayer: (player: PlayerItem) => void;
}

function SmallTeamBadge({ team }: { team: TeamInfo }) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoSrc = team.logoUrl?.trim() || resolveTeamLogoUrl(team.name);

  useEffect(() => {
    setImgFailed(false);
  }, [logoSrc]);

  if (imgFailed) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#CBD5E1] bg-white">
        <Shield className="h-4 w-4 text-[#334155]" />
      </span>
    );
  }

  return (
    <img
      src={logoSrc}
      alt={team.name}
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 object-contain"
    />
  );
}

function TeamPlayersColumn({
  team,
  players,
  accentColor,
  selectedPlayerId,
  onSelectPlayer,
}: {
  team: TeamInfo;
  players: readonly PlayerItem[];
  accentColor: 'red' | 'blue';
  selectedPlayerId: string | null;
  onSelectPlayer: (player: PlayerItem) => void;
}) {
  const teamIsArabic = isArabicText(team.name);
  const headerAccent =
    accentColor === 'red' ? 'border-b-2 border-[#FF3B30]' : 'border-b-2 border-[#0038C7]';

  return (
    <div className="flex min-w-0 flex-col bg-[#F5F6F8]">
      <div
        className={`flex items-center justify-between gap-2.5 bg-[#EFEFEF] px-4 py-2.5 ${headerAccent}`}
      >
        <SmallTeamBadge team={team} />
        <h3
          dir={teamIsArabic ? 'rtl' : 'ltr'}
          className="min-w-0 flex-1 truncate text-right text-sm sm:text-base font-extrabold text-[#0F172A]"
        >
          {team.name}
        </h3>
      </div>

      {players.length === 0 ? (
        <div className="flex items-center justify-center px-4 py-5 text-center">
          <p dir="rtl" className="text-xs sm:text-sm font-semibold text-[#64748B]">
            لا توجد بيانات لاعبين مسجلة لهذا الفريق
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#DDE3EE]">
          {players.map((player) => {
            const nameIsArabic = isArabicText(player.playerName);
            const isSelected = selectedPlayerId === player.id;
            return (
              <li key={player.id} data-testid="player-row">
                <button
                  type="button"
                  dir="ltr"
                  onClick={() => onSelectPlayer(player)}
                  aria-label={`${player.playerName} (ID ${player.playerId}) — View GW12 FPL squad`}
                  className={`flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0038C7] ${
                    isSelected
                      ? 'bg-[#DCE7FF] hover:bg-[#D0DFFF]'
                      : 'bg-white/75 hover:bg-[#EAF0FC]'
                  }`}
                >
                  {/* Left side: Player Score */}
                  <span
                    data-testid="player-score"
                    className="font-poster-score min-w-[38px] shrink-0 text-left text-lg sm:text-xl leading-none tabular-nums text-[#0F0F12]"
                  >
                    {formatPlayerScore(player.playerScore)}
                  </span>

                  {/* Right side: Player Name + ID underneath */}
                  <div className="min-w-0 flex-1 text-right">
                    <p
                      dir={nameIsArabic ? 'rtl' : 'ltr'}
                      className="truncate text-sm sm:text-[15px] font-bold leading-snug text-[#0F172A]"
                    >
                      {player.playerName}
                    </p>
                    <p
                      dir="ltr"
                      className="mt-0.5 text-[11px] sm:text-xs font-semibold tracking-wide text-[#64748B] tabular-nums"
                    >
                      ID : {player.playerId}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function MatchPlayersPanel({
  match,
  players,
  isLoading,
  selectedPlayerId,
  onSelectPlayer,
}: MatchPlayersPanelProps) {
  if (isLoading && players.length === 0) {
    return (
      <div
        data-testid="players-loading"
        className="flex flex-col items-center justify-center gap-2.5 border-t border-[#8EA1C7] bg-[#EFEFEF] px-4 py-7 text-[#0F172A]"
      >
        <Loader2 className="h-6 w-6 animate-spin text-[#0038C7]" aria-hidden="true" />
        <p dir="rtl" className="text-xs sm:text-sm font-bold text-[#334155]">
          جاري تحميل نتائج اللاعبين...
        </p>
      </div>
    );
  }

  const homePlayers = getPlayersForTeam(players, match.homeTeam.name);
  const awayPlayers = getPlayersForTeam(players, match.awayTeam.name);

  if (homePlayers.length === 0 && awayPlayers.length === 0) {
    return (
      <div
        data-testid="players-empty"
        className="flex items-center justify-center border-t border-[#8EA1C7] bg-[#EFEFEF] px-4 py-6 text-center"
      >
        <p dir="rtl" className="text-sm font-bold text-[#475569]">
          لا توجد بيانات لاعبين مسجلة لهذه المباراة
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="players-panel-grid"
      className="grid grid-cols-1 divide-y divide-[#B8C2D8] border-t-2 border-[#0038C7]/30 md:grid-cols-2 md:divide-x md:divide-y-0"
    >
      {/* Left Column: Home Team */}
      <TeamPlayersColumn
        team={match.homeTeam}
        players={homePlayers}
        accentColor="red"
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={onSelectPlayer}
      />

      {/* Right Column: Away Team */}
      <TeamPlayersColumn
        team={match.awayTeam}
        players={awayPlayers}
        accentColor="blue"
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={onSelectPlayer}
      />
    </div>
  );
}
