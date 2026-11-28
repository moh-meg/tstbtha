export type MatchStatus = 'upcoming' | 'live' | 'finished';

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface MatchItem {
  id: string;
  stage: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  kickoffTime?: string;
}

export interface MatchesFetchResult {
  matches: MatchItem[];
  source: 'api' | 'fallback';
  updatedAt: string;
}

export interface PlayerItem {
  id: string;
  teamName: string;
  playerName: string;
  playerId: string;
  playerScore: number | null;
}

export interface PlayersFetchResult {
  players: PlayerItem[];
  source: 'api' | 'fallback';
  updatedAt: string;
}

export type FplPositionLabel = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface FplSquadPlayer {
  elementId: number;
  code: number | null;
  webName: string;
  web_name?: string;
  firstName?: string;
  first_name?: string;
  secondName?: string;
  second_name?: string;
  fullName?: string;
  elementType: number;
  positionLabel: FplPositionLabel;
  teamShortName: string;
  teamName?: string;
  teamCode?: number | null;
  team_code?: number | null;
  teamId?: number | null;
  photoUrl: string;
  photoUrls?: string[];
  position: number;
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  minutes?: number;
  hasStarted?: boolean;
  fixtureStatus?: 'finished' | 'live' | 'upcoming';
  opponentDisplay?: string | null;
  opponentShortName?: string | null;
  opponentTeamCode?: number | null;
  rawPoints?: number | null;
  points: number | null;
}

export interface FplSquadPlayCounts {
  played: number;
  playing: number;
  remaining: number;
  total: number;
  isBenchBoost: boolean;
  isTripleCaptain: boolean;
}

export interface FplSquadData {
  entryId: string;
  event: number;
  activeChip: string | null;
  eventPoints: number | null;
  totalPoints: number | null;
  pointsOnBench: number | null;
  rank: number | null;
  startingXI: FplSquadPlayer[];
  bench: FplSquadPlayer[];
  updatedAt: string;
}

export type FplSquadErrorCode =
  | 'INVALID_ENTRY_ID'
  | 'NOT_FOUND'
  | 'NO_PICKS'
  | 'UPSTREAM_UNAVAILABLE';

export interface FplSquadFetchResult {
  squad: FplSquadData | null;
  source: 'api' | 'direct' | 'preview-fallback' | 'error';
  errorCode?: FplSquadErrorCode;
  errorMessage?: string;
  previewNotice?: string;
}

