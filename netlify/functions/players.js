import {
  buildOneDriveDownloadCandidates as buildCandidates,
  CACHE_CONTROL_HEADER,
  CACHE_TTL_MS,
  cleanCellString,
  createTimedCache,
  fetchXlsxBufferFromOneDrive,
  parseCellScore,
  readFirstSheetRows,
  resolveConfiguredShareUrl,
} from '../lib/oneDrive.js';

export const DEFAULT_PLAYERS_ONEDRIVE_SHARE_URL =
  'https://1drv.ms/x/c/13310541d7ff2949/IQDbxALpCCljSKuq_WSgqScrAd0gdiRKpUUexj05jBe1WTg?e=FM0OQZ';

export { CACHE_CONTROL_HEADER, CACHE_TTL_MS };

export function resolvePlayersDownloadUrl(inputUrl = DEFAULT_PLAYERS_ONEDRIVE_SHARE_URL) {
  return buildCandidates(inputUrl)[0];
}

export function parseExcelRowsToPlayers(rows) {
  if (!Array.isArray(rows) || rows.length <= 1) {
    return [];
  }

  const players = [];

  // Start from Row 2 (index 1) — ignore Row 1 headers
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const teamName = cleanCellString(row[0]);
    const playerName = cleanCellString(row[1]);
    const playerId = cleanCellString(row[2]);
    const playerScore = parseCellScore(row[3]);

    // Skip completely empty rows or rows without team/player names
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

async function fetchAndParseOneDrivePlayers() {
  const targetUrl = resolveConfiguredShareUrl(
    process.env.ONEDRIVE_PLAYERS_EXCEL_URL,
    DEFAULT_PLAYERS_ONEDRIVE_SHARE_URL,
  );
  const buffer = await fetchXlsxBufferFromOneDrive(targetUrl);
  const rows = readFirstSheetRows(buffer);
  const players = parseExcelRowsToPlayers(rows);

  return {
    tournamentTitle: 'BATHA LEAGUE',
    players,
    updatedAt: new Date().toISOString(),
  };
}

const playersCache = createTimedCache(CACHE_TTL_MS);

export function resetPlayersCacheForTests() {
  playersCache.reset();
}

export async function getPlayersWithCache(
  nowMs = Date.now(),
  loader = fetchAndParseOneDrivePlayers,
) {
  return playersCache.get(nowMs, loader);
}

export async function handler() {
  try {
    const { payload, cacheState } = await getPlayersWithCache();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': CACHE_CONTROL_HEADER,
        'X-Players-Cache': cacheState,
      },
      body: JSON.stringify(payload),
    };
  } catch (error) {
    console.error('[players]', error instanceof Error ? error.message : String(error));
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        error: 'Failed to load player scores from OneDrive',
      }),
    };
  }
}
