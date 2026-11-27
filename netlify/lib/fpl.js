import { createTimedCache } from './oneDrive.js';

export const DEFAULT_FPL_EVENT = 12;
export const FPL_SQUAD_CACHE_TTL_MS = 90_000;
export const FPL_BOOTSTRAP_CACHE_TTL_MS = 10 * 60 * 1000;
export const FPL_SQUAD_CACHE_CONTROL =
  'public, max-age=60, s-maxage=300, stale-while-revalidate=60';

const FPL_API_ORIGIN = 'https://fantasy.premierleague.com';

const FPL_REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://fantasy.premierleague.com/',
};

const POSITION_MAP = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

export function validateEntryId(rawEntryId) {
  if (rawEntryId === null || rawEntryId === undefined) {
    return null;
  }
  const cleaned = String(rawEntryId).trim();
  if (!/^\d{1,12}$/.test(cleaned)) {
    return null;
  }
  const numeric = Number(cleaned);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    return null;
  }
  return cleaned;
}

export function validateEventId(rawEventId, fallback = DEFAULT_FPL_EVENT) {
  if (rawEventId === null || rawEventId === undefined || String(rawEventId).trim() === '') {
    return fallback;
  }
  const cleaned = String(rawEventId).trim();
  if (!/^\d{1,2}$/.test(cleaned)) {
    return null;
  }
  const numeric = Number(cleaned);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 38) {
    return null;
  }
  return numeric;
}

export function mapElementTypeToPosition(elementType) {
  return POSITION_MAP[elementType] || 'MID';
}

function extractPhotoNumericId(value) {
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

/**
 * @param {{
 *   code?: string | number | null,
 *   photoCode?: string | number | null,
 *   name?: string | null,
 *   webName?: string | null,
 *   firstName?: string | null,
 *   secondName?: string | null,
 *   team?: string | null,
 *   teamCode?: string | number | null,
 * }} params
 * @returns {string}
 */
export function buildPlayerPhotoProxyUrl({
  code = null,
  photoCode = null,
  name = '',
  webName = '',
  firstName = '',
  secondName = '',
  team = '',
  teamCode = null,
} = {}) {
  const parts = [];
  if (code) {
    parts.push(`code=${encodeURIComponent(String(code))}`);
  }
  if (photoCode) {
    parts.push(`photoCode=${encodeURIComponent(String(photoCode))}`);
  }
  if (name) {
    parts.push(`name=${encodeURIComponent(name)}`);
  }
  if (webName) {
    parts.push(`webName=${encodeURIComponent(webName)}`);
  }
  if (firstName) {
    parts.push(`firstName=${encodeURIComponent(firstName)}`);
  }
  if (secondName) {
    parts.push(`secondName=${encodeURIComponent(secondName)}`);
  }
  if (team) {
    parts.push(`team=${encodeURIComponent(team)}`);
  }
  if (teamCode !== null && teamCode !== undefined && String(teamCode).trim() !== '') {
    parts.push(`teamCode=${encodeURIComponent(String(teamCode))}`);
  }
  return parts.length > 0 ? `/.netlify/functions/player-photo?${parts.join('&')}` : '';
}

const FPL_PHOTO_BASE_250 =
  'https://resources.premierleague.com/premierleague/photos/players/250x250';

function normalizeCustomPlayerStem(raw) {
  return String(raw || '')
    .replace(/[øØ]/g, (ch) => (ch === 'Ø' ? 'O' : 'o'))
    .replace(/[łŁ]/g, (ch) => (ch === 'Ł' ? 'L' : 'l'))
    .replace(/[đĐðÐ]/g, (ch) => (ch === 'Đ' || ch === 'Ð' ? 'D' : 'd'))
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Prioritizes local `/custom-players/` variants (exact, case-insensitive, and
 * accent-normalized web_name across .png, .jpg, .jpeg, .webp) FIRST before
 * falling back to direct Premier League 250x250 CDN URLs and the unified
 * server photo pipeline (`/.netlify/functions/player-photo`).
 *
 * @param {string | number | null | undefined} code
 * @param {string | null | undefined} [photo]
 * @param {{
 *   fullName?: string | null,
 *   webName?: string | null,
 *   firstName?: string | null,
 *   secondName?: string | null,
 *   teamName?: string | null,
 *   teamCode?: number | string | null,
 * } | string | number | null | undefined} [meta]
 * @returns {string[]}
 */
export function buildPlayerPhotoCandidates(code, photo, meta = null) {
  const codeId = extractPhotoNumericId(code);
  const photoId = extractPhotoNumericId(photo);
  const options = meta && typeof meta === 'object' ? meta : {};
  const firstName = typeof options.firstName === 'string' ? options.firstName.trim() : '';
  const secondName = typeof options.secondName === 'string' ? options.secondName.trim() : '';
  const webName = typeof options.webName === 'string' ? options.webName.trim() : '';
  const fullName =
    (typeof options.fullName === 'string' ? options.fullName.trim() : '') ||
    [firstName, secondName].filter(Boolean).join(' ');
  const teamName = typeof options.teamName === 'string' ? options.teamName.trim() : '';
  const teamCode = extractPhotoNumericId(options.teamCode);

  const orderedCdnIds = [];
  if (codeId) {
    orderedCdnIds.push(codeId);
  }
  if (photoId && !orderedCdnIds.includes(photoId)) {
    orderedCdnIds.push(photoId);
  }

  const candidates = [];
  const pushUnique = (url) => {
    if (url && !candidates.includes(url)) {
      candidates.push(url);
    }
  };

  // 1. Local /custom-players/ folder FIRST
  const primaryName = (webName || fullName).replace(/[\\/]/g, '').trim();
  if (primaryName) {
    const stems = [];
    const pushStem = (stem) => {
      const cleaned = stem.trim();
      if (cleaned && !stems.includes(cleaned)) {
        stems.push(cleaned);
      }
    };
    pushStem(primaryName);
    pushStem(primaryName.toLowerCase());
    const normalized = normalizeCustomPlayerStem(primaryName);
    pushStem(normalized);
    pushStem(normalized.toLowerCase());

    for (const stem of stems) {
      for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
        pushUnique(`/custom-players/${encodeURIComponent(stem)}${ext}`);
      }
    }
  }

  // 2. Direct Premier League CDN fallback
  for (const id of orderedCdnIds) {
    pushUnique(`${FPL_PHOTO_BASE_250}/p${id}.png`);
  }

  // 3. Unified server fallback proxy
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

/**
 * @param {string | number | null | undefined} code
 * @param {string | null | undefined} [photo]
 * @param {{
 *   fullName?: string | null,
 *   webName?: string | null,
 *   firstName?: string | null,
 *   secondName?: string | null,
 *   teamName?: string | null,
 *   teamCode?: number | string | null,
 * } | string | number | null | undefined} [meta]
 * @returns {string}
 */
export function resolvePlayerPhotoUrl(code, photo, meta = null) {
  const candidates = buildPlayerPhotoCandidates(code, photo, meta);
  return candidates[0] || '';
}

export function buildBootstrapMaps(bootstrapPayload) {
  const elementsById = new Map();
  const teamsById = new Map();
  const teamNamesById = new Map();
  const teamCodesById = new Map();

  const teams = Array.isArray(bootstrapPayload?.teams) ? bootstrapPayload.teams : [];
  for (const team of teams) {
    if (team && typeof team.id === 'number') {
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

  const elements = Array.isArray(bootstrapPayload?.elements) ? bootstrapPayload.elements : [];
  for (const el of elements) {
    if (!el || typeof el.id !== 'number') {
      continue;
    }
    const rawPhoto = typeof el.photo === 'string' ? el.photo : '';
    const cleanCodeStr = extractPhotoNumericId(el.code) || extractPhotoNumericId(rawPhoto);
    const codeNum = cleanCodeStr ? Number(cleanCodeStr) : null;
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
    const photoUrls = buildPlayerPhotoCandidates(el.code, rawPhoto, {
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
      elementType: typeof el.element_type === 'number' ? el.element_type : 3,
      positionLabel: mapElementTypeToPosition(el.element_type),
      teamShortName,
      teamName,
      teamCode,
      photoUrl: photoUrls[0] || '',
      photoUrls,
    });
  }

  return { elementsById, teamsById, teamNamesById, teamCodesById };
}

export function buildLivePointsMap(livePayload) {
  const pointsById = new Map();
  const rawElements = livePayload?.elements ?? livePayload;

  if (Array.isArray(rawElements)) {
    for (const item of rawElements) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const id = Number(item.id);
      const totalPoints = item.stats?.total_points;
      if (Number.isFinite(id) && typeof totalPoints === 'number' && Number.isFinite(totalPoints)) {
        pointsById.set(id, totalPoints);
      }
    }
    return pointsById;
  }

  if (rawElements && typeof rawElements === 'object') {
    for (const [key, item] of Object.entries(rawElements)) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const id = Number(item.id ?? key);
      const totalPoints = item.stats?.total_points;
      if (Number.isFinite(id) && typeof totalPoints === 'number' && Number.isFinite(totalPoints)) {
        pointsById.set(id, totalPoints);
      }
    }
  }

  return pointsById;
}

/**
 * @param {{
 *   entryId: string | number,
 *   event?: number,
 *   picksPayload: any,
 *   bootstrapMaps: any,
 *   livePointsMap?: Map<number, number> | null,
 *   excelEventPoints?: number | null,
 * }} params
 */
export function assembleFplSquad({
  entryId,
  event = DEFAULT_FPL_EVENT,
  picksPayload,
  bootstrapMaps,
  livePointsMap = null,
  excelEventPoints = null,
}) {
  const rawPicks = Array.isArray(picksPayload?.picks) ? picksPayload.picks : [];
  const mappedPlayers = rawPicks
    .map((pick) => {
      const elementId = Number(pick?.element);
      const position = Number(pick?.position);
      const element = bootstrapMaps?.elementsById?.get(elementId);
      const multiplier =
        typeof pick?.multiplier === 'number' && Number.isFinite(pick.multiplier)
          ? pick.multiplier
          : 1;

      const elementType =
        element?.elementType ??
        (typeof pick?.element_type === 'number' && Number.isFinite(pick.element_type)
          ? pick.element_type
          : 3);

      const rawPoints =
        livePointsMap instanceof Map && livePointsMap.has(elementId)
          ? livePointsMap.get(elementId) ?? 0
          : 0;
      const isStarter = Number.isFinite(position) && position >= 1 && position <= 11;
      const points = isStarter ? rawPoints * multiplier : rawPoints;
      const webName = element?.webName ?? (Number.isFinite(elementId) ? `Player #${elementId}` : 'Player');
      const firstName = element?.firstName ?? '';
      const secondName = element?.secondName ?? '';
      const fullName = element?.fullName ?? webName;
      const teamShortName = element?.teamShortName ?? '';
      const teamName = element?.teamName ?? teamShortName;
      const teamCode = element?.teamCode ?? null;
      const photoUrls = Array.isArray(element?.photoUrls)
        ? element.photoUrls
        : element?.photoUrl
          ? [element.photoUrl]
          : [];

      return {
        elementId: Number.isFinite(elementId) ? elementId : 0,
        code: element?.code ?? null,
        webName,
        web_name: webName,
        firstName,
        first_name: firstName,
        secondName,
        second_name: secondName,
        fullName,
        elementType,
        positionLabel: element?.positionLabel ?? mapElementTypeToPosition(elementType),
        teamShortName,
        teamName,
        teamCode,
        team_code: teamCode,
        photoUrl: photoUrls[0] ?? '',
        photoUrls,
        position: Number.isFinite(position) ? position : 99,
        multiplier,
        isCaptain: Boolean(pick?.is_captain),
        isViceCaptain: Boolean(pick?.is_vice_captain),
        rawPoints,
        points,
      };
    })
    .sort((a, b) => a.position - b.position);

  const startingXI = mappedPlayers.filter((player) => player.position >= 1 && player.position <= 11);
  const bench = mappedPlayers.filter((player) => player.position >= 12);

  const entryHistory =
    picksPayload && typeof picksPayload.entry_history === 'object' && picksPayload.entry_history !== null
      ? picksPayload.entry_history
      : null;

  const resolvedEventPoints =
    typeof excelEventPoints === 'number' && Number.isFinite(excelEventPoints)
      ? excelEventPoints
      : 0;

  return {
    entryId: String(entryId),
    event,
    activeChip: typeof picksPayload?.active_chip === 'string' ? picksPayload.active_chip : null,
    eventPoints: resolvedEventPoints,
    totalPoints:
      entryHistory &&
      typeof entryHistory.total_points === 'number' &&
      Number.isFinite(entryHistory.total_points)
        ? entryHistory.total_points
        : null,
    pointsOnBench:
      entryHistory &&
      typeof entryHistory.points_on_bench === 'number' &&
      Number.isFinite(entryHistory.points_on_bench)
        ? entryHistory.points_on_bench
        : null,
    rank:
      entryHistory && typeof entryHistory.rank === 'number' && Number.isFinite(entryHistory.rank)
        ? entryHistory.rank
        : null,
    startingXI,
    bench,
    updatedAt: new Date().toISOString(),
  };
}

export class FplUpstreamError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

const bootstrapCache = createTimedCache(FPL_BOOTSTRAP_CACHE_TTL_MS);
const liveCaches = new Map();
const squadCaches = new Map();

export function resetFplCachesForTests() {
  bootstrapCache.reset();
  liveCaches.clear();
  squadCaches.clear();
}

export async function fetchBootstrapMapsWithCache(
  nowMs = Date.now(),
  fetcher = fetch,
) {
  const { payload } = await bootstrapCache.get(nowMs, async () => {
    const response = await fetcher(`${FPL_API_ORIGIN}/api/bootstrap-static/`, {
      headers: FPL_REQUEST_HEADERS,
    });

    if (!response.ok) {
      throw new FplUpstreamError(
        502,
        'UPSTREAM_UNAVAILABLE',
        `FPL bootstrap-static returned HTTP ${response.status}`,
      );
    }

    const json = await response.json();
    return buildBootstrapMaps(json);
  });

  return payload;
}

export async function fetchEventLivePointsWithCache(
  event = DEFAULT_FPL_EVENT,
  nowMs = Date.now(),
  fetcher = fetch,
) {
  const validEvent = validateEventId(event);
  if (!validEvent) {
    return new Map();
  }

  let eventCache = liveCaches.get(validEvent);
  if (!eventCache) {
    eventCache = createTimedCache(FPL_SQUAD_CACHE_TTL_MS);
    liveCaches.set(validEvent, eventCache);
  }

  try {
    const { payload } = await eventCache.get(nowMs, async () => {
      const response = await fetcher(`${FPL_API_ORIGIN}/api/event/${validEvent}/live/`, {
        headers: FPL_REQUEST_HEADERS,
      });

      if (!response.ok) {
        throw new FplUpstreamError(
          502,
          'UPSTREAM_UNAVAILABLE',
          `FPL event live returned HTTP ${response.status}`,
        );
      }

      const json = await response.json();
      return buildLivePointsMap(json);
    });

    return payload;
  } catch {
    return new Map();
  }
}

export async function fetchFplSquadFromApi(entryId, event = DEFAULT_FPL_EVENT, fetcher = fetch) {
  const validEntryId = validateEntryId(entryId);
  if (!validEntryId) {
    throw new FplUpstreamError(400, 'INVALID_ENTRY_ID', 'Invalid or missing FPL manager ID.');
  }

  const validEvent = validateEventId(event);
  if (!validEvent) {
    throw new FplUpstreamError(400, 'INVALID_EVENT', 'Invalid FPL gameweek.');
  }

  const picksUrl = `${FPL_API_ORIGIN}/api/entry/${encodeURIComponent(validEntryId)}/event/${validEvent}/picks/`;

  const [picksResponse, bootstrapMaps, livePointsMap] = await Promise.all([
    fetcher(picksUrl, { headers: FPL_REQUEST_HEADERS }),
    fetchBootstrapMapsWithCache(Date.now(), fetcher),
    fetchEventLivePointsWithCache(validEvent, Date.now(), fetcher),
  ]);

  if (picksResponse.status === 404) {
    throw new FplUpstreamError(
      404,
      'NOT_FOUND',
      `No Gameweek ${validEvent} picks found for this FPL manager ID (invalid ID or private team).`,
    );
  }

  if (!picksResponse.ok) {
    throw new FplUpstreamError(
      502,
      'UPSTREAM_UNAVAILABLE',
      `FPL picks endpoint returned HTTP ${picksResponse.status}`,
    );
  }

  const picksPayload = await picksResponse.json();
  const squad = assembleFplSquad({
    entryId: validEntryId,
    event: validEvent,
    picksPayload,
    bootstrapMaps,
    livePointsMap,
  });

  if (squad.startingXI.length === 0 && squad.bench.length === 0) {
    throw new FplUpstreamError(
      404,
      'NO_PICKS',
      `No Gameweek ${validEvent} picks recorded for this manager.`,
    );
  }

  return squad;
}

export async function getFplSquadWithCache(
  entryId,
  event = DEFAULT_FPL_EVENT,
  nowMs = Date.now(),
  loader = fetchFplSquadFromApi,
) {
  const validEntryId = validateEntryId(entryId);
  if (!validEntryId) {
    throw new FplUpstreamError(400, 'INVALID_ENTRY_ID', 'Invalid or missing FPL manager ID.');
  }

  const validEvent = validateEventId(event);
  if (!validEvent) {
    throw new FplUpstreamError(400, 'INVALID_EVENT', 'Invalid FPL gameweek.');
  }

  const cacheKey = `${validEntryId}:${validEvent}`;
  let entryCache = squadCaches.get(cacheKey);
  if (!entryCache) {
    entryCache = createTimedCache(FPL_SQUAD_CACHE_TTL_MS);
    squadCaches.set(cacheKey, entryCache);
  }

  return entryCache.get(nowMs, () => loader(validEntryId, validEvent));
}
