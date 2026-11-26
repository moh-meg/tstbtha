import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  DEFAULT_MATCHES,
  assembleFplSquadClient,
  buildFplBootstrapLookupClient,
  buildFplLivePointsMapClient,
  buildFplPlayerPhotoCandidates,
  fetchFplSquadData,
  fetchMatchesData,
  fetchPlayersData,
  formatMatchScore,
  formatMatchStatusLabel,
  formatPlayerScore,
  getClubKitColors,
  getNextHeadshotCandidateIndex,
  getPlayerFallbackInitials,
  getPlayersForTeam,
  hasPkZipSignature,
  isArabicText,
  isValidFplEntryId,
  normalizeMatchesResponse,
  parsePlayersWorkbookRows,
  parseWorkbookRows,
  resetFplClientCachesForTests,
  resolveFplPlayerPhotoUrl,
  resolvePlayerHeadshotCandidates,
  resolveTeamLogoUrl,
} from './matchesService';

test('resolveTeamLogoUrl encodes Arabic team names cleanly', () => {
  assert.equal(
    resolveTeamLogoUrl('  اولاد الدليل  '),
    `/logos/${encodeURIComponent('اولاد الدليل')}.png`,
  );
  assert.equal(
    resolveTeamLogoUrl('بني مزاب'),
    `/logos/${encodeURIComponent('بني مزاب')}.png`,
  );
});

test('formatMatchScore formats numeric scores including 0 and defaults upcoming matches to dash', () => {
  assert.equal(formatMatchScore(2, 1), '2 - 1');
  assert.equal(formatMatchScore(0, 0), '0 - 0');
  assert.equal(formatMatchScore(2, 0), '2 - 0');
  assert.equal(formatMatchScore(null, null), '-');
  assert.equal(formatMatchScore(2, null), '-');
  assert.equal(formatMatchScore(undefined, 1), '-');
});

test('DEFAULT_MATCHES include /logos/ asset paths', () => {
  for (const match of DEFAULT_MATCHES) {
    assert.ok(match.homeTeam.logoUrl?.startsWith('/logos/'));
    assert.ok(match.awayTeam.logoUrl?.startsWith('/logos/'));
  }
});

test('formatMatchStatusLabel formats live, finished, and upcoming states cleanly', () => {
  const base = DEFAULT_MATCHES[0];
  assert.equal(formatMatchStatusLabel(base), 'À VENIR');
  assert.equal(formatMatchStatusLabel({ ...base, kickoffTime: '20:00' }), '20:00');
  assert.equal(
    formatMatchStatusLabel({ ...base, status: 'live', kickoffTime: "68'" }),
    "EN DIRECT · 68'",
  );
  assert.equal(formatMatchStatusLabel({ ...base, status: 'finished' }), 'TERMINÉ');
});

test('normalizeMatchesResponse accepts both array and { matches } payloads', () => {
  const samplePayload = {
    matches: [
      {
        id: 'qf-1',
        stage: 'quart de finale',
        homeTeam: { id: 'a', name: 'Batha City', shortName: 'BTH' },
        awayTeam: { id: 'b', name: 'Raja North', shortName: 'RJN' },
        homeScore: 0,
        awayScore: 2,
        status: 'finished',
      },
    ],
  };

  const normalized = normalizeMatchesResponse(samplePayload);
  assert.ok(normalized);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].stage, 'QUART DE FINALE');
  assert.equal(normalized[0].homeScore, 0);
  assert.equal(normalized[0].awayScore, 2);

  assert.equal(normalizeMatchesResponse({ matches: [] }), null);
  assert.equal(normalizeMatchesResponse('invalid'), null);
});

test('parseWorkbookRows and hasPkZipSignature handle real Excel buffers and 0 scores', () => {
  const rows = [
    ['team 1', 'score 1', 'score 2', 'team 2'],
    ['اولاد زبانة ', 2, 0, 'اولاد الدليل'],
  ];
  const parsed = parseWorkbookRows(rows);
  assert.equal(parsed.length, 1);
  assert.equal(formatMatchScore(parsed[0].homeScore, parsed[0].awayScore), '2 - 0');

  assert.equal(hasPkZipSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), true);
  assert.equal(hasPkZipSignature(new Uint8Array([0x3c, 0x21, 0x64, 0x6f])), false);
});

test('fetchMatchesData falls back to browser OneDrive .xlsx when Netlify endpoint returns 404, then DEFAULT_MATCHES on failure', async () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['team 1', 'score 1', 'score 2', 'team 2'],
    ['اولاد زبانة ', 0, 0, 'اولاد الدليل'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const xlsxUint8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const excelFallbackResult = await fetchMatchesData(
    ['/.netlify/functions/matches'],
    async (url) => {
      if (url === '/.netlify/functions/matches') {
        return { ok: false };
      }
      return {
        ok: true,
        headers: { get: () => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        arrayBuffer: async () => xlsxUint8,
      };
    },
    ['https://onedrive.live.com/mock.xlsx'],
  );

  assert.equal(excelFallbackResult.source, 'api');
  assert.equal(excelFallbackResult.matches.length, 1);
  assert.equal(excelFallbackResult.matches[0].homeScore, 0);
  assert.equal(excelFallbackResult.matches[0].awayScore, 0);

  const fallbackResult = await fetchMatchesData(
    ['/broken'],
    async () => {
      throw new Error('Network unreachable');
    },
    [],
  );
  assert.equal(fallbackResult.source, 'fallback');
  assert.equal(fallbackResult.matches.length, DEFAULT_MATCHES.length);
});

test('parsePlayersWorkbookRows, getPlayersForTeam, formatPlayerScore, and isArabicText handle player data cleanly', () => {
  const rows = [
    ['team ', 'player name', 'id', 'points'],
    ['اولاد زبانة ', 'عفيف', 4347009, 0],
    ['اولاد زبانة ', 'DR27 (cap) ', 2249544, '49'],
    [null, null, null, null],
    ['اولاد الدليل', 'Hassan Team', 60990, null],
  ];

  const players = parsePlayersWorkbookRows(rows);
  assert.equal(players.length, 3);
  assert.equal(formatPlayerScore(players[0].playerScore), '0');
  assert.equal(formatPlayerScore(players[2].playerScore), '-');
  assert.equal(isArabicText(players[0].playerName), true);
  assert.equal(isArabicText(players[1].playerName), false);

  const zabanaPlayers = getPlayersForTeam(players, 'اولاد زبانة');
  assert.equal(zabanaPlayers.length, 2);
});

test('fetchPlayersData falls back to browser OneDrive .xlsx when /api/players returns 404', async () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['team ', 'player name', 'id', 'points'],
    ['بني مزاب ', 'walid sabeur (cap) ', 233289, '32'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const xlsxUint8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const result = await fetchPlayersData(
    ['/api/players'],
    async (url) => {
      if (url === '/api/players') {
        return { ok: false };
      }
      return {
        ok: true,
        headers: { get: () => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        arrayBuffer: async () => xlsxUint8,
      };
    },
    ['https://onedrive.live.com/mock-players.xlsx'],
  );

  assert.equal(result.source, 'api');
  assert.equal(result.players.length, 1);
  assert.equal(result.players[0].teamName, 'بني مزاب');
  assert.equal(result.players[0].playerScore, 32);
});

test('isValidFplEntryId, buildFplPlayerPhotoCandidates, and assembleFplSquadClient map FPL data and points cleanly', () => {
  assert.equal(isValidFplEntryId('2249544'), '2249544');
  assert.equal(isValidFplEntryId('-'), null);
  assert.equal(isValidFplEntryId('abc'), null);

  assert.equal(
    resolveFplPlayerPhotoUrl(223094, '223094.jpg', {
      fullName: 'Erling Haaland',
      webName: 'Haaland',
      firstName: 'Erling',
      secondName: 'Haaland',
      teamName: 'Man City',
      teamCode: 43,
    }),
    'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png',
  );
  assert.deepEqual(
    buildFplPlayerPhotoCandidates(null, '654321.jpg', {
      fullName: 'New Signing',
      webName: 'Signing',
      firstName: 'New',
      secondName: 'Signing',
      teamName: 'Arsenal',
      teamCode: 3,
    }),
    [
      'https://resources.premierleague.com/premierleague/photos/players/250x250/p654321.png',
      '/custom-players/Signing.png',
      '/custom-players/Signing.jpg',
      '/custom-players/Signing.jpeg',
      '/custom-players/Signing.webp',
      '/custom-players/signing.png',
      '/custom-players/New%20Signing.png',
      '/.netlify/functions/player-photo?code=654321&name=New%20Signing&webName=Signing&firstName=New&secondName=Signing&team=Arsenal&teamCode=3',
    ],
  );
  assert.deepEqual(
    buildFplPlayerPhotoCandidates(223094, '223094.jpg', {
      fullName: 'Erling Haaland',
      webName: 'Haaland',
      firstName: 'Erling',
      secondName: 'Haaland',
      teamName: 'Man City',
      teamCode: 43,
    }),
    [
      'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png',
      '/custom-players/Haaland.png',
      '/custom-players/Haaland.jpg',
      '/custom-players/Haaland.jpeg',
      '/custom-players/Haaland.webp',
      '/custom-players/haaland.png',
      '/custom-players/Erling%20Haaland.png',
      '/.netlify/functions/player-photo?code=223094&name=Erling%20Haaland&webName=Haaland&firstName=Erling&secondName=Haaland&team=Man%20City&teamCode=43',
    ],
  );
  assert.equal(
    resolveFplPlayerPhotoUrl(' p223094_cut.webp ', ''),
    'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png',
  );

  const lookup = buildFplBootstrapLookupClient({
    teams: [{ id: 1, code: 3, short_name: 'ARS', name: 'Arsenal' }],
    elements: [
      { id: 10, code: 223094, photo: '223094.jpg', first_name: 'David', second_name: 'Raya', web_name: 'Raya', element_type: 1, team: 1, team_code: 3 },
      { id: 20, code: 223340, photo: '223340.jpg', first_name: 'Bukayo', second_name: 'Saka', web_name: 'Saka', element_type: 3, team: 1 },
      { id: 99, code: null, photo: '', first_name: 'Jamie', second_name: 'Gittens', web_name: 'NoCode', element_type: 3, team: 1 },
    ],
  });

  const liveMap = buildFplLivePointsMapClient({
    elements: [
      { id: 10, stats: { total_points: 7 } },
      { id: 20, stats: { total_points: 0 } },
    ],
  });

  const squad = assembleFplSquadClient(
    '2249544',
    11,
    {
      entry_history: { points: 55, total_points: 600 },
      picks: [
        { element: 20, position: 12, multiplier: 0, is_captain: false, is_vice_captain: true },
        { element: 99, position: 13, multiplier: 0, is_captain: false, is_vice_captain: false },
        { element: 10, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false },
      ],
    },
    lookup,
    liveMap,
  );

  assert.ok(squad);
  assert.equal(squad.startingXI.length, 1);
  assert.equal(squad.bench.length, 2);
  assert.equal(squad.startingXI[0].code, 223094);
  assert.equal(squad.startingXI[0].photoUrl, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png');
  assert.equal(squad.startingXI[0].firstName, 'David');
  assert.equal(squad.startingXI[0].secondName, 'Raya');
  assert.equal(squad.startingXI[0].fullName, 'David Raya');
  assert.equal(squad.startingXI[0].teamName, 'Arsenal');
  assert.equal(squad.startingXI[0].teamCode, 3);
  assert.equal(squad.startingXI[0].isCaptain, true);
  assert.equal(squad.startingXI[0].points, 14);
  assert.equal(squad.bench[0].isViceCaptain, true);
  assert.equal(squad.bench[0].points, 0);
  assert.equal(squad.bench[1].elementId, 99);
  assert.equal(squad.bench[1].code, null);
  assert.equal(squad.bench[1].first_name, 'Jamie');
  assert.equal(squad.bench[1].second_name, 'Gittens');
  assert.equal(
    squad.bench[1].photoUrl,
    '/custom-players/NoCode.png',
  );
  assert.deepEqual(squad.bench[1].photoUrls, [
    '/custom-players/NoCode.png',
    '/custom-players/NoCode.jpg',
    '/custom-players/NoCode.jpeg',
    '/custom-players/NoCode.webp',
    '/custom-players/nocode.png',
    '/custom-players/Jamie%20Gittens.png',
    '/.netlify/functions/player-photo?name=Jamie%20Gittens&webName=NoCode&firstName=Jamie&secondName=Gittens&team=Arsenal&teamCode=3',
  ]);
});

test('resolvePlayerHeadshotCandidates, getNextHeadshotCandidateIndex, getPlayerFallbackInitials, and getClubKitColors work cleanly', () => {
  const candidates = resolvePlayerHeadshotCandidates({
    photoUrls: ['/.netlify/functions/player-photo?code=223094', '/custom-players/Haaland.png'],
    photoUrl: '/.netlify/functions/player-photo?code=223094',
    code: 223094,
    fullName: 'Erling Haaland',
    webName: 'Haaland',
    firstName: 'Erling',
    secondName: 'Haaland',
    teamName: 'Man City',
    teamCode: 43,
  });

  assert.equal(
    candidates[0],
    'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png',
  );
  assert.equal(candidates[1], '/custom-players/Haaland.png');
  assert.equal(
    candidates[candidates.length - 1],
    '/.netlify/functions/player-photo?code=223094',
  );

  let idx = 0;
  idx = getNextHeadshotCandidateIndex(idx, candidates.length);
  assert.equal(idx, 1);
  idx = candidates.length - 1;
  idx = getNextHeadshotCandidateIndex(idx, candidates.length);
  assert.equal(idx, candidates.length);
  // Calling past the end stays clamped at candidates.length (exhausted -> Step 5 club shirt + initials)
  idx = getNextHeadshotCandidateIndex(idx, candidates.length);
  assert.equal(idx, candidates.length);
  assert.equal(getNextHeadshotCandidateIndex(0, 0), 0);

  // Step 5: uppercase first letter of first_name + uppercase first letter of second_name
  assert.equal(
    getPlayerFallbackInitials({
      firstName: 'Jamie',
      secondName: 'Gittens',
      webName: 'Gittens',
    }),
    'JG',
  );
  assert.equal(
    getPlayerFallbackInitials({
      firstName: 'joško',
      secondName: 'gvardiol',
      webName: 'Gvardiol',
    }),
    'JG',
  );
  // Falls back to web_name initials when either name part is unavailable
  assert.equal(
    getPlayerFallbackInitials({
      firstName: '',
      secondName: '',
      webName: 'De Cuyper',
    }),
    'DC',
  );
  assert.equal(
    getPlayerFallbackInitials({
      firstName: 'Johan',
      secondName: '',
      webName: 'Manzambi',
    }),
    'MA',
  );

  assert.equal(getClubKitColors('CHE', 'Chelsea', 8).primary, '#034694');
  assert.equal(getClubKitColors('', 'Brighton & Hove Albion', 36).primary, '#0057B8');
  assert.equal(getClubKitColors('', '', 3).primary, '#EF0107');
});

test('fetchFplSquadData falls back to direct FPL API including /event/11/live/ and handles invalid IDs', async () => {
  resetFplClientCachesForTests();

  const invalid = await fetchFplSquadData('-');
  assert.equal(invalid.source, 'error');
  assert.equal(invalid.errorCode, 'INVALID_ENTRY_ID');

  const directResult = await fetchFplSquadData(
    '2249544',
    11,
    ['/api/fpl-squad'],
    async (url) => {
      if (url.startsWith('/api/fpl-squad')) {
        return {
          ok: false,
          status: 404,
          headers: { get: () => 'text/html' },
          text: async () => '<html>404</html>',
        };
      }
      if (url.includes('/entry/2249544/event/11/picks/')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              entry_history: { points: 49, total_points: 630 },
              picks: [
                { element: 10, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false },
                { element: 20, position: 10, multiplier: 2, is_captain: true, is_vice_captain: false },
              ],
            }),
        };
      }
      if (url.includes('/bootstrap-static/')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              teams: [{ id: 1, short_name: 'ARS' }],
              elements: [
                { id: 10, code: 223094, photo: '223094.jpg', web_name: 'Raya', element_type: 1, team: 1 },
                { id: 20, code: 223340, photo: '223340.jpg', web_name: 'Saka', element_type: 3, team: 1 },
              ],
            }),
        };
      }
      if (url.includes('/event/11/live/')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              elements: [
                { id: 10, stats: { total_points: 6 } },
                { id: 20, stats: { total_points: 9 } },
              ],
            }),
        };
      }
      return { ok: false, status: 404 };
    },
  );

  assert.equal(directResult.source, 'direct');
  assert.ok(directResult.squad);
  assert.equal(directResult.squad.startingXI.length, 2);
  assert.equal(directResult.squad.startingXI[0].points, 6);
  assert.equal(directResult.squad.startingXI[1].webName, 'Saka');
  assert.equal(directResult.squad.startingXI[1].isCaptain, true);
  assert.equal(directResult.squad.startingXI[1].points, 18);
});

test('fetchFplSquadData falls back to entry 122 preview squad with GW11 points when network/CORS blocks FPL', async () => {
  resetFplClientCachesForTests();

  const previewResult = await fetchFplSquadData(
    '122',
    11,
    ['/.netlify/functions/fpl-squad'],
    async () => {
      throw new TypeError('Failed to fetch');
    },
    true,
  );

  assert.equal(previewResult.source, 'preview-fallback');
  assert.ok(previewResult.previewNotice);
  assert.ok(previewResult.squad);
  assert.equal(previewResult.squad.startingXI.length, 11);
  assert.equal(previewResult.squad.bench.length, 4);
  const captain = previewResult.squad.startingXI.find((p) => p.elementId === 411);
  const zeroStarter = previewResult.squad.startingXI.find((p) => p.elementId === 366);
  const vice = previewResult.squad.startingXI.find((p) => p.elementId === 154);
  assert.equal(captain?.isCaptain, true);
  assert.equal(captain?.multiplier, 2);
  assert.equal(captain?.points, 12);
  assert.equal(zeroStarter?.points, 0);
  assert.equal(vice?.isViceCaptain, true);
  assert.deepEqual(
    previewResult.squad.bench.map((p) => p.elementId),
    [497, 31, 346, 304],
  );
  assert.equal(previewResult.squad.pointsOnBench, 9);
});


