import {
  getPlayerPhotoWithCache,
  PLAYER_PHOTO_CACHE_CONTROL,
  PLAYER_PHOTO_MISS_CACHE_CONTROL,
} from '../lib/playerPhoto.js';

export async function handler(event) {
  try {
    const query =
      event?.queryStringParameters && typeof event.queryStringParameters === 'object'
        ? event.queryStringParameters
        : {};

    const result = await getPlayerPhotoWithCache({
      code: query.code,
      photoCode: query.photoCode,
      name: query.name,
      webName: query.webName,
      firstName: query.firstName,
      secondName: query.secondName,
      team: query.team,
      teamCode: query.teamCode,
    });

    if (result.statusCode === 400) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          errorCode: 'INVALID_CODE',
          error: 'Invalid or missing player code or name.',
        }),
      };
    }

    if (!result || !result.ok) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': PLAYER_PHOTO_MISS_CACHE_CONTROL,
          'X-Player-Photo-Cache': result?.cacheState || 'MISS',
        },
        body: JSON.stringify({
          errorCode: 'PHOTO_NOT_FOUND',
          error:
            'Player photo not available from custom folder, Premier League CDN, official club sources, TheSportsDB, or Wikipedia.',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': result.contentType || 'image/png',
        'Cache-Control': result.cacheControl || PLAYER_PHOTO_CACHE_CONTROL,
        'X-Player-Photo-Cache': result.cacheState || 'MISS',
        ...(result.source ? { 'X-Player-Photo-Source': result.source } : {}),
        ...(typeof result.bgRemoved === 'boolean'
          ? { 'X-Player-Photo-Bg-Removed': String(result.bgRemoved) }
          : {}),
        ...(typeof result.resized250 === 'boolean'
          ? { 'X-Player-Photo-Resized-250': String(result.resized250) }
          : {}),
      },
      body: result.base64Body,
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('[player-photo]', error instanceof Error ? error.message : String(error));
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        errorCode: 'PHOTO_NOT_FOUND',
        error: 'Player photo lookup failed safely.',
      }),
    };
  }
}
