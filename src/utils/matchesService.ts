import type {
  FplPositionLabel,
  FplSquadData,
  FplSquadErrorCode,
  FplSquadFetchResult,
  FplSquadPlayer,
  MatchItem,
  MatchStatus,
  MatchesFetchResult,
  PlayerItem,
  PlayersFetchResult,
  TeamInfo,
} from '../types/match';

export const DEFAULT_MATCHES_ENDPOINTS = [
  '/api/matches',
  '/.netlify/functions/matches',
] as const;

export const DEFAULT_PLAYERS_ENDPOINTS = [
  '/api/players',
  '/.netlify/functions/players',
] as const;

export const DEFAULT_FPL_SQUAD_ENDPOINTS = [
  '/.netlify/functions/fpl-squad',
  '/api/fpl-squad',
] as const;

export const DEFAULT_FPL_EVENT = 11;

export const DEFAULT_ONEDRIVE_DOWNLOAD_URLS = [
  'https://onedrive.live.com/personal/13310541d7ff2949/_layouts/15/download.aspx?share=IQCa819eDxX5RJBkUo6rcRrNAbXaYV5W9B98WTnFZfSSsew',
] as const;

export const DEFAULT_PLAYERS_ONEDRIVE_DOWNLOAD_URLS = [
  'https://onedrive.live.com/personal/13310541d7ff2949/_layouts/15/download.aspx?share=IQDbxALpCCljSKuq_WSgqScrAd0gdiRKpUUexj05jBe1WTg',
] as const;

export function resolveTeamLogoUrl(teamName: string): string {
  const trimmed = teamName.trim();
  return `/logos/${encodeURIComponent(trimmed)}.png`;
}

export const DEFAULT_MATCHES: MatchItem[] = [
  {
    id: 'semi-final-1',
    stage: 'DEMI FINALE !!',
    homeTeam: {
      id: 'oulad-zabana',
      name: 'اولاد زبانة',
      shortName: 'اولاد زبانة',
      logoUrl: resolveTeamLogoUrl('اولاد زبانة'),
      primaryColor: '#DC2626',
      secondaryColor: '#FFFFFF',
    },
    awayTeam: {
      id: 'oulad-el-dalil',
      name: 'اولاد الدليل',
      shortName: 'اولاد الدليل',
      logoUrl: resolveTeamLogoUrl('اولاد الدليل'),
      primaryColor: '#1E293B',
      secondaryColor: '#E2E8F0',
    },
    homeScore: null,
    awayScore: null,
    status: 'upcoming',
  },
  {
    id: 'semi-final-2',
    stage: 'DEMI FINALE !!',
    homeTeam: {
      id: 'oulad-zeiban',
      name: 'اولاد الزيبان',
      shortName: 'اولاد الزيبان',
      logoUrl: resolveTeamLogoUrl('اولاد الزيبان'),
      primaryColor: '#065F46',
      secondaryColor: '#FDE047',
    },
    awayTeam: {
      id: 'bani-mzab',
      name: 'بني مزاب',
      shortName: 'بني مزاب',
      logoUrl: resolveTeamLogoUrl('بني مزاب'),
      primaryColor: '#78350F',
      secondaryColor: '#FDE68A',
    },
    homeScore: null,
    awayScore: null,
    status: 'upcoming',
  },
];

export function formatMatchScore(
  homeScore: number | null | undefined,
  awayScore: number | null | undefined,
): string {
  if (
    typeof homeScore === 'number' &&
    Number.isFinite(homeScore) &&
    typeof awayScore === 'number' &&
    Number.isFinite(awayScore)
  ) {
    return `${homeScore} - ${awayScore}`;
  }
  return '-';
}

export function formatMatchStatusLabel(match: MatchItem): string {
  if (match.status === 'live') {
    return match.kickoffTime ? `EN DIRECT · ${match.kickoffTime}` : 'EN DIRECT';
  }
  if (match.status === 'finished') {
    return 'TERMINÉ';
  }
  return match.kickoffTime ? match.kickoffTime : 'À VENIR';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTeam(raw: unknown, fallbackId: string): TeamInfo | null {
  if (!isRecord(raw)) {
    return null;
  }

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : null;
  const shortName =
    typeof raw.shortName === 'string' && raw.shortName.trim()
      ? raw.shortName.trim()
      : name
        ? name.slice(0, 16)
        : null;

  if (!name && !shortName) {
    return null;
  }

  const resolvedName = name ?? shortName ?? 'Team';

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : fallbackId,
    name: resolvedName,
    shortName: shortName ?? resolvedName,
    logoUrl:
      typeof raw.logoUrl === 'string' && raw.logoUrl.trim()
        ? raw.logoUrl.trim()
        : resolveTeamLogoUrl(resolvedName),
    primaryColor:
      typeof raw.primaryColor === 'string' && raw.primaryColor.trim()
        ? raw.primaryColor.trim()
        : '#0038C7',
    secondaryColor:
      typeof raw.secondaryColor === 'string' && raw.secondaryColor.trim()
        ? raw.secondaryColor.trim()
        : '#FFFFFF',
  };
}

function normalizeScore(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const num = Number(String(value).trim());
  if (Number.isFinite(num) && num >= 0) {
    return Math.floor(num);
  }
  return null;
}

function normalizeStatus(
  value: unknown,
  homeScore: number | null,
  awayScore: number | null,
): MatchStatus {
  if (value === 'upcoming' || value === 'live' || value === 'finished') {
    return value;
  }
  if (homeScore !== null && awayScore !== null) {
    return 'finished';
  }
  return 'upcoming';
}

export function normalizeMatchesResponse(raw: unknown): MatchItem[] | null {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.matches)
      ? raw.matches
      : null;

  if (!list || list.length === 0) {
    return null;
  }

  const normalized: MatchItem[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!isRecord(item)) {
      continue;
    }

    const homeTeam = normalizeTeam(item.homeTeam, `home-${i}`);
    const awayTeam = normalizeTeam(item.awayTeam, `away-${i}`);
    if (!homeTeam || !awayTeam) {
      continue;
    }

    const homeScore = normalizeScore(item.homeScore);
    const awayScore = normalizeScore(item.awayScore);

    normalized.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `match-${i + 1}`,
      stage:
        typeof item.stage === 'string' && item.stage.trim()
          ? item.stage.trim().toUpperCase()
          : 'DEMI FINALE !!',
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      status: normalizeStatus(item.status, homeScore, awayScore),
      kickoffTime:
        typeof item.kickoffTime === 'string' && item.kickoffTime.trim()
          ? item.kickoffTime.trim()
          : undefined,
    });
  }

  return normalized.length > 0 ? normalized : null;
}

export function hasPkZipSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function parseWorkbookRows(rows: unknown[][]): MatchItem[] {
  if (!Array.isArray(rows) || rows.length <= 1) {
    return [];
  }

  const matches: MatchItem[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const homeName = row[0] !== null && row[0] !== undefined ? String(row[0]).trim() : '';
    const homeScore = normalizeScore(row[1]);
    const awayScore = normalizeScore(row[2]);
    const awayName = row[3] !== null && row[3] !== undefined ? String(row[3]).trim() : '';
    const stageCell = row[4] !== null && row[4] !== undefined ? String(row[4]).trim() : '';

    if (!homeName && !awayName && homeScore === null && awayScore === null) {
      continue;
    }
    if (!homeName || !awayName) {
      continue;
    }

    const hasScores = homeScore !== null && awayScore !== null;

    matches.push({
      id: `match-${rowIndex}`,
      stage: stageCell ? stageCell.toUpperCase() : 'DEMI FINALE !!',
      homeTeam: {
        id: `home-${rowIndex}`,
        name: homeName,
        shortName: homeName,
        logoUrl: resolveTeamLogoUrl(homeName),
        primaryColor: '#0038C7',
        secondaryColor: '#FFFFFF',
      },
      awayTeam: {
        id: `away-${rowIndex}`,
        name: awayName,
        shortName: awayName,
        logoUrl: resolveTeamLogoUrl(awayName),
        primaryColor: '#0038C7',
        secondaryColor: '#FFFFFF',
      },
      homeScore,
      awayScore,
      status: hasScores ? 'finished' : 'upcoming',
    });
  }

  return matches;
}

export interface FetchLike {
  (input: string, init?: RequestInit): Promise<{
    ok: boolean;
    status?: number;
    headers?: { get(name: string): string | null };
    text?: () => Promise<string>;
    json?: () => Promise<unknown>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
  }>;
}

export async function fetchOneDriveExcelDirect(
  excelUrls: readonly string[] = DEFAULT_ONEDRIVE_DOWNLOAD_URLS,
  fetcher: FetchLike | undefined = typeof fetch === 'function' ? fetch : undefined,
): Promise<MatchItem[] | null> {
  if (!fetcher) {
    return null;
  }

  for (const url of excelUrls) {
    try {
      const response = await fetcher(url, { cache: 'no-store' });
      if (!response.ok || typeof response.arrayBuffer !== 'function') {
        continue;
      }

      const contentType = (response.headers?.get('content-type') ?? '').toLowerCase();
      if (contentType.includes('text/html')) {
        continue;
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!hasPkZipSignature(bytes)) {
        continue;
      }

      const XLSX = await import('xlsx');
      const workbook = XLSX.read(bytes, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        continue;
      }

      const sheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
      const matches = parseWorkbookRows(rows);
      if (matches.length > 0) {
        return matches;
      }
    } catch {
      // Try next fallback URL or degrade gracefully to mock data
    }
  }

  return null;
}

export async function fetchMatchesData(
  endpoints: readonly string[] = resolveConfiguredEndpoints(),
  fetcher: FetchLike | undefined = typeof fetch === 'function' ? fetch : undefined,
  excelFallbackUrls: readonly string[] = DEFAULT_ONEDRIVE_DOWNLOAD_URLS,
): Promise<MatchesFetchResult> {
  const updatedAt = new Date().toISOString();

  if (!fetcher) {
    return { matches: DEFAULT_MATCHES, source: 'fallback', updatedAt };
  }

  for (const endpoint of endpoints) {
    try {
      const response = await fetcher(endpoint, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        continue;
      }

      const contentType = (response.headers?.get('content-type') ?? '').toLowerCase();
      if (contentType.includes('text/html')) {
        continue;
      }

      let payload: unknown;
      if (typeof response.text === 'function') {
        const rawText = (await response.text()).trim();
        if (!rawText || rawText.startsWith('<')) {
          continue;
        }
        payload = JSON.parse(rawText);
      } else if (typeof response.json === 'function') {
        payload = await response.json();
      } else {
        continue;
      }

      const matches = normalizeMatchesResponse(payload);
      if (matches) {
        return { matches, source: 'api', updatedAt };
      }
    } catch {
      // Try next configured endpoint
    }
  }

  // Preview fallback: fetch and parse OneDrive .xlsx directly in browser if functions return 404
  if (excelFallbackUrls.length > 0) {
    const directMatches = await fetchOneDriveExcelDirect(excelFallbackUrls, fetcher);
    if (directMatches && directMatches.length > 0) {
      return { matches: directMatches, source: 'api', updatedAt };
    }
  }

  return { matches: DEFAULT_MATCHES, source: 'fallback', updatedAt };
}

export function resolveConfiguredEndpoints(): readonly string[] {
  const envEndpoint =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_MATCHES_API_URL === 'string'
      ? import.meta.env.VITE_MATCHES_API_URL.trim()
      : '';

  if (envEndpoint) {
    return [envEndpoint, ...DEFAULT_MATCHES_ENDPOINTS];
  }
  return DEFAULT_MATCHES_ENDPOINTS;
}

export function resolveConfiguredPlayersEndpoints(): readonly string[] {
  const envEndpoint =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_PLAYERS_API_URL === 'string'
      ? import.meta.env.VITE_PLAYERS_API_URL.trim()
      : '';

  if (envEndpoint) {
    return [envEndpoint, ...DEFAULT_PLAYERS_ENDPOINTS];
  }
  return DEFAULT_PLAYERS_ENDPOINTS;
}

export function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function formatPlayerScore(score: number | null | undefined): string {
  if (typeof score === 'number' && Number.isFinite(score)) {
    return String(score);
  }
  return '-';
}

export function normalizePlayersResponse(raw: unknown): PlayerItem[] | null {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.players)
      ? raw.players
      : null;

  if (!list) {
    return null;
  }

  const normalized: PlayerItem[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!isRecord(item)) {
      continue;
    }

    const teamName = typeof item.teamName === 'string' ? item.teamName.trim() : '';
    const playerName = typeof item.playerName === 'string' ? item.playerName.trim() : '';
    const playerId =
      item.playerId !== null && item.playerId !== undefined
        ? String(item.playerId).trim()
        : '';

    if (!teamName || !playerName) {
      continue;
    }

    normalized.push({
      id:
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim()
          : `player-${i}-${playerId || playerName}`,
      teamName,
      playerName,
      playerId: playerId || '-',
      playerScore: normalizeScore(item.playerScore),
    });
  }

  return normalized;
}

export function parsePlayersWorkbookRows(rows: unknown[][]): PlayerItem[] {
  if (!Array.isArray(rows) || rows.length <= 1) {
    return [];
  }

  const players: PlayerItem[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const teamName = row[0] !== null && row[0] !== undefined ? String(row[0]).trim() : '';
    const playerName = row[1] !== null && row[1] !== undefined ? String(row[1]).trim() : '';
    const playerId = row[2] !== null && row[2] !== undefined ? String(row[2]).trim() : '';
    const playerScore = normalizeScore(row[3]);

    if (!teamName && !playerName && !playerId && playerScore === null) {
      continue;
    }
    if (!teamName || !playerName) {
      continue;
    }

    players.push({
      id: `player-${rowIndex}-${playerId || playerName}`,
      teamName,
      playerName,
      playerId: playerId || '-',
      playerScore,
    });
  }

  return players;
}

export function getPlayersForTeam(players: readonly PlayerItem[], teamName: string): PlayerItem[] {
  const target = teamName.trim().toLowerCase();
  if (!target) {
    return [];
  }
  return players.filter((player) => player.teamName.trim().toLowerCase() === target);
}

export async function fetchOneDrivePlayersExcelDirect(
  excelUrls: readonly string[] = DEFAULT_PLAYERS_ONEDRIVE_DOWNLOAD_URLS,
  fetcher: FetchLike | undefined = typeof fetch === 'function' ? fetch : undefined,
): Promise<PlayerItem[] | null> {
  if (!fetcher) {
    return null;
  }

  for (const url of excelUrls) {
    try {
      const response = await fetcher(url, { cache: 'no-store' });
      if (!response.ok || typeof response.arrayBuffer !== 'function') {
        continue;
      }

      const contentType = (response.headers?.get('content-type') ?? '').toLowerCase();
      if (contentType.includes('text/html')) {
        continue;
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!hasPkZipSignature(bytes)) {
        continue;
      }

      const XLSX = await import('xlsx');
      const workbook = XLSX.read(bytes, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        continue;
      }

      const sheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
      return parsePlayersWorkbookRows(rows);
    } catch {
      // Try next fallback URL
    }
  }

  return null;
}

export async function fetchPlayersData(
  endpoints: readonly string[] = resolveConfiguredPlayersEndpoints(),
  fetcher: FetchLike | undefined = typeof fetch === 'function' ? fetch : undefined,
  excelFallbackUrls: readonly string[] = DEFAULT_PLAYERS_ONEDRIVE_DOWNLOAD_URLS,
): Promise<PlayersFetchResult> {
  const updatedAt = new Date().toISOString();

  if (!fetcher) {
    return { players: [], source: 'fallback', updatedAt };
  }

  for (const endpoint of endpoints) {
    try {
      const response = await fetcher(endpoint, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        continue;
      }

      const contentType = (response.headers?.get('content-type') ?? '').toLowerCase();
      if (contentType.includes('text/html')) {
        continue;
      }

      let payload: unknown;
      if (typeof response.text === 'function') {
        const rawText = (await response.text()).trim();
        if (!rawText || rawText.startsWith('<')) {
          continue;
        }
        payload = JSON.parse(rawText);
      } else if (typeof response.json === 'function') {
        payload = await response.json();
      } else {
        continue;
      }

      const players = normalizePlayersResponse(payload);
      if (players) {
        return { players, source: 'api', updatedAt };
      }
    } catch {
      // Try next configured endpoint
    }
  }

  if (excelFallbackUrls.length > 0) {
    const directPlayers = await fetchOneDrivePlayersExcelDirect(excelFallbackUrls, fetcher);
    if (directPlayers) {
      return { players: directPlayers, source: 'api', updatedAt };
    }
  }

  return { players: [], source: 'fallback', updatedAt };
}

const FPL_API_BASE = 'https://fantasy.premierleague.com/api';
const FPL_PHOTO_BASE_250 =
  'https://resources.premierleague.com/premierleague/photos/players/250x250';
const FPL_PHOTO_BASE_110 =
  'https://resources.premierleague.com/premierleague/photos/players/110x140';
const FPL_CLIENT_CACHE_TTL_MS = 90_000;

interface BootstrapElementLookup {
  id: number;
  code: number | null;
  webName: string;
  firstName: string;
  secondName: string;
  fullName: string;
  elementType: number;
  positionLabel: FplPositionLabel;
  teamShortName: string;
  teamName: string;
  teamCode: number | null;
  photoUrl: string;
  photoUrls: string[];
}

let cachedBootstrapElements: Map<number, BootstrapElementLookup> | null = null;
const cachedEventLivePoints = new Map<number, Map<number, number>>();
const cachedClientSquads = new Map<string, { squad: FplSquadData; cachedAt: number }>();

export function resetFplClientCachesForTests(): void {
  cachedBootstrapElements = null;
  cachedEventLivePoints.clear();
  cachedClientSquads.clear();
}

export function isValidFplEntryId(rawId: string | number | null | undefined): string | null {
  if (rawId === null || rawId === undefined) {
    return null;
  }
  const cleaned = String(rawId).trim();
  if (!/^\d{1,12}$/.test(cleaned)) {
    return null;
  }
  const num = Number(cleaned);
  return Number.isSafeInteger(num) && num > 0 ? cleaned : null;
}

export function mapFplElementType(elementType: unknown): FplPositionLabel {
  if (elementType === 1) return 'GK';
  if (elementType === 2) return 'DEF';
  if (elementType === 4) return 'FWD';
  return 'MID';
}

function extractFplPhotoNumericId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const cleaned = String(value)
    .replace(/\.(jpg|jpeg|png|webp)$/i, '')
    .replace(/\D/g, '');
  if (!cleaned) {
    return null;
  }
  const numeric = Number(cleaned);
  return Number.isSafeInteger(numeric) && numeric > 0 ? cleaned : null;
}

export interface PlayerPhotoCandidateMeta {
  fullName?: string | null;
  webName?: string | null;
  firstName?: string | null;
  secondName?: string | null;
  teamName?: string | null;
  teamCode?: number | string | null;
}

export function buildPlayerPhotoProxyUrl(params: {
  code?: string | number | null;
  photoCode?: string | number | null;
  name?: string | null;
  webName?: string | null;
  firstName?: string | null;
  secondName?: string | null;
  team?: string | null;
  teamCode?: string | number | null;
}): string {
  const parts: string[] = [];
  if (params.code) {
    parts.push(`code=${encodeURIComponent(String(params.code))}`);
  }
  if (params.photoCode) {
    parts.push(`photoCode=${encodeURIComponent(String(params.photoCode))}`);
  }
  if (params.name) {
    parts.push(`name=${encodeURIComponent(params.name)}`);
  }
  if (params.webName) {
    parts.push(`webName=${encodeURIComponent(params.webName)}`);
  }
  if (params.firstName) {
    parts.push(`firstName=${encodeURIComponent(params.firstName)}`);
  }
  if (params.secondName) {
    parts.push(`secondName=${encodeURIComponent(params.secondName)}`);
  }
  if (params.team) {
    parts.push(`team=${encodeURIComponent(params.team)}`);
  }
  if (params.teamCode !== null && params.teamCode !== undefined && String(params.teamCode).trim() !== '') {
    parts.push(`teamCode=${encodeURIComponent(String(params.teamCode))}`);
  }
  return parts.length > 0 ? `/.netlify/functions/player-photo?${parts.join('&')}` : '';
}

function normalizeCustomPlayerFileStem(raw: string): string {
  return raw
    .replace(/[øØ]/g, (ch) => (ch === 'Ø' ? 'O' : 'o'))
    .replace(/[łŁ]/g, (ch) => (ch === 'Ł' ? 'L' : 'l'))
    .replace(/[đĐðÐ]/g, (ch) => (ch === 'Đ' || ch === 'Ð' ? 'D' : 'd'))
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function buildCustomPlayerPhotoCandidates(meta?: PlayerPhotoCandidateMeta | null): string[] {
  if (!meta) {
    return [];
  }
  const webName = typeof meta.webName === 'string' ? meta.webName.replace(/[\\/]/g, '').trim() : '';
  const firstName = typeof meta.firstName === 'string' ? meta.firstName.replace(/[\\/]/g, '').trim() : '';
  const secondName = typeof meta.secondName === 'string' ? meta.secondName.replace(/[\\/]/g, '').trim() : '';
  const fullName = (
    (typeof meta.fullName === 'string' ? meta.fullName.replace(/[\\/]/g, '').trim() : '') ||
    [firstName, secondName].filter(Boolean).join(' ')
  ).trim();

  const candidates: string[] = [];
  const pushUnique = (path: string) => {
    if (path && !candidates.includes(path)) {
      candidates.push(path);
    }
  };

  if (webName) {
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      pushUnique(`/custom-players/${encodeURIComponent(webName)}${ext}`);
    }
    const lowerWeb = webName.toLowerCase();
    if (lowerWeb !== webName) {
      pushUnique(`/custom-players/${encodeURIComponent(lowerWeb)}.png`);
    }
    const normalizedWeb = normalizeCustomPlayerFileStem(webName);
    if (normalizedWeb && normalizedWeb !== webName && normalizedWeb !== lowerWeb) {
      pushUnique(`/custom-players/${encodeURIComponent(normalizedWeb)}.png`);
    }
  }

  if (fullName && fullName !== webName) {
    pushUnique(`/custom-players/${encodeURIComponent(fullName)}.png`);
  }

  return candidates;
}

export function buildFplPlayerPhotoCandidates(
  code: number | string | null | undefined,
  photo?: string | null,
  meta?: PlayerPhotoCandidateMeta | number | string | null,
): string[] {
  const codeId = extractFplPhotoNumericId(code);
  const photoId = extractFplPhotoNumericId(photo);
  const options = isRecord(meta) ? meta : {};
  const firstName = typeof options.firstName === 'string' ? options.firstName.trim() : '';
  const secondName = typeof options.secondName === 'string' ? options.secondName.trim() : '';
  const webName = typeof options.webName === 'string' ? options.webName.trim() : '';
  const fullName =
    (typeof options.fullName === 'string' ? options.fullName.trim() : '') ||
    [firstName, secondName].filter(Boolean).join(' ');
  const teamName = typeof options.teamName === 'string' ? options.teamName.trim() : '';
  const teamCode = extractFplPhotoNumericId(options.teamCode);

  const orderedCdnIds: string[] = [];
  if (codeId) {
    orderedCdnIds.push(codeId);
  }
  if (photoId && !orderedCdnIds.includes(photoId)) {
    orderedCdnIds.push(photoId);
  }

  const candidates: string[] = [];
  const pushUnique = (url: string) => {
    if (url && !candidates.includes(url)) {
      candidates.push(url);
    }
  };

  // 1. Direct Premier League CDN first for any player with a numeric code
  for (const id of orderedCdnIds) {
    pushUnique(`${FPL_PHOTO_BASE_250}/p${id}.png`);
  }

  // 2. Local custom-players folder variants
  for (const customUrl of buildCustomPlayerPhotoCandidates({
    fullName,
    webName,
    firstName,
    secondName,
  })) {
    pushUnique(customUrl);
  }

  // 3. Unified server fallback proxy (custom case-insensitive, PL25/110x140, club, TheSportsDB, Wikipedia)
  if (orderedCdnIds.length > 0 || fullName || webName || firstName || secondName) {
    const proxyUrl = buildPlayerPhotoProxyUrl({
      code: orderedCdnIds[0] ?? null,
      photoCode: orderedCdnIds[1] ?? null,
      name: fullName,
      webName,
      firstName,
      secondName,
      team: teamName,
      teamCode,
    });
    if (proxyUrl) {
      pushUnique(proxyUrl);
    }
  }

  return candidates;
}

export function resolveFplPlayerPhotoUrl(
  code: number | string | null | undefined,
  photo?: string | null,
  meta?: PlayerPhotoCandidateMeta | number | string | null,
): string {
  const candidates = buildFplPlayerPhotoCandidates(code, photo, meta);
  return candidates[0] ?? '';
}

export interface HeadshotCandidateInput {
  photoUrls?: readonly string[];
  photoUrl?: string | null;
  code?: number | string | null;
  fullName?: string | null;
  webName?: string | null;
  firstName?: string | null;
  secondName?: string | null;
  teamName?: string | null;
  teamCode?: number | string | null;
}

export function resolvePlayerHeadshotCandidates(input: HeadshotCandidateInput): string[] {
  const directPlUrls: string[] = [];
  const customUrls: string[] = [];
  const otherUrls: string[] = [];
  const proxyUrls: string[] = [];

  const classifyAndPush = (rawUrl: unknown) => {
    if (typeof rawUrl !== 'string') {
      return;
    }
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed.includes('/player-photo?')) {
      if (proxyUrls.length === 0) {
        proxyUrls.push(trimmed);
      }
      return;
    }
    if (/^https:\/\/resources\.premierleague\.com\/premierleague(?:25)?\/photos\/players\//i.test(trimmed)) {
      if (!directPlUrls.includes(trimmed)) {
        directPlUrls.push(trimmed);
      }
      return;
    }
    if (trimmed.startsWith('/custom-players/')) {
      if (!customUrls.includes(trimmed)) {
        customUrls.push(trimmed);
      }
      return;
    }
    if (!otherUrls.includes(trimmed)) {
      otherUrls.push(trimmed);
    }
  };

  // Ensure direct Premier League URL for numeric code is always primary (index 0)
  const builtCandidates = buildFplPlayerPhotoCandidates(input.code, null, {
    fullName: input.fullName,
    webName: input.webName,
    firstName: input.firstName,
    secondName: input.secondName,
    teamName: input.teamName,
    teamCode: input.teamCode,
  });
  for (const candidate of builtCandidates) {
    if (/^https:\/\/resources\.premierleague\.com\/premierleague\/photos\/players\/250x250\/p\d+\.png$/i.test(candidate)) {
      classifyAndPush(candidate);
    }
  }

  if (Array.isArray(input.photoUrls)) {
    for (const url of input.photoUrls) {
      classifyAndPush(url);
    }
  }
  classifyAndPush(input.photoUrl);

  for (const candidate of builtCandidates) {
    classifyAndPush(candidate);
  }

  return [...directPlUrls, ...customUrls, ...otherUrls, ...proxyUrls];
}

export interface ClubKitColors {
  primary: string;
  secondary: string;
  collar: string;
  text: string;
}

const CLUB_KIT_COLORS_BY_SHORT: Record<string, ClubKitColors> = {
  ARS: { primary: '#EF0107', secondary: '#FFFFFF', collar: '#FFFFFF', text: '#FFFFFF' },
  AVL: { primary: '#670E36', secondary: '#95BFE5', collar: '#95BFE5', text: '#FFFFFF' },
  BHA: { primary: '#0057B8', secondary: '#FFFFFF', collar: '#FFFFFF', text: '#FFFFFF' },
  BOU: { primary: '#B50E12', secondary: '#111827', collar: '#111827', text: '#FFFFFF' },
  BRE: { primary: '#E30613', secondary: '#FFFFFF', collar: '#111827', text: '#FFFFFF' },
  BUR: { primary: '#6C1D45', secondary: '#99D6EA', collar: '#99D6EA', text: '#FFFFFF' },
  CHE: { primary: '#034694', secondary: '#FFFFFF', collar: '#FFFFFF', text: '#FFFFFF' },
  CRY: { primary: '#1B458F', secondary: '#C4122E', collar: '#C4122E', text: '#FFFFFF' },
  EVE: { primary: '#003399', secondary: '#FFFFFF', collar: '#FFFFFF', text: '#FFFFFF' },
  FUL: { primary: '#F8FAFC', secondary: '#111827', collar: '#CC0000', text: '#111827' },
  IPS: { primary: '#3A64A3', secondary: '#FFFFFF', collar: '#FFFFFF', text: '#FFFFFF' },
  LEE: { primary: '#F8FAFC', secondary: '#1D428A', collar: '#FFCD00', text: '#1D428A' },
  LEI: { primary: '#003090', secondary: '#FDBE11', collar: '#FDBE11', text: '#FFFFFF' },
  LIV: { primary: '#C8102E', secondary: '#FFFFFF', collar: '#F6EB61', text: '#FFFFFF' },
  MCI: { primary: '#6CABDD', secondary: '#FFFFFF', collar: '#1C2C5B', text: '#0F172A' },
  MUN: { primary: '#DA291C', secondary: '#FFFFFF', collar: '#111827', text: '#FFFFFF' },
  NEW: { primary: '#1E293B', secondary: '#FFFFFF', collar: '#FFFFFF', text: '#FFFFFF' },
  NFO: { primary: '#DD0000', secondary: '#FFFFFF', collar: '#FFFFFF', text: '#FFFFFF' },
  SOU: { primary: '#D71920', secondary: '#FFFFFF', collar: '#111827', text: '#FFFFFF' },
  SUN: { primary: '#EB172B', secondary: '#FFFFFF', collar: '#111827', text: '#FFFFFF' },
  TOT: { primary: '#F8FAFC', secondary: '#132257', collar: '#132257', text: '#132257' },
  WHU: { primary: '#7A263A', secondary: '#1BB1E7', collar: '#1BB1E7', text: '#FFFFFF' },
  WOL: { primary: '#FDB913', secondary: '#111827', collar: '#111827', text: '#111827' },
};

const TEAM_CODE_TO_SHORT: Record<number, string> = {
  3: 'ARS',
  7: 'AVL',
  36: 'BHA',
  91: 'BOU',
  94: 'BRE',
  90: 'BUR',
  8: 'CHE',
  31: 'CRY',
  11: 'EVE',
  54: 'FUL',
  40: 'IPS',
  2: 'LEE',
  13: 'LEI',
  14: 'LIV',
  43: 'MCI',
  1: 'MUN',
  4: 'NEW',
  17: 'NFO',
  20: 'SOU',
  56: 'SUN',
  6: 'TOT',
  21: 'WHU',
  39: 'WOL',
};

const DEFAULT_CLUB_KIT_COLORS: ClubKitColors = {
  primary: '#1E3A8A',
  secondary: '#FFD60A',
  collar: '#FFD60A',
  text: '#FFFFFF',
};

export function getClubKitColors(
  teamShortName?: string | null,
  teamName?: string | null,
  teamCode?: number | null,
): ClubKitColors {
  const shortKey = typeof teamShortName === 'string' ? teamShortName.trim().toUpperCase() : '';
  if (shortKey && CLUB_KIT_COLORS_BY_SHORT[shortKey]) {
    return CLUB_KIT_COLORS_BY_SHORT[shortKey];
  }
  if (typeof teamCode === 'number' && TEAM_CODE_TO_SHORT[teamCode]) {
    return CLUB_KIT_COLORS_BY_SHORT[TEAM_CODE_TO_SHORT[teamCode]] ?? DEFAULT_CLUB_KIT_COLORS;
  }
  const lowerName = typeof teamName === 'string' ? teamName.trim().toLowerCase() : '';
  if (lowerName.includes('arsenal')) return CLUB_KIT_COLORS_BY_SHORT.ARS;
  if (lowerName.includes('villa')) return CLUB_KIT_COLORS_BY_SHORT.AVL;
  if (lowerName.includes('brighton')) return CLUB_KIT_COLORS_BY_SHORT.BHA;
  if (lowerName.includes('bournemouth')) return CLUB_KIT_COLORS_BY_SHORT.BOU;
  if (lowerName.includes('brentford')) return CLUB_KIT_COLORS_BY_SHORT.BRE;
  if (lowerName.includes('burnley')) return CLUB_KIT_COLORS_BY_SHORT.BUR;
  if (lowerName.includes('chelsea')) return CLUB_KIT_COLORS_BY_SHORT.CHE;
  if (lowerName.includes('palace')) return CLUB_KIT_COLORS_BY_SHORT.CRY;
  if (lowerName.includes('everton')) return CLUB_KIT_COLORS_BY_SHORT.EVE;
  if (lowerName.includes('fulham')) return CLUB_KIT_COLORS_BY_SHORT.FUL;
  if (lowerName.includes('leeds')) return CLUB_KIT_COLORS_BY_SHORT.LEE;
  if (lowerName.includes('liverpool')) return CLUB_KIT_COLORS_BY_SHORT.LIV;
  if (lowerName.includes('man city') || lowerName.includes('manchester city')) return CLUB_KIT_COLORS_BY_SHORT.MCI;
  if (lowerName.includes('man utd') || lowerName.includes('manchester united')) return CLUB_KIT_COLORS_BY_SHORT.MUN;
  if (lowerName.includes('newcastle')) return CLUB_KIT_COLORS_BY_SHORT.NEW;
  if (lowerName.includes('forest')) return CLUB_KIT_COLORS_BY_SHORT.NFO;
  if (lowerName.includes('sunderland')) return CLUB_KIT_COLORS_BY_SHORT.SUN;
  if (lowerName.includes('tottenham') || lowerName.includes('spurs')) return CLUB_KIT_COLORS_BY_SHORT.TOT;
  if (lowerName.includes('west ham')) return CLUB_KIT_COLORS_BY_SHORT.WHU;
  if (lowerName.includes('wolves') || lowerName.includes('wolverhampton')) return CLUB_KIT_COLORS_BY_SHORT.WOL;
  return DEFAULT_CLUB_KIT_COLORS;
}

function extractFirstInitialChar(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }
  const match = value.trim().match(/[a-zA-Z\u00C0-\u024F\u0600-\u06FF0-9]/);
  return match ? match[0].toUpperCase() : '';
}

/**
 * Step 5 Final Fallback initials:
 * Uses uppercase first letter of `first_name` + uppercase first letter of `second_name` (e.g. J + G -> JG),
 * falling back to `web_name` initials if either name part is unavailable.
 */
export function getPlayerFallbackInitials(input: {
  firstName?: string | null;
  secondName?: string | null;
  webName?: string | null;
  fullName?: string | null;
}): string {
  const firstInitial = extractFirstInitialChar(input.firstName);
  const secondInitial = extractFirstInitialChar(input.secondName);
  if (firstInitial && secondInitial) {
    return `${firstInitial}${secondInitial}`;
  }

  const fallbackSource = (input.webName || input.fullName || '').trim();
  const cleaned = fallbackSource.replace(/[^a-zA-Z\u00C0-\u024F\u0600-\u06FF.\-\s]/g, '').trim();
  if (!cleaned) {
    return firstInitial || secondInitial || 'PL';
  }
  const parts = cleaned.split(/[\s.\-]+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = extractFirstInitialChar(parts[0]);
    const b = extractFirstInitialChar(parts[parts.length - 1]);
    if (a && b) {
      return `${a}${b}`;
    }
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function getNextHeadshotCandidateIndex(
  currentIndex: number,
  candidateCount: number,
): number {
  if (candidateCount <= 0) {
    return 0;
  }
  if (currentIndex < 0) {
    return 0;
  }
  if (currentIndex >= candidateCount) {
    return candidateCount;
  }
  return currentIndex + 1;
}

export function buildFplBootstrapLookupClient(
  rawBootstrap: unknown,
): Map<number, BootstrapElementLookup> {
  const elementsById = new Map<number, BootstrapElementLookup>();
  if (!isRecord(rawBootstrap)) {
    return elementsById;
  }

  const teamsById = new Map<number, string>();
  const teamNamesById = new Map<number, string>();
  const teamCodesById = new Map<number, number>();
  if (Array.isArray(rawBootstrap.teams)) {
    for (const team of rawBootstrap.teams) {
      if (isRecord(team) && typeof team.id === 'number') {
        const shortLabel =
          typeof team.short_name === 'string' && team.short_name.trim()
            ? team.short_name.trim()
            : typeof team.name === 'string'
              ? team.name.trim()
              : '';
        const fullLabel =
          typeof team.name === 'string' && team.name.trim()
            ? team.name.trim()
            : shortLabel;
        const teamCodeNum =
          typeof team.code === 'number' && Number.isFinite(team.code) ? team.code : null;
        teamsById.set(team.id, shortLabel);
        teamNamesById.set(team.id, fullLabel);
        if (teamCodeNum !== null) {
          teamCodesById.set(team.id, teamCodeNum);
        }
      }
    }
  }

  if (Array.isArray(rawBootstrap.elements)) {
    for (const el of rawBootstrap.elements) {
      if (!isRecord(el) || typeof el.id !== 'number') {
        continue;
      }
      const rawCode = typeof el.code === 'number' || typeof el.code === 'string' ? el.code : null;
      const photoStr = typeof el.photo === 'string' ? el.photo : '';
      const cleanCodeStr =
        extractFplPhotoNumericId(rawCode) || extractFplPhotoNumericId(photoStr);
      const codeNum = cleanCodeStr ? Number(cleanCodeStr) : null;
      const elementType = typeof el.element_type === 'number' ? el.element_type : 3;
      const webName =
        typeof el.web_name === 'string' && el.web_name.trim()
          ? el.web_name.trim()
          : `#${el.id}`;
      const firstName = typeof el.first_name === 'string' ? el.first_name.trim() : '';
      const secondName = typeof el.second_name === 'string' ? el.second_name.trim() : '';
      const fullName = [firstName, secondName].filter(Boolean).join(' ') || webName;
      const teamShortName = typeof el.team === 'number' ? teamsById.get(el.team) || '' : '';
      const teamName = typeof el.team === 'number' ? teamNamesById.get(el.team) || teamShortName : '';
      const teamCode =
        typeof el.team_code === 'number' && Number.isFinite(el.team_code)
          ? el.team_code
          : typeof el.team === 'number'
            ? teamCodesById.get(el.team) ?? null
            : null;
      const photoUrls = buildFplPlayerPhotoCandidates(rawCode, photoStr, {
        fullName,
        webName,
        firstName,
        secondName,
        teamName,
        teamCode,
      });

      elementsById.set(el.id, {
        id: el.id,
        code: codeNum,
        webName,
        firstName,
        secondName,
        fullName,
        elementType,
        positionLabel: mapFplElementType(elementType),
        teamShortName,
        teamName,
        teamCode,
        photoUrl: photoUrls[0] ?? '',
        photoUrls,
      });
    }
  }

  return elementsById;
}

export function buildFplLivePointsMapClient(rawLive: unknown): Map<number, number> {
  const pointsById = new Map<number, number>();
  if (!isRecord(rawLive) && !Array.isArray(rawLive)) {
    return pointsById;
  }

  const rawElements = isRecord(rawLive) && 'elements' in rawLive ? rawLive.elements : rawLive;

  if (Array.isArray(rawElements)) {
    for (const item of rawElements) {
      if (!isRecord(item)) {
        continue;
      }
      const id = Number(item.id);
      const stats = isRecord(item.stats) ? item.stats : null;
      const totalPoints = stats ? stats.total_points : undefined;
      if (Number.isFinite(id) && typeof totalPoints === 'number' && Number.isFinite(totalPoints)) {
        pointsById.set(id, totalPoints);
      }
    }
    return pointsById;
  }

  if (isRecord(rawElements)) {
    for (const [key, item] of Object.entries(rawElements)) {
      if (!isRecord(item)) {
        continue;
      }
      const id = Number(item.id ?? key);
      const stats = isRecord(item.stats) ? item.stats : null;
      const totalPoints = stats ? stats.total_points : undefined;
      if (Number.isFinite(id) && typeof totalPoints === 'number' && Number.isFinite(totalPoints)) {
        pointsById.set(id, totalPoints);
      }
    }
  }

  return pointsById;
}

export function assembleFplSquadClient(
  entryId: string,
  event: number,
  picksPayload: unknown,
  bootstrapLookup: Map<number, BootstrapElementLookup>,
  livePointsMap?: Map<number, number> | null,
): FplSquadData | null {
  if (!isRecord(picksPayload) || !Array.isArray(picksPayload.picks)) {
    return null;
  }

  const mapped: FplSquadPlayer[] = picksPayload.picks
    .filter(isRecord)
    .map((pick) => {
      const elementId = Number(pick.element);
      const position = Number(pick.position);
      const meta = bootstrapLookup.get(elementId);
      const multiplier =
        typeof pick.multiplier === 'number' && Number.isFinite(pick.multiplier)
          ? pick.multiplier
          : 1;
      const elementType =
        meta?.elementType ??
        (typeof pick.element_type === 'number' && Number.isFinite(pick.element_type)
          ? pick.element_type
          : 3);

      const rawPoints =
        livePointsMap && livePointsMap.has(elementId) ? livePointsMap.get(elementId) ?? 0 : 0;
      const isStarter = Number.isFinite(position) && position >= 1 && position <= 11;
      const points = isStarter ? rawPoints * multiplier : rawPoints;
      const webName = meta?.webName ?? (Number.isFinite(elementId) ? `Player #${elementId}` : 'Player');
      const firstName = meta?.firstName ?? '';
      const secondName = meta?.secondName ?? '';
      const fullName = meta?.fullName ?? webName;
      const teamShortName = meta?.teamShortName ?? '';
      const teamName = meta?.teamName ?? teamShortName;
      const teamCode = meta?.teamCode ?? null;
      const photoUrls =
        meta?.photoUrls && meta.photoUrls.length > 0
          ? meta.photoUrls
          : meta?.photoUrl
            ? [meta.photoUrl]
            : [];

      return {
        elementId: Number.isFinite(elementId) ? elementId : 0,
        code: meta?.code ?? null,
        webName,
        web_name: webName,
        firstName,
        first_name: firstName,
        secondName,
        second_name: secondName,
        fullName,
        elementType,
        positionLabel: meta?.positionLabel ?? mapFplElementType(elementType),
        teamShortName,
        teamName,
        teamCode,
        team_code: teamCode,
        photoUrl: photoUrls[0] ?? '',
        photoUrls,
        position: Number.isFinite(position) ? position : 99,
        multiplier,
        isCaptain: Boolean(pick.is_captain),
        isViceCaptain: Boolean(pick.is_vice_captain),
        rawPoints,
        points,
      };
    })
    .sort((a, b) => a.position - b.position);

  const history = isRecord(picksPayload.entry_history) ? picksPayload.entry_history : null;

  return {
    entryId,
    event,
    activeChip: typeof picksPayload.active_chip === 'string' ? picksPayload.active_chip : null,
    eventPoints:
      history && typeof history.points === 'number' && Number.isFinite(history.points)
        ? history.points
        : null,
    totalPoints:
      history &&
      typeof history.total_points === 'number' &&
      Number.isFinite(history.total_points)
        ? history.total_points
        : null,
    pointsOnBench:
      history &&
      typeof history.points_on_bench === 'number' &&
      Number.isFinite(history.points_on_bench)
        ? history.points_on_bench
        : null,
    rank:
      history && typeof history.rank === 'number' && Number.isFinite(history.rank)
        ? history.rank
        : null,
    startingXI: mapped.filter((p) => p.position >= 1 && p.position <= 11),
    bench: mapped.filter((p) => p.position >= 12),
    updatedAt: new Date().toISOString(),
  };
}

function isSafePlPhotoUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return (
    /^\/(\.netlify\/functions|api)\/player-photo\?[^#\s]+$/i.test(trimmed) ||
    /^\/custom-players\/[^#\s]+$/i.test(trimmed) ||
    /^https:\/\/resources\.premierleague\.com\/premierleague(?:25)?\/photos\/players\/(250x250|110x140)\/p\d+\.png$/i.test(
      trimmed,
    )
  );
}

function normalizeSquadPlayerFromApi(raw: unknown): FplSquadPlayer | null {
  if (!isRecord(raw)) {
    return null;
  }
  const elementId = Number(raw.elementId);
  const position = Number(raw.position);
  if (!Number.isFinite(elementId) || !Number.isFinite(position)) {
    return null;
  }
  const cleanedRawCode = extractFplPhotoNumericId(
    typeof raw.code === 'number' || typeof raw.code === 'string' ? raw.code : null,
  );
  const code = cleanedRawCode ? Number(cleanedRawCode) : null;
  const elementType = typeof raw.elementType === 'number' ? raw.elementType : 3;
  const posLabel =
    raw.positionLabel === 'GK' ||
    raw.positionLabel === 'DEF' ||
    raw.positionLabel === 'MID' ||
    raw.positionLabel === 'FWD'
      ? raw.positionLabel
      : mapFplElementType(elementType);

  const rawWebName =
    typeof raw.webName === 'string'
      ? raw.webName
      : typeof raw.web_name === 'string'
        ? raw.web_name
        : '';
  const webName = rawWebName.trim() || `#${elementId}`;
  const firstName =
    typeof raw.firstName === 'string'
      ? raw.firstName.trim()
      : typeof raw.first_name === 'string'
        ? raw.first_name.trim()
        : '';
  const secondName =
    typeof raw.secondName === 'string'
      ? raw.secondName.trim()
      : typeof raw.second_name === 'string'
        ? raw.second_name.trim()
        : '';
  const fullName =
    (typeof raw.fullName === 'string' && raw.fullName.trim() ? raw.fullName.trim() : '') ||
    [firstName, secondName].filter(Boolean).join(' ') ||
    webName;
  const teamShortName = typeof raw.teamShortName === 'string' ? raw.teamShortName.trim() : '';
  const teamName =
    typeof raw.teamName === 'string' && raw.teamName.trim() ? raw.teamName.trim() : teamShortName;
  const cleanedTeamCode = extractFplPhotoNumericId(
    typeof raw.teamCode === 'number' || typeof raw.teamCode === 'string'
      ? raw.teamCode
      : typeof raw.team_code === 'number' || typeof raw.team_code === 'string'
        ? raw.team_code
        : null,
  );
  const teamCode = cleanedTeamCode ? Number(cleanedTeamCode) : null;

  const safeApiUrls = Array.isArray(raw.photoUrls)
    ? raw.photoUrls.filter(isSafePlPhotoUrl).map((u) => u.trim())
    : [];
  const primaryFromRaw = isSafePlPhotoUrl(raw.photoUrl) ? raw.photoUrl.trim() : '';
  const mergedPhotoUrls = resolvePlayerHeadshotCandidates({
    photoUrls: safeApiUrls,
    photoUrl: primaryFromRaw,
    code,
    fullName,
    webName,
    firstName,
    secondName,
    teamName,
    teamCode,
  }).filter(isSafePlPhotoUrl);

  const rawPoints =
    typeof raw.rawPoints === 'number' && Number.isFinite(raw.rawPoints) ? raw.rawPoints : null;
  const points = typeof raw.points === 'number' && Number.isFinite(raw.points) ? raw.points : 0;

  return {
    elementId,
    code,
    webName,
    web_name: webName,
    firstName,
    first_name: firstName,
    secondName,
    second_name: secondName,
    fullName,
    elementType,
    positionLabel: posLabel,
    teamShortName,
    teamName,
    teamCode,
    team_code: teamCode,
    photoUrl: mergedPhotoUrls[0] ?? '',
    photoUrls: mergedPhotoUrls,
    position,
    multiplier:
      typeof raw.multiplier === 'number' && Number.isFinite(raw.multiplier) ? raw.multiplier : 1,
    isCaptain: Boolean(raw.isCaptain),
    isViceCaptain: Boolean(raw.isViceCaptain),
    rawPoints: rawPoints ?? points,
    points,
  };
}

export function normalizeFplSquadResponse(raw: unknown): FplSquadData | null {
  if (!isRecord(raw) || !Array.isArray(raw.startingXI) || !Array.isArray(raw.bench)) {
    return null;
  }

  const entryId = isValidFplEntryId(
    typeof raw.entryId === 'string' || typeof raw.entryId === 'number' ? raw.entryId : null,
  );
  if (!entryId) {
    return null;
  }

  const startingXI = raw.startingXI
    .map(normalizeSquadPlayerFromApi)
    .filter((p): p is FplSquadPlayer => p !== null);
  const bench = raw.bench
    .map(normalizeSquadPlayerFromApi)
    .filter((p): p is FplSquadPlayer => p !== null);

  if (startingXI.length === 0 && bench.length === 0) {
    return null;
  }

  return {
    entryId,
    event: typeof raw.event === 'number' && Number.isFinite(raw.event) ? raw.event : DEFAULT_FPL_EVENT,
    activeChip: typeof raw.activeChip === 'string' ? raw.activeChip : null,
    eventPoints:
      typeof raw.eventPoints === 'number' && Number.isFinite(raw.eventPoints)
        ? raw.eventPoints
        : null,
    totalPoints:
      typeof raw.totalPoints === 'number' && Number.isFinite(raw.totalPoints)
        ? raw.totalPoints
        : null,
    pointsOnBench:
      typeof raw.pointsOnBench === 'number' && Number.isFinite(raw.pointsOnBench)
        ? raw.pointsOnBench
        : null,
    rank:
      typeof raw.rank === 'number' && Number.isFinite(raw.rank)
        ? raw.rank
        : null,
    startingXI,
    bench,
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

const PREVIEW_SAMPLE_BOOTSTRAP = buildFplBootstrapLookupClient({
  teams: [
    { id: 1, short_name: 'ARS', name: 'Arsenal' },
    { id: 2, short_name: 'AVL', name: 'Aston Villa' },
    { id: 5, short_name: 'BRE', name: 'Brentford' },
    { id: 7, short_name: 'CHE', name: 'Chelsea' },
    { id: 8, short_name: 'CRY', name: 'Crystal Palace' },
    { id: 10, short_name: 'FUL', name: 'Fulham' },
    { id: 13, short_name: 'MCI', name: 'Man City' },
    { id: 14, short_name: 'MUN', name: 'Man Utd' },
    { id: 15, short_name: 'NEW', name: 'Newcastle' },
  ],
  elements: [
    { id: 1, code: 154561, photo: '154561.jpg', first_name: 'David', second_name: 'Raya', web_name: 'Raya', element_type: 1, team: 1 },
    { id: 504, code: 226597, photo: '226597.jpg', first_name: 'Gabriel', second_name: 'dos Santos Magalhães', web_name: 'Gabriel', element_type: 2, team: 1 },
    { id: 112, code: 462424, photo: '462424.jpg', first_name: 'William', second_name: 'Saliba', web_name: 'Saliba', element_type: 2, team: 1 },
    { id: 115, code: 477424, photo: '477424.jpg', first_name: 'Joško', second_name: 'Gvardiol', web_name: 'Gvardiol', element_type: 2, team: 13 },
    { id: 366, code: 179268, photo: '179268.jpg', first_name: 'Marc', second_name: 'Cucurella', web_name: 'Cucurella', element_type: 2, team: 7 },
    { id: 40, code: 141746, photo: '141746.jpg', first_name: 'Bruno', second_name: 'Borges Fernandes', web_name: 'B.Fernandes', element_type: 3, team: 14 },
    { id: 154, code: 223340, photo: '223340.jpg', first_name: 'Bukayo', second_name: 'Saka', web_name: 'Saka', element_type: 3, team: 1 },
    { id: 15, code: 244851, photo: '244851.jpg', first_name: 'Cole', second_name: 'Palmer', web_name: 'Palmer', element_type: 3, team: 7 },
    { id: 124, code: 446008, photo: '446008.jpg', first_name: 'Bryan', second_name: 'Mbeumo', web_name: 'Mbeumo', element_type: 3, team: 5 },
    { id: 249, code: 219168, photo: '219168.jpg', first_name: 'Alexander', second_name: 'Isak', web_name: 'Isak', element_type: 4, team: 15 },
    { id: 411, code: 223094, photo: '223094.jpg', first_name: 'Erling', second_name: 'Haaland', web_name: 'Haaland', element_type: 4, team: 13 },
    { id: 497, code: 172649, photo: '172649.jpg', first_name: 'Dean', second_name: 'Henderson', web_name: 'Henderson', element_type: 1, team: 8 },
    { id: 31, code: 169528, photo: '169528.jpg', first_name: 'Antonee', second_name: 'Robinson', web_name: 'Robinson', element_type: 2, team: 10 },
    { id: 346, code: 244850, photo: '244850.jpg', first_name: 'Morgan', second_name: 'Rogers', web_name: 'Rogers', element_type: 3, team: 2 },
    { id: 304, code: 178301, photo: '178301.jpg', first_name: 'Ollie', second_name: 'Watkins', web_name: 'Watkins', element_type: 4, team: 2 },
  ],
});

const PREVIEW_SAMPLE_LIVE_POINTS = new Map<number, number>([
  [1, 6],
  [504, 6],
  [112, 6],
  [115, 1],
  [366, 0],
  [40, 17],
  [154, 2],
  [15, 2],
  [124, 5],
  [249, 11],
  [411, 6],
  [497, 2],
  [31, 6],
  [346, 1],
  [304, 0],
]);

const PREVIEW_SAMPLE_ENTRY_122_PICKS = {
  active_chip: null,
  automatic_subs: [],
  entry_history: {
    event: 11,
    points: 68,
    total_points: 712,
    rank: 145820,
    points_on_bench: 9,
  },
  picks: [
    { element: 1, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 1 },
    { element: 504, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
    { element: 112, position: 3, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
    { element: 115, position: 4, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
    { element: 366, position: 5, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
    { element: 40, position: 6, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
    { element: 154, position: 7, multiplier: 1, is_captain: false, is_vice_captain: true, element_type: 3 },
    { element: 15, position: 8, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
    { element: 124, position: 9, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
    { element: 249, position: 10, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
    { element: 411, position: 11, multiplier: 2, is_captain: true, is_vice_captain: false, element_type: 4 },
    { element: 497, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 1 },
    { element: 31, position: 13, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 2 },
    { element: 346, position: 14, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 3 },
    { element: 304, position: 15, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 4 },
  ],
};

export function buildPreviewFallbackSquad(requestedEntryId: string, event: number = DEFAULT_FPL_EVENT): FplSquadData {
  const assembled = assembleFplSquadClient(
    '122',
    event,
    PREVIEW_SAMPLE_ENTRY_122_PICKS,
    PREVIEW_SAMPLE_BOOTSTRAP,
    PREVIEW_SAMPLE_LIVE_POINTS,
  );
  if (!assembled) {
    throw new Error('Failed to build entry 122 preview fallback squad');
  }
  return {
    ...assembled,
    entryId: requestedEntryId,
  };
}

function getFplFriendlyErrorMessage(code: FplSquadErrorCode): string {
  switch (code) {
    case 'INVALID_ENTRY_ID':
      return 'معرّف اللاعب (FPL ID) غير صالح أو غير مسجل.';
    case 'NOT_FOUND':
    case 'NO_PICKS':
      return 'لا توجد تشكيلة مسجلة لهذا اللاعب في الجولة 11 (قد يكون المعرّف غير صحيح أو الفريق غير متاح).';
    default:
      return 'تعذر الاتصال بخادم Fantasy Premier League حالياً لجلب التشكيلة.';
  }
}

export async function fetchFplSquadData(
  rawEntryId: string,
  event: number = DEFAULT_FPL_EVENT,
  endpoints: readonly string[] = DEFAULT_FPL_SQUAD_ENDPOINTS,
  fetcher: FetchLike | undefined = typeof fetch === 'function' ? fetch : undefined,
  enablePreviewFallback: boolean = true,
): Promise<FplSquadFetchResult> {
  const entryId = isValidFplEntryId(rawEntryId);
  if (!entryId) {
    return {
      squad: null,
      source: 'error',
      errorCode: 'INVALID_ENTRY_ID',
      errorMessage: getFplFriendlyErrorMessage('INVALID_ENTRY_ID'),
    };
  }

  const cacheKey = `${entryId}:${event}`;
  const cached = cachedClientSquads.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < FPL_CLIENT_CACHE_TTL_MS) {
    return { squad: cached.squad, source: 'api' };
  }

  if (!fetcher) {
    return {
      squad: null,
      source: 'error',
      errorCode: 'UPSTREAM_UNAVAILABLE',
      errorMessage: getFplFriendlyErrorMessage('UPSTREAM_UNAVAILABLE'),
    };
  }

  let serverErrorCode: FplSquadErrorCode | null = null;

  for (const endpoint of endpoints) {
    try {
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = `${endpoint}${separator}entryId=${encodeURIComponent(entryId)}&event=${event}`;
      const response = await fetcher(url, {
        headers: { Accept: 'application/json' },
      });

      const contentType = (response.headers?.get('content-type') ?? '').toLowerCase();
      if (contentType.includes('text/html')) {
        continue;
      }

      let payload: unknown = null;
      if (typeof response.text === 'function') {
        const rawText = (await response.text()).trim();
        if (!rawText || rawText.startsWith('<')) {
          continue;
        }
        payload = JSON.parse(rawText);
      } else if (typeof response.json === 'function') {
        payload = await response.json();
      }

      if (response.ok) {
        const squad = normalizeFplSquadResponse(payload);
        if (squad) {
          cachedClientSquads.set(cacheKey, { squad, cachedAt: Date.now() });
          return { squad, source: 'api' };
        }
        continue;
      }

      if (isRecord(payload) && typeof payload.errorCode === 'string') {
        if (payload.errorCode === 'INVALID_ENTRY_ID') {
          return {
            squad: null,
            source: 'error',
            errorCode: 'INVALID_ENTRY_ID',
            errorMessage: getFplFriendlyErrorMessage('INVALID_ENTRY_ID'),
          };
        }
        if (payload.errorCode === 'NOT_FOUND' || payload.errorCode === 'NO_PICKS') {
          return {
            squad: null,
            source: 'error',
            errorCode: payload.errorCode,
            errorMessage: getFplFriendlyErrorMessage(payload.errorCode),
          };
        }
        serverErrorCode = 'UPSTREAM_UNAVAILABLE';
      }
    } catch {
      // Try next endpoint or direct client fallback
    }
  }

  // Client-side direct FPL API fallback (for static preview environments without Netlify Functions)
  try {
    const picksResp = await fetcher(
      `${FPL_API_BASE}/entry/${encodeURIComponent(entryId)}/event/${event}/picks/`,
      { headers: { Accept: 'application/json' } },
    );

    if (picksResp.status === 404) {
      return {
        squad: null,
        source: 'error',
        errorCode: 'NOT_FOUND',
        errorMessage: getFplFriendlyErrorMessage('NOT_FOUND'),
      };
    }

    if (picksResp.ok) {
      let picksPayload: unknown = null;
      if (typeof picksResp.text === 'function') {
        picksPayload = JSON.parse(await picksResp.text());
      } else if (typeof picksResp.json === 'function') {
        picksPayload = await picksResp.json();
      }

      const bootstrapPromise = cachedBootstrapElements
        ? Promise.resolve(cachedBootstrapElements)
        : fetcher(`${FPL_API_BASE}/bootstrap-static/`, {
            headers: { Accept: 'application/json' },
          })
            .then(async (bsResp) => {
              if (!bsResp.ok) return new Map<number, BootstrapElementLookup>();
              const bsPayload =
                typeof bsResp.text === 'function'
                  ? JSON.parse(await bsResp.text())
                  : typeof bsResp.json === 'function'
                    ? await bsResp.json()
                    : null;
              const lookup = buildFplBootstrapLookupClient(bsPayload);
              cachedBootstrapElements = lookup;
              return lookup;
            })
            .catch(() => new Map<number, BootstrapElementLookup>());

      const livePromise = cachedEventLivePoints.has(event)
        ? Promise.resolve(cachedEventLivePoints.get(event) ?? new Map<number, number>())
        : fetcher(`${FPL_API_BASE}/event/${event}/live/`, {
            headers: { Accept: 'application/json' },
          })
            .then(async (liveResp) => {
              if (!liveResp.ok) return new Map<number, number>();
              const livePayload =
                typeof liveResp.text === 'function'
                  ? JSON.parse(await liveResp.text())
                  : typeof liveResp.json === 'function'
                    ? await liveResp.json()
                    : null;
              const pointsMap = buildFplLivePointsMapClient(livePayload);
              cachedEventLivePoints.set(event, pointsMap);
              return pointsMap;
            })
            .catch(() => new Map<number, number>());

      const [bootstrapLookup, livePointsMap] = await Promise.all([bootstrapPromise, livePromise]);

      const squad = assembleFplSquadClient(
        entryId,
        event,
        picksPayload,
        bootstrapLookup,
        livePointsMap,
      );
      if (squad && (squad.startingXI.length > 0 || squad.bench.length > 0)) {
        cachedClientSquads.set(cacheKey, { squad, cachedAt: Date.now() });
        return { squad, source: 'direct' };
      }

      return {
        squad: null,
        source: 'error',
        errorCode: 'NO_PICKS',
        errorMessage: getFplFriendlyErrorMessage('NO_PICKS'),
      };
    }
  } catch {
    // Browser CORS or network block inside preview sandbox
  }

  if (enablePreviewFallback) {
    const previewSquad = buildPreviewFallbackSquad(entryId, event);
    const previewNotice =
      entryId === '122'
        ? 'معاينة تجريبية: حظرَت بيئة المعاينة الاتصال المباشر بخادم FPL، لذا تُعرض تشكيلة الجولة 11 للمعرّف 122. عند النشر على Netlify سيتم جلب البيانات الحية عبر الدالة الخادمية.'
        : `معاينة تجريبية: حظرَت بيئة المعاينة الاتصال المباشر بخادم FPL، لذا تُعرض عينة الجولة 11 (من المعرّف 122) بدلاً من المعرّف ${entryId}. عند النشر على Netlify سيتم جلب التشكيلة الحية تلقائياً.`;

    return {
      squad: previewSquad,
      source: 'preview-fallback',
      previewNotice,
    };
  }

  const finalCode = serverErrorCode ?? 'UPSTREAM_UNAVAILABLE';
  return {
    squad: null,
    source: 'error',
    errorCode: finalCode,
    errorMessage: getFplFriendlyErrorMessage(finalCode),
  };
}

