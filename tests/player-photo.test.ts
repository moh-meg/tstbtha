import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  buildTheSportsDbSearchQueries,
  buildUpstreamPhotoUrls,
  buildWikipediaSearchQueries,
  extractClubPortraitUrlFromHtml,
  extractWikipediaThumbnailUrl,
  fetchPlayerPhotoAsset,
  findCustomPlayerPhotoAsset,
  getPlayerPhotoWithCache,
  isAllowedExternalImageUrl,
  isFootballWikipediaPage,
  isValidImageBuffer,
  normalizeSearchText,
  PLAYER_PHOTO_CACHE_CONTROL,
  PLAYER_PHOTO_EXTERNAL_CACHE_CONTROL,
  removeBackgroundIfConfigured,
  resetPlayerPhotoCacheForTests,
  resizeImageTo250Png,
  resolveClubSourceConfig,
  selectBestSportsDbImageUrl,
  validatePlayerPhotoCode,
} from '../netlify/lib/playerPhoto.js';
import { handler } from '../netlify/functions/player-photo.js';

const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const ALT_PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0e,
]);

test('validatePlayerPhotoCode and isAllowedExternalImageUrl enforce strict input & SSRF allowlists', () => {
  assert.equal(validatePlayerPhotoCode('223094'), '223094');
  assert.equal(validatePlayerPhotoCode(' 97032 '), '97032');
  assert.equal(validatePlayerPhotoCode('0'), null);
  assert.equal(validatePlayerPhotoCode('../etc/passwd'), null);
  assert.equal(validatePlayerPhotoCode('https://evil.test/a.png'), null);
  assert.equal(validatePlayerPhotoCode(''), null);

  assert.equal(
    isAllowedExternalImageUrl('https://r2.thesportsdb.com/images/media/player/cutout/abc.png'),
    true,
  );
  assert.equal(
    isAllowedExternalImageUrl('https://upload.wikimedia.org/wikipedia/commons/a/ab/Player.jpg'),
    true,
  );
  assert.equal(
    isAllowedExternalImageUrl('https://res.cloudinary.com/chelsea-production/image/upload/palmer.png'),
    true,
  );
  assert.equal(
    isAllowedExternalImageUrl('https://assets.arsenal.com/prod/images/saka.webp'),
    true,
  );
  assert.equal(isAllowedExternalImageUrl('http://127.0.0.1/secret.png'), false);
  assert.equal(isAllowedExternalImageUrl('https://evil.example.com/x.png'), false);
});

test('normalizeSearchText and query builders normalize diacritics and build team-aware variants', () => {
  assert.equal(normalizeSearchText('  Joško   Gvardiol  '), 'Josko Gvardiol');
  assert.equal(normalizeSearchText('Sébastien Haller'), 'Sebastien Haller');
  assert.equal(normalizeSearchText('Ødegaard'), 'Odegaard');

  assert.deepEqual(
    buildTheSportsDbSearchQueries('Gabriel dos Santos Magalhães', 'Gabriel'),
    [
      'Gabriel dos Santos Magalhaes',
      'Gabriel dos Santos Magalhães',
      'Gabriel Magalhaes',
      'Gabriel',
    ],
  );

  assert.deepEqual(
    buildWikipediaSearchQueries('Johan Manzambi', 'Manzambi', 'Freiburg'),
    [
      'Johan Manzambi Freiburg football',
      'Johan Manzambi footballer',
      'Manzambi Freiburg football',
      'Manzambi footballer',
    ],
  );
});

test('Step 1: custom-players folder matches exact, case-insensitive, and accent-normalized .png web_name before any external request', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'custom-players-test-'));
  try {
    const validPng = await sharp({
      create: { width: 120, height: 120, channels: 4, background: { r: 220, g: 38, b: 38, alpha: 1 } },
    })
      .png()
      .toBuffer();

    await fs.writeFile(path.join(tmpDir, 'Manzambi.png'), validPng);
    await fs.writeFile(path.join(tmpDir, 'de cuyper.png'), validPng);
    await fs.writeFile(path.join(tmpDir, 'Odegaard.png'), validPng);
    await fs.writeFile(path.join(tmpDir, 'IgnoredJpg.jpg'), new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]));
    await fs.writeFile(path.join(tmpDir, 'IgnoredWebp.webp'), new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]));

    // Exact .png match
    const exact = await findCustomPlayerPhotoAsset({
      webName: 'Manzambi',
      customPlayersDirs: [tmpDir],
    });
    assert.ok(exact);
    assert.equal(exact.source, 'custom-folder');
    assert.equal(exact.contentType, 'image/png');

    // Case-insensitive .png match
    const ci = await findCustomPlayerPhotoAsset({
      webName: 'De Cuyper',
      customPlayersDirs: [tmpDir],
    });
    assert.ok(ci);
    assert.equal(ci.contentType, 'image/png');

    // Accent/diacritic-normalized .png match
    const norm = await findCustomPlayerPhotoAsset({
      webName: 'Ødegaard',
      customPlayersDirs: [tmpDir],
    });
    assert.ok(norm);
    assert.equal(norm.contentType, 'image/png');

    // Non-.png files (.jpg, .webp) are ignored in /custom-players/
    const ignoredJpg = await findCustomPlayerPhotoAsset({
      webName: 'IgnoredJpg',
      customPlayersDirs: [tmpDir],
    });
    assert.equal(ignoredJpg, null);

    const ignoredWebp = await findCustomPlayerPhotoAsset({
      webName: 'IgnoredWebp',
      customPlayersDirs: [tmpDir],
    });
    assert.equal(ignoredWebp, null);

    // Ensure fetchPlayerPhotoAsset checks Step 1 BEFORE any external request even when code is present
    let externalFetchCalled = false;
    const res = await fetchPlayerPhotoAsset(
      {
        code: '223094',
        webName: 'Manzambi',
        firstName: 'Johan',
        secondName: 'Manzambi',
        team: 'Freiburg',
        customPlayersDirs: [tmpDir],
      },
      null,
      async () => {
        externalFetchCalled = true;
        return { ok: false, status: 500 };
      },
    );

    assert.equal(externalFetchCalled, false);
    assert.equal(res.ok, true);
    if (res.ok && 'source' in res) {
      assert.equal(res.source, 'custom-folder');
      assert.equal(res.cacheControl, 'public, max-age=2592000, s-maxage=2592000');
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('Step 2: buildUpstreamPhotoUrls returns all 3 official Premier League endpoints in priority order', () => {
  assert.deepEqual(buildUpstreamPhotoUrls('97032', '123456'), [
    'https://resources.premierleague.com/premierleague/photos/players/250x250/p97032.png',
    'https://resources.premierleague.com/premierleague25/photos/players/250x250/p97032.png',
    'https://resources.premierleague.com/premierleague/photos/players/110x140/p97032.png',
    'https://resources.premierleague.com/premierleague/photos/players/250x250/p123456.png',
    'https://resources.premierleague.com/premierleague25/photos/players/250x250/p123456.png',
    'https://resources.premierleague.com/premierleague/photos/players/110x140/p123456.png',
  ]);
});

test('isValidImageBuffer checks PNG/JPEG/WEBP signatures and content types', () => {
  assert.equal(isValidImageBuffer(PNG_HEADER, 'image/png'), true);
  assert.equal(
    isValidImageBuffer(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0, 0, 0, 0, 0, 0]), 'text/html'),
    false,
  );
});

test('Step 3: resolveClubSourceConfig and extractClubPortraitUrlFromHtml support official club sources', () => {
  const chelsea = resolveClubSourceConfig('Chelsea', 8);
  assert.equal(chelsea?.key, 'chelsea');
  assert.equal(resolveClubSourceConfig('', 3)?.key, 'arsenal');
  assert.equal(resolveClubSourceConfig('Brighton & Hove Albion', null)?.key, 'brighton');
  assert.equal(resolveClubSourceConfig('Spurs', null)?.key, 'tottenham');
  assert.equal(resolveClubSourceConfig('Aston Villa', null)?.key, 'aston-villa');

  const html = `
    <html>
      <head>
        <meta property="og:image" content="https://res.cloudinary.com/chelsea-production/image/upload/c_fit,h_630,w_1200/Palmer.png" />
      </head>
    </html>
  `;
  const portrait = extractClubPortraitUrlFromHtml(
    html,
    'https://www.chelseafc.com',
    chelsea,
    ['cole-palmer', 'palmer'],
  );
  assert.equal(
    portrait,
    'https://res.cloudinary.com/chelsea-production/image/upload/c_fit,h_630,w_1200/Palmer.png',
  );

  // Rejects generic share cards
  const genericHtml = `<meta property="og:image" content="https://www.tottenhamhotspur.com/resources/assets/thfc/share-card.png" />`;
  assert.equal(
    extractClubPortraitUrlFromHtml(genericHtml, 'https://www.tottenhamhotspur.com', chelsea, ['son']),
    null,
  );
});

test('resizeImageTo250Png resizes real images to exact 250x250 PNG and falls back safely if sharp is unavailable', async () => {
  const inputPng = await sharp({
    create: { width: 400, height: 300, channels: 4, background: { r: 0, g: 100, b: 200, alpha: 1 } },
  })
    .jpeg()
    .toBuffer();

  const resized = await resizeImageTo250Png({
    ok: true,
    statusCode: 200,
    contentType: 'image/jpeg',
    bytes: new Uint8Array(inputPng),
    base64Body: inputPng.toString('base64'),
  });

  assert.equal(resized.resized250, true);
  assert.equal(resized.contentType, 'image/png');
  assert.ok(resized.bytes);
  const meta = await sharp(Buffer.from(resized.bytes)).metadata();
  assert.equal(meta.width, 250);
  assert.equal(meta.height, 250);
  assert.equal(meta.format, 'png');

  // Safe fallback when sharp is null (not installed)
  const fallback = await resizeImageTo250Png(
    {
      ok: true,
      statusCode: 200,
      contentType: 'image/png',
      bytes: PNG_HEADER,
      base64Body: Buffer.from(PNG_HEADER).toString('base64'),
    },
    null,
  );
  assert.equal(fallback.resized250, false);
  assert.equal(fallback.base64Body, Buffer.from(PNG_HEADER).toString('base64'));
});

test('selectBestSportsDbImageUrl prefers soccer players, matching team, and strCutout over strThumb', () => {
  const best = selectBestSportsDbImageUrl(
    [
      {
        strPlayer: 'Erling Haaland',
        strSport: 'Basketball',
        strTeam: 'Lakers',
        strCutout: 'https://r2.thesportsdb.com/images/media/player/cutout/wrong-sport.png',
      },
      {
        strPlayer: 'Erling Haaland',
        strSport: 'Soccer',
        strTeam: 'Borussia Dortmund',
        strThumb: 'https://r2.thesportsdb.com/images/media/player/thumb/old-team.jpg',
      },
      {
        strPlayer: 'Erling Haaland',
        strSport: 'Soccer',
        strTeam: 'Manchester City',
        strCutout: 'https://r2.thesportsdb.com/images/media/player/cutout/haaland.png',
        strThumb: 'https://r2.thesportsdb.com/images/media/player/thumb/haaland.jpg',
      },
    ],
    'Erling Haaland',
    'Haaland',
    'Man City',
  );
  assert.equal(best, 'https://r2.thesportsdb.com/images/media/player/cutout/haaland.png');

  assert.equal(
    selectBestSportsDbImageUrl(
      [
        {
          strPlayer: 'Different Player',
          strSport: 'Soccer',
          strTeam: 'Freiburg',
          strCutout: 'https://r2.thesportsdb.com/images/media/player/cutout/wrong.png',
        },
      ],
      'Johan Manzambi',
      'Manzambi',
      'Freiburg',
    ),
    null,
  );
});

test('isFootballWikipediaPage and extractWikipediaThumbnailUrl filter out non-football articles', () => {
  assert.equal(
    isFootballWikipediaPage(
      {
        title: 'Johan Manzambi',
        extract: 'Johan Manzambi is a Swiss professional footballer who plays as a midfielder for SC Freiburg.',
      },
      'Johan Manzambi',
      'Manzambi',
      'Freiburg',
    ),
    true,
  );

  assert.equal(
    isFootballWikipediaPage(
      {
        title: 'Manzambi (film)',
        extract: 'Manzambi is a 1998 documentary film directed in Kinshasa.',
      },
      'Johan Manzambi',
      'Manzambi',
      'Freiburg',
    ),
    false,
  );

  assert.equal(
    extractWikipediaThumbnailUrl(
      {
        query: {
          pages: {
            '1': {
              index: 0,
              title: 'Manzambi (village)',
              extract: 'Manzambi is a village in Central Africa.',
              thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/village.jpg' },
            },
            '2': {
              index: 1,
              title: 'Johan Manzambi',
              extract: 'Johan Manzambi is a professional footballer who plays for SC Freiburg.',
              thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/manzambi.jpg' },
            },
          },
        },
      },
      'Johan Manzambi',
      'Manzambi',
      'Freiburg',
    ),
    'https://upload.wikimedia.org/wikipedia/commons/manzambi.jpg',
  );
});

test('fetchPlayerPhotoAsset follows 5-step priority: Custom -> PL -> Official Club (bg+250x250) -> TheSportsDB/Wiki (bg+250x250) -> 404', async () => {
  const emptyCustomDir = await fs.mkdtemp(path.join(os.tmpdir(), 'custom-empty-'));

  try {
    // Step 2: PL endpoints (tries premierleague/250x250 -> premierleague25/250x250 -> premierleague/110x140) and skips remove.bg
    let removeBgCalled = false;
    const plUrlsAttempted: string[] = [];
    const plRes = await fetchPlayerPhotoAsset(
      { code: '97032', removeBgApiKey: 'test-remove-bg-key', customPlayersDirs: [emptyCustomDir] },
      null,
      async (url) => {
        plUrlsAttempted.push(url);
        if (url.includes('api.remove.bg')) {
          removeBgCalled = true;
        }
        if (url.includes('/premierleague/photos/players/250x250/') || url.includes('/premierleague25/')) {
          return { ok: false, status: 403 };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'image/png' },
          arrayBuffer: async () => PNG_HEADER.buffer,
        };
      },
    );
    assert.equal(plUrlsAttempted.length, 3);
    assert.equal(removeBgCalled, false);
    assert.equal(plRes.ok, true);
    if (plRes.ok && 'source' in plRes) {
      assert.equal(plRes.source, 'premierleague');
      assert.equal(plRes.cacheControl, 'public, max-age=2592000, s-maxage=2592000');
    }

    // Step 3: PL fails -> Official Club Source succeeds, removes background AND resizes to exact 250x250 PNG
    const clubSourceInput = await sharp({
      create: { width: 500, height: 320, channels: 4, background: { r: 3, g: 70, b: 148, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const clubBgRemoved = await sharp({
      create: { width: 420, height: 300, channels: 4, background: { r: 3, g: 70, b: 148, alpha: 1 } },
    })
      .png()
      .toBuffer();

    let clubRemoveBgCalled = false;
    const clubRes = await fetchPlayerPhotoAsset(
      {
        code: '999999',
        firstName: 'Estevao',
        secondName: 'Willian',
        webName: 'Estêvão',
        team: 'Chelsea',
        teamCode: 8,
        removeBgApiKey: 'secret-bg-key',
        customPlayersDirs: [emptyCustomDir],
      },
      null,
      async (url) => {
        if (url.startsWith('https://www.chelseafc.com/en/teams/profile/')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'text/html' },
            text: async () =>
              `<meta property="og:image" content="https://res.cloudinary.com/chelsea-production/image/upload/estevao.png" />`,
          };
        }
        if (url === 'https://res.cloudinary.com/chelsea-production/image/upload/estevao.png') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'image/png' },
            arrayBuffer: async () => clubSourceInput.buffer.slice(clubSourceInput.byteOffset, clubSourceInput.byteOffset + clubSourceInput.byteLength),
          };
        }
        if (url === 'https://api.remove.bg/v1.0/removebg') {
          clubRemoveBgCalled = true;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'image/png' },
            arrayBuffer: async () => clubBgRemoved.buffer.slice(clubBgRemoved.byteOffset, clubBgRemoved.byteOffset + clubBgRemoved.byteLength),
          };
        }
        return { ok: false, status: 404 };
      },
    );
    assert.equal(clubRemoveBgCalled, true);
    assert.equal(clubRes.ok, true);
    if (clubRes.ok && 'source' in clubRes) {
      assert.equal(clubRes.source, 'official-club');
      assert.equal(clubRes.bgRemoved, true);
      assert.equal(clubRes.resized250, true);
      assert.equal(clubRes.contentType, 'image/png');
      assert.equal(clubRes.cacheControl, 'public, max-age=2592000, s-maxage=2592000');
      assert.ok(clubRes.base64Body);
      const clubMeta = await sharp(Buffer.from(clubRes.base64Body, 'base64')).metadata();
      assert.equal(clubMeta.width, 250);
      assert.equal(clubMeta.height, 250);
    }

    // Step 4a: PL & Club fail -> TheSportsDB succeeds and runs remove.bg + 250x250 resize
    let sawRemoveBgKey = '';
    const sportsDbRes = await fetchPlayerPhotoAsset(
      {
        code: '999999',
        firstName: 'Johan',
        secondName: 'Manzambi',
        webName: 'Manzambi',
        team: 'Freiburg',
        removeBgApiKey: 'secret-bg-key',
        customPlayersDirs: [emptyCustomDir],
      },
      null,
      async (url, init) => {
        if (url.includes('thesportsdb.com/api/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              player: [
                {
                  strPlayer: 'Johan Manzambi',
                  strSport: 'Soccer',
                  strTeam: 'SC Freiburg',
                  strThumb: 'https://r2.thesportsdb.com/images/media/player/thumb/manzambi.png',
                },
              ],
            }),
          };
        }
        if (url === 'https://r2.thesportsdb.com/images/media/player/thumb/manzambi.png') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'image/png' },
            arrayBuffer: async () => PNG_HEADER.buffer,
          };
        }
        if (url === 'https://api.remove.bg/v1.0/removebg') {
          const headers = (init?.headers ?? {}) as Record<string, string>;
          sawRemoveBgKey = headers['X-Api-Key'] ?? '';
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'image/png' },
            arrayBuffer: async () => ALT_PNG_HEADER.buffer,
          };
        }
        return { ok: false, status: 404 };
      },
    );
    assert.equal(sawRemoveBgKey, 'secret-bg-key');
    assert.equal(sportsDbRes.ok, true);
    if (sportsDbRes.ok && 'source' in sportsDbRes) {
      assert.equal(sportsDbRes.source, 'thesportsdb');
      assert.equal(sportsDbRes.bgRemoved, true);
      assert.equal(sportsDbRes.cacheControl, 'public, max-age=2592000, s-maxage=2592000');
      assert.equal(sportsDbRes.base64Body, Buffer.from(ALT_PNG_HEADER).toString('base64'));
    }

    // Step 4b: PL, Club & TheSportsDB fail -> Wikipedia succeeds and degrades gracefully when remove.bg rate-limits (429)
    const wikiRes = await fetchPlayerPhotoAsset(
      {
        code: '999999',
        firstName: 'Academy',
        secondName: 'Prospect',
        webName: 'Prospect',
        team: 'Chelsea',
        removeBgApiKey: 'secret-bg-key',
        customPlayersDirs: [emptyCustomDir],
      },
      null,
      async (url) => {
        if (url.includes('thesportsdb.com/api/')) {
          return { ok: true, status: 200, json: async () => ({ player: null }) };
        }
        if (url.includes('en.wikipedia.org/w/api.php')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              query: {
                pages: {
                  '99': {
                    title: 'Academy Prospect',
                    extract: 'Academy Prospect is an English footballer who plays for Chelsea.',
                    thumbnail: {
                      source: 'https://upload.wikimedia.org/wikipedia/commons/prospect.png',
                    },
                  },
                },
              },
            }),
          };
        }
        if (url === 'https://upload.wikimedia.org/wikipedia/commons/prospect.png') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'image/png' },
            arrayBuffer: async () => PNG_HEADER.buffer,
          };
        }
        if (url === 'https://api.remove.bg/v1.0/removebg') {
          return { ok: false, status: 429 };
        }
        return { ok: false, status: 403 };
      },
    );
    assert.equal(wikiRes.ok, true);
    if (wikiRes.ok && 'source' in wikiRes) {
      assert.equal(wikiRes.source, 'wikipedia');
      assert.equal(wikiRes.bgRemoved, false);
      assert.equal(wikiRes.base64Body, Buffer.from(PNG_HEADER).toString('base64'));
      assert.equal(wikiRes.cacheControl, 'public, max-age=2592000, s-maxage=2592000');
    }

    // Step 5 trigger: All 4 server steps fail -> 404 so UI renders Club Shirt + Initials
    const missing = await fetchPlayerPhotoAsset(
      { code: '9999999', name: 'Unknown Player', customPlayersDirs: [emptyCustomDir] },
      null,
      async () => ({ ok: false, status: 404 }),
    );
    assert.equal(missing.ok, false);
    assert.equal(missing.statusCode, 404);
  } finally {
    await fs.rm(emptyCustomDir, { recursive: true, force: true });
  }
});

test('removeBackgroundIfConfigured skips cleanly when key is omitted', async () => {
  let called = false;
  const result = await removeBackgroundIfConfigured(
    {
      ok: true,
      statusCode: 200,
      contentType: 'image/png',
      bytes: PNG_HEADER,
      base64Body: Buffer.from(PNG_HEADER).toString('base64'),
    },
    '',
    async () => {
      called = true;
      return { ok: false, status: 500 };
    },
  );
  assert.equal(called, false);
  assert.equal(result.bgRemoved, false);
  assert.equal(result.base64Body, Buffer.from(PNG_HEADER).toString('base64'));
});

test('getPlayerPhotoWithCache caches with 30-day Cache-Control, coalesces concurrent calls, and handler rejects bad input with 400', async () => {
  resetPlayerPhotoCacheForTests();
  let calls = 0;

  const mockFetch = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 10));
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => PNG_HEADER.buffer,
    };
  };

  const [first, concurrent] = await Promise.all([
    getPlayerPhotoWithCache({ code: '223094', name: 'Erling Haaland' }, null, 1_000_000, mockFetch),
    getPlayerPhotoWithCache({ code: '223094', name: 'Erling Haaland' }, null, 1_000_005, mockFetch),
  ]);
  const second = await getPlayerPhotoWithCache({ code: '223094', name: 'Erling Haaland' }, null, 1_010_000, mockFetch);

  assert.equal(calls, 1);
  assert.equal(first.cacheState, 'MISS');
  assert.equal(concurrent.cacheState, 'MISS');
  assert.equal(second.cacheState, 'HIT');
  assert.equal(PLAYER_PHOTO_CACHE_CONTROL, 'public, max-age=2592000, s-maxage=2592000');
  assert.equal(PLAYER_PHOTO_EXTERNAL_CACHE_CONTROL, 'public, max-age=2592000, s-maxage=2592000');

  const badRes = await handler({ queryStringParameters: { code: 'bad-id' } });
  assert.equal(badRes.statusCode, 400);

  // Crash-proof: throwing sharp override and throwing external fetcher must still resolve cleanly without throwing
  const emptyCustomDir = await fs.mkdtemp(path.join(os.tmpdir(), 'custom-crashproof-'));
  try {
    const throwingSharpRes = await fetchPlayerPhotoAsset(
      {
        code: '9999999',
        firstName: 'Test',
        secondName: 'Crashproof',
        webName: 'Crashproof',
        team: 'Chelsea',
        teamCode: 8,
        removeBgApiKey: 'test-key',
        customPlayersDirs: [emptyCustomDir],
        sharp: () => {
          throw new Error('sharp binary missing');
        },
      },
      null,
      async (url) => {
        if (url.includes('chelseafc.com')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'text/html' },
            text: async () =>
              `<meta property="og:image" content="https://res.cloudinary.com/chelsea-production/image/upload/crashproof.png" />`,
          };
        }
        if (url === 'https://res.cloudinary.com/chelsea-production/image/upload/crashproof.png') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'image/png' },
            arrayBuffer: async () => PNG_HEADER.buffer,
          };
        }
        throw new Error('network down');
      },
    );
    assert.equal(throwingSharpRes.ok, true);
    assert.equal(throwingSharpRes.resized250, false);
    assert.equal(throwingSharpRes.bgRemoved, false);

    // When all external APIs throw, handler returns clean 404 JSON
    resetPlayerPhotoCacheForTests();
    const notFoundHandlerRes = await handler({
      queryStringParameters: { code: '999999999', webName: 'NoSuchPlayerXYZ' },
    });
    assert.equal(notFoundHandlerRes.statusCode, 404);
    const notFoundBody = JSON.parse(notFoundHandlerRes.body);
    assert.equal(notFoundBody.errorCode, 'PHOTO_NOT_FOUND');
  } finally {
    await fs.rm(emptyCustomDir, { recursive: true, force: true });
  }
});
