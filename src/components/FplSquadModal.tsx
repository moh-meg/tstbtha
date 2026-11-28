import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Info, Loader2, RefreshCw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { FplSquadData, FplSquadPlayer, PlayerItem } from '../types/match';
import {
  DEFAULT_FPL_EVENT,
  buildTeamBadgeUrls,
  computeSquadPlayCounts,
  fetchFplSquadData,
  getClubKitColors,
  getNextHeadshotCandidateIndex,
  getPlayerFallbackInitials,
  isArabicText,
  resolveExcelManagerPoints,
  resolvePlayerHeadshotCandidates,
} from '../utils/matchesService';

interface FplSquadModalProps {
  player: PlayerItem | null;
  players?: readonly PlayerItem[];
  onClose: () => void;
}

function ClubShirtFallbackAvatar({
  teamShortName,
  teamName,
  teamCode,
  firstName,
  secondName,
  webName,
  fullName,
}: {
  teamShortName: string;
  teamName?: string;
  teamCode?: number | null;
  firstName?: string;
  secondName?: string;
  webName: string;
  fullName?: string;
}) {
  const kit = getClubKitColors(teamShortName, teamName, teamCode);
  const initials = getPlayerFallbackInitials({
    firstName,
    secondName,
    webName,
    fullName,
  });

  return (
    <div
      aria-hidden="true"
      data-testid="fpl-player-avatar-fallback"
      className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
    >
      <svg
        viewBox="0 0 64 64"
        className="h-full w-full"
        role="img"
        aria-label={`${teamShortName || 'Club'} shirt ${initials}`}
      >
        {/* Club Jersey Silhouette */}
        <path
          d="M21 10 L11 16 L4 26 L13 33 L18 26 L18 55 C18 56.7 19.3 58 21 58 L43 58 C44.7 58 46 56.7 46 55 L46 26 L51 33 L60 26 L53 16 L43 10 C40.5 14 36.5 16 32 16 C27.5 16 23.5 14 21 10 Z"
          fill={kit.primary}
          stroke={kit.secondary}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Sleeve Cuff Trim */}
        <path
          d="M6.5 23 L14.5 29.5 M57.5 23 L49.5 29.5"
          stroke={kit.secondary}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Collar Trim */}
        <path
          d="M21.5 10.5 C24 15.5 28 17.5 32 17.5 C36 17.5 40 15.5 42.5 10.5"
          fill="none"
          stroke={kit.collar}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        {/* Subtle Chest Highlight */}
        <path
          d="M20 18 L44 18 L44 55 L20 55 Z"
          fill="#FFFFFF"
          fillOpacity="0.06"
        />
        {/* Uppercase First + Second Name Initials */}
        <text
          x="32"
          y="39"
          textAnchor="middle"
          dominantBaseline="central"
          fill={kit.text}
          fontSize="16"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.5"
        >
          {initials}
        </text>
      </svg>
    </div>
  );
}

function PlayerHeadshot({
  photoUrls,
  photoUrl,
  webName,
  firstName,
  secondName,
  fullName,
  teamShortName,
  teamName,
  teamCode,
  code,
}: {
  photoUrls?: string[];
  photoUrl: string;
  webName: string;
  firstName?: string;
  secondName?: string;
  fullName?: string;
  teamShortName: string;
  teamName?: string;
  teamCode?: number | null;
  code: number | null;
}) {
  const candidates = resolvePlayerHeadshotCandidates({
    photoUrls,
    photoUrl,
    code,
    fullName,
    webName,
    firstName,
    secondName,
    teamName: teamName || teamShortName,
    teamCode,
  });
  const candidateKey = candidates.join('|');
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidateKey]);

  const activeSrc = candidates[candidateIndex] ?? '';
  const isExhausted = !activeSrc;

  if (isExhausted) {
    return (
      <ClubShirtFallbackAvatar
        teamShortName={teamShortName}
        teamName={teamName}
        teamCode={teamCode}
        firstName={firstName}
        secondName={secondName}
        webName={webName}
        fullName={fullName}
      />
    );
  }

  return (
    <img
      key={activeSrc}
      src={activeSrc}
      alt={webName}
      referrerPolicy="no-referrer"
      loading="eager"
      decoding="async"
      onError={(event) => {
        if (event.currentTarget.getAttribute('src') !== activeSrc) {
          return;
        }
        setCandidateIndex((idx) => getNextHeadshotCandidateIndex(idx, candidates.length));
      }}
      className="h-12 w-12 sm:h-14 sm:w-14 object-contain object-bottom drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
    />
  );
}

function OpponentBadge({
  opponentShortName,
  opponentTeamCode,
}: {
  opponentShortName?: string | null;
  opponentTeamCode?: number | null;
}) {
  const badgeUrls = buildTeamBadgeUrls(opponentTeamCode);
  const badgeKey = badgeUrls.join('|');
  const [badgeIdx, setBadgeIdx] = useState(0);

  useEffect(() => {
    setBadgeIdx(0);
  }, [badgeKey]);

  const activeBadgeSrc = badgeUrls[badgeIdx] ?? '';
  if (!activeBadgeSrc) {
    const kit = getClubKitColors(opponentShortName, undefined, opponentTeamCode);
    const shortTag = (opponentShortName || '?').slice(0, 3).toUpperCase();
    return (
      <span
        aria-hidden="true"
        data-testid="fpl-opponent-badge-fallback"
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[6px] font-black leading-none"
        style={{
          backgroundColor: kit.primary,
          borderColor: kit.secondary,
          color: kit.text,
        }}
      >
        {shortTag.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      key={activeBadgeSrc}
      src={activeBadgeSrc}
      alt={opponentShortName ? `${opponentShortName} badge` : 'Opponent badge'}
      data-testid="fpl-opponent-badge"
      referrerPolicy="no-referrer"
      loading="eager"
      decoding="async"
      onError={(event) => {
        if (event.currentTarget.getAttribute('src') !== activeBadgeSrc) {
          return;
        }
        setBadgeIdx((idx) => idx + 1);
      }}
      className="h-3.5 w-3.5 shrink-0 object-contain"
    />
  );
}

function PitchPlayerTile({
  player,
  variant = 'pitch',
}: {
  player: FplSquadPlayer;
  variant?: 'pitch' | 'bench';
}) {
  const isBench = variant === 'bench';
  const hasStarted = player.hasStarted !== false;
  const displayPoints =
    typeof player.points === 'number' && Number.isFinite(player.points) ? player.points : 0;
  const opponentLabel =
    typeof player.opponentDisplay === 'string' && player.opponentDisplay.trim()
      ? player.opponentDisplay.trim()
      : 'BGW';
  const isBlankGameweek = !hasStarted && opponentLabel === 'BGW';

  return (
    <div
      data-testid={isBench ? 'fpl-bench-player' : 'fpl-pitch-player'}
      className={`relative flex flex-col items-center ${
        isBench ? 'w-full max-w-[104px]' : 'w-[66px] sm:w-[86px]'
      }`}
    >
      {(player.isCaptain || player.isViceCaptain) && (
        <span
          aria-label={player.isCaptain ? 'Captain' : 'Vice Captain'}
          className={`absolute -top-1 right-0.5 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-sm px-1 text-[10px] font-black leading-none shadow-sm ${
            player.isCaptain
              ? 'bg-[#FFD60A] text-[#0F0F12]'
              : 'bg-[#0F172A] text-white ring-1 ring-white/70'
          }`}
        >
          {player.isCaptain ? 'C' : 'VC'}
        </span>
      )}

      <div
        className={`flex items-end justify-center pt-1 ${
          isBench
            ? 'w-full rounded-t-md bg-gradient-to-b from-[#DDE5F4] to-[#CBD5E1] px-1'
            : 'w-full'
        }`}
      >
        <PlayerHeadshot
          photoUrls={player.photoUrls}
          photoUrl={player.photoUrl}
          webName={player.webName ?? player.web_name ?? ''}
          firstName={player.firstName ?? player.first_name}
          secondName={player.secondName ?? player.second_name}
          fullName={player.fullName}
          teamShortName={player.teamShortName}
          teamName={player.teamName}
          teamCode={player.teamCode ?? player.team_code}
          code={player.code}
        />
      </div>

      <div
        className={`w-full rounded-sm px-1 py-1 text-center shadow-sm ${
          isBench ? 'bg-[#0F172A] text-white' : 'bg-[#0F172A]/95 text-white'
        }`}
      >
        <p className="truncate text-[10px] sm:text-[11px] font-bold leading-tight">
          {player.webName}
        </p>
        {hasStarted ? (
          <p
            dir="ltr"
            data-testid="fpl-player-points"
            data-started="true"
            className="mt-0.5 truncate text-[10px] font-extrabold tracking-wide text-[#FFD60A] tabular-nums"
          >
            {displayPoints} pts
          </p>
        ) : (
          <div
            dir="ltr"
            data-testid="fpl-player-points"
            data-started="false"
            className="mt-0.5 flex items-center justify-center gap-1 text-[9.5px] sm:text-[10px] font-extrabold tracking-tight text-[#7DD3FC] tabular-nums"
          >
            {!isBlankGameweek && (
              <OpponentBadge
                opponentShortName={player.opponentShortName}
                opponentTeamCode={player.opponentTeamCode}
              />
            )}
            <span className="truncate">{opponentLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function FplSquadModal({ player, players = [], onClose }: FplSquadModalProps) {
  const [squad, setSquad] = useState<FplSquadData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const loadSquad = useCallback(
    async (targetPlayer: PlayerItem) => {
      setIsLoading(true);
      setErrorMessage(null);
      setPreviewNotice(null);
      setSquad(null);

      const result = await fetchFplSquadData(
        targetPlayer.playerId,
        DEFAULT_FPL_EVENT,
        undefined,
        undefined,
        true,
        {
          selectedPlayer: targetPlayer,
          players,
        },
      );
      return result;
    },
    [players],
  );

  useEffect(() => {
    if (!player) {
      setSquad(null);
      setIsLoading(false);
      setErrorMessage(null);
      setPreviewNotice(null);
      return;
    }

    let active = true;

    void loadSquad(player).then((result) => {
      if (!active) {
        return;
      }
      if (result.squad) {
        setSquad(result.squad);
        setPreviewNotice(result.previewNotice ?? null);
        setErrorMessage(null);
      } else {
        setSquad(null);
        setPreviewNotice(null);
        setErrorMessage(
          result.errorMessage ??
            `لا توجد تشكيلة متاحة لهذا اللاعب في الجولة ${DEFAULT_FPL_EVENT}.`,
        );
      }
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [player, reloadNonce, loadSquad]);

  useEffect(() => {
    if (!player) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [player, onClose]);

  const gkRow = squad?.startingXI.filter((p) => p.elementType === 1) ?? [];
  const defRow = squad?.startingXI.filter((p) => p.elementType === 2) ?? [];
  const midRow = squad?.startingXI.filter((p) => p.elementType === 3) ?? [];
  const fwdRow = squad?.startingXI.filter((p) => p.elementType === 4) ?? [];
  const formationRows = [gkRow, defRow, midRow, fwdRow].filter((row) => row.length > 0);
  const playCounts = squad ? computeSquadPlayCounts(squad) : null;

  return (
    <AnimatePresence>
      {player && (
        <motion.div
          key="fpl-squad-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#00124A]/75 p-0 sm:p-4 backdrop-blur-sm"
        >
          <motion.div
            key={player.id}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fpl-squad-modal-title"
            data-testid="fpl-squad-modal"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-[740px] flex-col overflow-hidden rounded-t-2xl sm:rounded-lg bg-[#EFEFEF] shadow-[0_24px_64px_rgba(0,12,54,0.65)] border-t-4 border-[#FF3B30]"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 bg-[#0038C7] px-4 py-3 sm:px-5 text-white">
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق التشكيلة"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-[#FFD60A]"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1 text-right">
                <h2
                  id="fpl-squad-modal-title"
                  dir={isArabicText(player.playerName) ? 'rtl' : 'ltr'}
                  className="truncate text-base sm:text-lg font-extrabold text-white"
                >
                  {player.playerName}
                </h2>
                <div
                  dir="ltr"
                  className="mt-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs font-semibold text-white/85 tabular-nums"
                >
                  <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                    <span className="whitespace-nowrap">ID : {player.playerId}</span>
                    {playCounts && playCounts.total > 0 && (
                      <span
                        data-testid="fpl-header-counts"
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-[#001E70]/80 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/15"
                      >
                        <span className="text-[#6EE7B7]">Played {playCounts.played}</span>
                        <span aria-hidden="true" className="text-white/40">·</span>
                        <span className="text-[#FDE047]">Live {playCounts.playing}</span>
                        <span aria-hidden="true" className="text-white/40">·</span>
                        <span className="text-[#BAE6FD]">Left {playCounts.remaining}</span>
                        <span className="text-white/95">/{playCounts.total}</span>
                        {(playCounts.isBenchBoost || playCounts.isTripleCaptain) && (
                          <span className="ml-0.5 rounded-sm bg-[#FFD60A] px-1 py-px text-[9px] font-black text-[#0F0F12] leading-none">
                            {playCounts.isBenchBoost && playCounts.isTripleCaptain
                              ? 'BB+TC'
                              : playCounts.isBenchBoost
                                ? 'BB'
                                : 'TC'}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span>GW {squad?.event ?? DEFAULT_FPL_EVENT}</span>
                    <span aria-hidden="true">·</span>
                    <span data-testid="fpl-header-points" className="font-bold text-[#FFD60A]">
                      {resolveExcelManagerPoints({
                        entryId: player.playerId,
                        selectedPlayer: player,
                        players,
                      })}{' '}
                      pts
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div
                  data-testid="fpl-squad-loading"
                  className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 py-10 text-center"
                >
                  <Loader2
                    className="h-8 w-8 animate-spin text-[#0038C7]"
                    aria-hidden="true"
                  />
                  <p dir="rtl" className="text-sm font-bold text-[#0F172A]">
                    جاري تحميل تشكيلة FPL للجولة {DEFAULT_FPL_EVENT}...
                  </p>
                </div>
              ) : errorMessage ? (
                <div
                  data-testid="fpl-squad-error"
                  className="flex min-h-[240px] flex-col items-center justify-center gap-4 px-6 py-10 text-center"
                >
                  <AlertCircle className="h-9 w-9 text-[#FF3B30]" aria-hidden="true" />
                  <p dir="rtl" className="max-w-md text-sm sm:text-base font-bold text-[#0F172A]">
                    {errorMessage}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setReloadNonce((n) => n + 1)}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md bg-[#0038C7] px-4 py-2 text-xs sm:text-sm font-bold text-white transition-colors hover:bg-[#002DA3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFD60A]"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      <span>إعادة المحاولة</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex min-h-[44px] cursor-pointer items-center rounded-md border border-[#CBD5E1] bg-white px-4 py-2 text-xs sm:text-sm font-bold text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              ) : squad ? (
                <div>
                  {/* Preview Sandbox Notice Banner */}
                  {previewNotice && (
                    <div
                      data-testid="fpl-preview-notice"
                      dir="rtl"
                      className="flex items-start gap-2.5 border-b border-[#F59E0B]/40 bg-[#FEF3C7] px-4 py-2.5 text-xs font-semibold leading-relaxed text-[#78350F]"
                    >
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" aria-hidden="true" />
                      <p>{previewNotice}</p>
                    </div>
                  )}

                  {/* Football Pitch for Starting XI (1-11) */}
                  <div
                    data-testid="fpl-pitch"
                    className="relative overflow-hidden bg-gradient-to-b from-[#0E7A46] via-[#0B663A] to-[#08532F] px-2 py-4 sm:px-5 sm:py-5"
                  >
                    {/* Subtle Pitch Markings */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-3 rounded border border-white/20"
                    >
                      <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-white/20" />
                      <div className="absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
                      <div className="absolute top-0 left-1/2 h-14 w-44 -translate-x-1/2 border-x border-b border-white/20" />
                      <div className="absolute bottom-0 left-1/2 h-14 w-44 -translate-x-1/2 border-x border-t border-white/20" />
                    </div>

                    <div className="relative z-10 flex flex-col gap-3 sm:gap-4">
                      {formationRows.map((row, rowIdx) => (
                        <div
                          key={`row-${rowIdx}`}
                          className="flex flex-wrap items-start justify-center gap-2 sm:gap-4"
                        >
                          {row.map((pitchPlayer) => (
                            <PitchPlayerTile
                              key={`${pitchPlayer.position}-${pitchPlayer.elementId}`}
                              player={pitchPlayer}
                              variant="pitch"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Substitutes Bench (12-15) */}
                  {squad.bench.length > 0 && (
                    <div
                      data-testid="fpl-bench"
                      className="border-t-2 border-[#0038C7]/25 bg-[#E6EAF2] px-3 py-3.5 sm:px-5 sm:py-4"
                    >
                      <div className="mb-2.5 flex items-center justify-between text-xs font-extrabold text-[#334155]">
                        <span>SUBSTITUTES</span>
                        <span dir="rtl">البدلاء</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 sm:gap-3 justify-items-center">
                        {squad.bench.map((benchPlayer) => (
                          <PitchPlayerTile
                            key={`${benchPlayer.position}-${benchPlayer.elementId}`}
                            player={benchPlayer}
                            variant="bench"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
