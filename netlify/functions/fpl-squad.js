import {
  DEFAULT_FPL_EVENT,
  FPL_SQUAD_CACHE_CONTROL,
  FplUpstreamError,
  getFplSquadWithCache,
  validateEntryId,
  validateEventId,
} from '../lib/fpl.js';

export async function handler(event) {
  const query = event?.queryStringParameters || {};
  const entryId = validateEntryId(query.entryId);

  if (!entryId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        errorCode: 'INVALID_ENTRY_ID',
        error: 'Invalid or missing FPL manager ID.',
      }),
    };
  }

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
    const { payload, cacheState } = await getFplSquadWithCache(entryId, eventId);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': FPL_SQUAD_CACHE_CONTROL,
        'X-FPL-Squad-Cache': cacheState,
      },
      body: JSON.stringify(payload),
    };
  } catch (error) {
    const statusCode = error instanceof FplUpstreamError ? error.statusCode : 502;
    const errorCode = error instanceof FplUpstreamError ? error.errorCode : 'UPSTREAM_UNAVAILABLE';
    const message =
      error instanceof Error ? error.message : 'Failed to load Fantasy Premier League squad.';

    console.error('[fpl-squad]', errorCode, message);

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
