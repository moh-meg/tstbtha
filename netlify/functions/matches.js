import {
  buildOneDriveDownloadCandidates as buildCandidates,
  CACHE_CONTROL_HEADER,
  CACHE_TTL_MS,
  cleanCellString,
  createTimedCache,
  encodeOneDriveShareId,
  fetchXlsxBufferFromOneDrive,
  isValidXlsxBuffer,
  parseCellScore,
  readFirstSheetRows,
  resolveConfiguredShareUrl,
} from '../lib/oneDrive.js';

export const DEFAULT_ONEDRIVE_SHARE_URL =
  'https://1drv.ms/x/c/13310541d7ff2949/IQCa819eDxX5RJBkUo6rcRrNAbXaYV5W9B98WTnFZfSSsew?e=LmocQi';

export {
  CACHE_CONTROL_HEADER,
  CACHE_TTL_MS,
  encodeOneDriveShareId,
  isValidXlsxBuffer,
  parseCellScore,
};

export function buildOneDriveDownloadCandidates(inputUrl = DEFAULT_ONEDRIVE_SHARE_URL) {
  return buildCandidates(inputUrl);
}

export function resolveOneDriveDownloadUrl(inputUrl = DEFAULT_ONEDRIVE_SHARE_URL) {
  return buildCandidates(inputUrl)[0];
}

function buildTeamInfo(name, fallbackId) {
  const trimmed = name.trim();
  return {
    id: fallbackId,
    name: trimmed,
    shortName: trimmed,
    logoUrl: `/logos/${encodeURIComponent(trimmed)}.png`,
    primaryColor: '#0038C7',
    secondaryColor: '#FFFFFF',
  };
}

export function parseExcelRowsToMatches(rows) {
  if (!Array.isArray(rows) || rows.length <= 1) {
    return [];
  }

  const matches = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const homeName = cleanCellString(row[0]);
    const homeScore = parseCellScore(row[1]);
    const awayScore = parseCellScore(row[2]);
    const awayName = cleanCellString(row[3]);
    const stageCell = cleanCellString(row[4]);

    if (!homeName && !awayName && homeScore === null && awayScore === null) {
      continue;
    }
    if (!homeName || !awayName) {
      continue;
    }

    const stage = stageCell ? stageCell.toUpperCase() : 'DEMI FINALE !!';
    const hasScores = homeScore !== null && awayScore !== null;

    matches.push({
      id: `match-${rowIndex}`,
      stage,
      homeTeam: buildTeamInfo(homeName, `home-${rowIndex}`),
      awayTeam: buildTeamInfo(awayName, `away-${rowIndex}`),
      homeScore,
      awayScore,
      status: hasScores ? 'finished' : 'upcoming',
    });
  }

  return matches;
}

async function fetchAndParseOneDriveMatches() {
  const targetUrl = resolveConfiguredShareUrl(
    process.env.ONEDRIVE_EXCEL_URL,
    DEFAULT_ONEDRIVE_SHARE_URL,
  );
  const buffer = await fetchXlsxBufferFromOneDrive(targetUrl);
  const rows = readFirstSheetRows(buffer);
  const matches = parseExcelRowsToMatches(rows);

  return {
    tournamentTitle: 'BATHA LEAGUE',
    matches,
    updatedAt: new Date().toISOString(),
  };
}

const matchesCache = createTimedCache(CACHE_TTL_MS);

export function resetMatchesCacheForTests() {
  matchesCache.reset();
}

export async function getMatchesWithCache(
  nowMs = Date.now(),
  loader = fetchAndParseOneDriveMatches,
) {
  return matchesCache.get(nowMs, loader);
}

export async function handler() {
  try {
    const { payload, cacheState } = await getMatchesWithCache();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': CACHE_CONTROL_HEADER,
        'X-Matches-Cache': cacheState,
      },
      body: JSON.stringify(payload),
    };
  } catch (error) {
    console.error('[matches]', error instanceof Error ? error.message : String(error));
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        error: 'Failed to load live match data from OneDrive',
      }),
    };
  }
}
