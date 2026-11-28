import {
  DEFAULT_FPL_EVENT,
  FplUpstreamError,
  aggregateAllTeamsPlayCounts,
  validateEventId,
} from '../lib/fpl.js';
import { CACHE_CONTROL_HEADER, CACHE_TTL_MS, createTimedCache } from '../lib/oneDrive.js';
import { getPlayersWithCache } from './players.js';

const teamCountsCaches = new Map();

export function resetTeamCountsCacheForTests() {
  teamCountsCaches.clear();
}

/**
 * @param {number | string} [eventId]
 * @param {number} [nowMs]
 * @param {(() => Promise<any>) | null} [loader]
 */
export async function getTeamCountsWithCache(
  eventId = DEFAULT_FPL_EVENT,
  nowMs = Date.now(),
  loader = null,
) {
  const validEvent = validateEventId(eventId, DEFAULT_FPL_EVENT);
  if (!validEvent) {
    throw new FplUpstreamError(400, 'INVALID_EVENT', 'Invalid FPL gameweek.');
  }

  let cache = teamCountsCaches.get(validEvent);
  if (!cache) {
    cache = createTimedCache(CACHE_TTL_MS);
    teamCountsCaches.set(validEvent, cache);
  }

  const resolvedLoader =
    loader ||
    (async () => {
      const playersResult = await getPlayersWithCache(nowMs);
      const players = playersResult?.payload?.players ?? [];
      const aggregated = await aggregateAllTeamsPlayCounts({
        players,
        event: validEvent,
        nowMs,
      });

      return {
        event: aggregated.event,
        teams: aggregated.teams,
        updatedAt: new Date().toISOString(),
      };
    });

  return cache.get(nowMs, resolvedLoader);
}

export async function handler(event) {
  const query = event?.queryStringParameters || {};
  const eventId = validateEventId(query.event, DEFAULT_FPL_EVENT);

  if (!eventId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        errorCode: 'INVALID_EVENT',
        error: 'Invalid FPL gameweek.',
      }),
    };
  }

  try {
    const { payload, cacheState } = await getTeamCountsWithCache(eventId);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': CACHE_CONTROL_HEADER,
        'X-Team-Counts-Cache': cacheState,
      },
      body: JSON.stringify(payload),
    };
  } catch (error) {
    const statusCode = error instanceof FplUpstreamError ? error.statusCode : 502;
    const errorCode = error instanceof FplUpstreamError ? error.errorCode : 'UPSTREAM_UNAVAILABLE';
    const message =
      error instanceof Error ? error.message : 'Failed to load aggregated team player counts.';

    console.error('[team-counts]', errorCode, message);

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        errorCode,
        error: message,
      }),
    };
  }
}
