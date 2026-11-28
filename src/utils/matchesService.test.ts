import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  DEFAULT_FPL_EVENT,
  DEFAULT_MATCHES,
  aggregateTeamCountsFromSquads,
  applyExcelPointsToSquad,
  assembleFplSquadClient,
  buildFplBootstrapLookupClient,
  buildFplLivePointsMapClient,
  buildFplLiveStatsMapClient,
  buildFplPlayerPhotoCandidates,
  buildFplTeamCodeMapClient,
  buildFplTeamShortMapClient,
  buildTeamBadgeUrls,
  buildTeamFixtureLookupClient,
  computeSquadPlayCounts,
  fetchFplSquadData,
  fetchMatchesData,
  fetchPlayersData,
  fetchTeamCountsData,
  formatMatchScore,
  formatMatchStatusLabel,
  formatPlayerScore,
  getClubKitColors,
  getNextHeadshotCandidateIndex,
  getPlayerFallbackInitials,
  getPlayersForTeam,
  getTeamCountsForTeam,
  hasPkZipSignature,
  isArabicText,
  isValidFplEntryId,
  normalizeMatchesResponse,
  normalizeTeamCountsResponse,
  parsePlayersWorkbookRows,
  parseWorkbookRows,
  resetFplClientCachesForTests,
  resolveExcelManagerPoints,
  sumSquadPlayCountsList,
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
    '/custom-players/Haaland.png',
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
      '/custom-players/Signing.png',
      '/custom-players/signing.png',
      'https://resources.premierleague.com/premierleague/photos/players/250x250/p654321.png',
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
      '/custom-players/Haaland.png',
      '/custom-players/haaland.png',
      'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png',
      '/.netlify/functions/player-photo?code=223094&name=Erling%20Haaland&webName=Haaland&firstName=Erling&secondName=Haaland&team=Man%20City&teamCode=43',
    ],
  );
  // Diacritic/accent-normalized web_name generates exact, lowercase, normalized, normalized-lowercase .png only
  const dedicCandidates = buildFplPlayerPhotoCandidates(12345, null, {
    webName: 'Dedić',
    firstName: 'Amar',
    secondName: 'Dedić',
  });
  assert.equal(dedicCandidates[0], '/custom-players/Dedi%C4%87.png');
  assert.ok(dedicCandidates.includes('/custom-players/Dedic.png'));
  assert.ok(dedicCandidates.includes('/custom-players/dedic.png'));
  assert.equal(dedicCandidates.some((c) => /\.(jpg|jpeg|webp)$/i.test(c)), false);
  assert.ok(
    dedicCandidates.indexOf('/custom-players/dedic.png') <
      dedicCandidates.indexOf('https://resources.premierleague.com/premierleague/photos/players/250x250/p12345.png'),
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

  // Header points strictly from Excel (32), while player card points come from FPL livePointsMap (7 * 2 = 14)
  const squad = assembleFplSquadClient(
    '2249544',
    DEFAULT_FPL_EVENT,
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
    32,
  );

  assert.ok(squad);
  assert.equal(DEFAULT_FPL_EVENT, 12);
  assert.equal(squad.event, 12);
  assert.equal(squad.eventPoints, 32);
  assert.equal(squad.startingXI.length, 1);
  assert.equal(squad.bench.length, 2);
  assert.equal(squad.startingXI[0].code, 223094);
  assert.equal(squad.startingXI[0].photoUrl, '/custom-players/Raya.png');
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
  assert.equal(squad.bench[1].points, 0);
  assert.equal(
    squad.bench[1].photoUrl,
    '/custom-players/NoCode.png',
  );
  assert.deepEqual(squad.bench[1].photoUrls, [
    '/custom-players/NoCode.png',
    '/custom-players/nocode.png',
    '/.netlify/functions/player-photo?name=Jamie%20Gittens&webName=NoCode&firstName=Jamie&secondName=Gittens&team=Arsenal&teamCode=3',
  ]);
});

test('resolvePlayerHeadshotCandidates, getNextHeadshotCandidateIndex, getPlayerFallbackInitials, and getClubKitColors work cleanly', () => {
  const candidates = resolvePlayerHeadshotCandidates({
    photoUrls: [
      'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png',
      '/custom-players/Haaland.jpg',
      '/custom-players/Haaland.png',
    ],
    photoUrl: 'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png',
    code: 223094,
    fullName: 'Erling Haaland',
    webName: 'Haaland',
    firstName: 'Erling',
    secondName: 'Haaland',
    teamName: 'Man City',
    teamCode: 43,
  });

  assert.equal(candidates[0], '/custom-players/Haaland.png');
  assert.equal(candidates.some((c) => c.endsWith('.jpg')), false);
  assert.ok(
    candidates.indexOf('/custom-players/haaland.png') <
      candidates.indexOf('https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png'),
  );
  assert.equal(
    candidates[candidates.length - 1],
    '/.netlify/functions/player-photo?code=223094&name=Erling%20Haaland&webName=Haaland&firstName=Erling&secondName=Haaland&team=Man%20City&teamCode=43',
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

test('resolveExcelManagerPoints and applyExcelPointsToSquad strictly use Excel data and default missing values to 0', () => {
  const players = [
    { id: 'p1', teamName: 'اولاد زبانة', playerName: 'DR27 (cap)', playerId: '2249544', playerScore: 0 },
    { id: 'p2', teamName: 'بني مزاب', playerName: 'walid sabeur (cap)', playerId: '233289', playerScore: 44 },
    { id: 'p3', teamName: 'اولاد الدليل', playerName: 'Hassan Team', playerId: '60990', playerScore: null },
  ];

  assert.equal(resolveExcelManagerPoints({ entryId: '2249544', players }), 0);
  assert.equal(resolveExcelManagerPoints({ entryId: '233289', players }), 44);
  assert.equal(resolveExcelManagerPoints({ entryId: '60990', players }), 0);
  assert.equal(resolveExcelManagerPoints({ entryId: '999999', players }), 0);
  assert.equal(
    resolveExcelManagerPoints({
      entryId: 'unknown',
      selectedPlayer: { id: 'p2', teamName: 'بني مزاب', playerName: 'walid sabeur (cap)', playerId: '233289', playerScore: 44 },
      players,
    }),
    44,
  );
});

test('fetchFplSquadData calls /event/12/picks/ and /event/12/live/ for player cards while header points stay strictly from Excel', async () => {
  resetFplClientCachesForTests();

  const invalid = await fetchFplSquadData('-');
  assert.equal(invalid.source, 'error');
  assert.equal(invalid.errorCode, 'INVALID_ENTRY_ID');

  let calledLiveEndpoint = false;
  const directResult = await fetchFplSquadData(
    '2249544',
    DEFAULT_FPL_EVENT,
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
      if (url.includes('/entry/2249544/event/12/picks/')) {
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
      if (url.includes('/event/12/live/')) {
        calledLiveEndpoint = true;
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
    true,
    {
      selectedPlayer: {
        id: 'player-dr27',
        teamName: 'اولاد زبانة',
        playerName: 'DR27 (cap)',
        playerId: '2249544',
        playerScore: 0,
      },
    },
  );

  assert.equal(calledLiveEndpoint, true);
  assert.equal(directResult.source, 'direct');
  assert.ok(directResult.squad);
  assert.equal(directResult.squad.event, 12);
  // Header points strictly reflect Excel (0), NOT FPL entry_history.points (49)
  assert.equal(directResult.squad.eventPoints, 0);
  // Individual player cards use FPL event/12/live/ points
  assert.equal(directResult.squad.startingXI.length, 2);
  assert.equal(directResult.squad.startingXI[0].points, 6);
  assert.equal(directResult.squad.startingXI[1].webName, 'Saka');
  assert.equal(directResult.squad.startingXI[1].isCaptain, true);
  assert.equal(directResult.squad.startingXI[1].points, 18);
});

test('fetchFplSquadData falls back to entry 122 preview squad for GW12 with Excel header points and FPL live player points', async () => {
  resetFplClientCachesForTests();

  const previewResult = await fetchFplSquadData(
    '2249544',
    DEFAULT_FPL_EVENT,
    ['/.netlify/functions/fpl-squad'],
    async () => {
      throw new TypeError('Failed to fetch');
    },
    true,
    {
      selectedPlayer: {
        id: 'player-dr27',
        teamName: 'اولاد زبانة',
        playerName: 'DR27 (cap)',
        playerId: '2249544',
        playerScore: 27,
      },
    },
  );

  assert.equal(previewResult.source, 'preview-fallback');
  assert.ok(previewResult.previewNotice?.includes('الجولة 12'));
  assert.ok(previewResult.squad);
  assert.equal(previewResult.squad.event, 12);
  assert.equal(previewResult.squad.eventPoints, 27);
  assert.equal(previewResult.squad.startingXI.length, 11);
  assert.equal(previewResult.squad.bench.length, 4);
  const captain = previewResult.squad.startingXI.find((p) => p.elementId === 411);
  const zeroStarter = previewResult.squad.startingXI.find((p) => p.elementId === 366);
  const palmer = previewResult.squad.startingXI.find((p) => p.elementId === 15);
  const vice = previewResult.squad.startingXI.find((p) => p.elementId === 154);
  const rogers = previewResult.squad.bench.find((p) => p.elementId === 346);
  const watkins = previewResult.squad.bench.find((p) => p.elementId === 304);
  assert.equal(captain?.isCaptain, true);
  assert.equal(captain?.multiplier, 2);
  assert.equal(captain?.points, 12);
  assert.equal(captain?.hasStarted, true);
  assert.equal(captain?.fixtureStatus, 'live');
  assert.equal(zeroStarter?.points, 0);
  assert.equal(zeroStarter?.hasStarted, false);
  assert.equal(zeroStarter?.fixtureStatus, 'upcoming');
  assert.equal(zeroStarter?.opponentDisplay, 'AVL (H)');
  assert.equal(zeroStarter?.opponentShortName, 'AVL');
  assert.equal(zeroStarter?.opponentTeamCode, 7);
  assert.equal(palmer?.hasStarted, false);
  assert.equal(palmer?.opponentDisplay, 'AVL (H)');
  assert.equal(rogers?.hasStarted, false);
  assert.equal(rogers?.opponentDisplay, 'CHE (A)');
  assert.equal(rogers?.opponentShortName, 'CHE');
  assert.equal(rogers?.opponentTeamCode, 8);
  assert.equal(watkins?.hasStarted, false);
  assert.equal(watkins?.opponentDisplay, 'CHE (A)');
  assert.equal(vice?.isViceCaptain, true);
  assert.equal(vice?.hasStarted, true);
  assert.equal(vice?.fixtureStatus, 'finished');
  assert.deepEqual(
    previewResult.squad.bench.map((p) => p.elementId),
    [497, 31, 346, 304],
  );
  assert.equal(previewResult.squad.pointsOnBench, 8);
  const previewCounts = computeSquadPlayCounts(previewResult.squad);
  assert.deepEqual(previewCounts, {
    played: 6,
    playing: 4,
    remaining: 2,
    total: 12,
    isBenchBoost: false,
    isTripleCaptain: false,
  });
  const withMissingExcel = applyExcelPointsToSquad(previewResult.squad, { players: [] });
  assert.equal(withMissingExcel.eventPoints, 0);
  assert.equal(withMissingExcel.startingXI.find((p) => p.elementId === 411)?.points, 12);
});

test('fetchFplSquadData resolves GW12 opponents with (H)/(A) + badge codes for unplayed players and points for started/played players', async () => {
  resetFplClientCachesForTests();

  const rawBootstrap = {
    teams: [
      { id: 1, code: 3, short_name: 'ARS', name: 'Arsenal' },
      { id: 7, code: 8, short_name: 'CHE', name: 'Chelsea' },
      { id: 12, code: 14, short_name: 'LIV', name: 'Liverpool' },
      { id: 19, code: 21, short_name: 'WHU', name: 'West Ham' },
    ],
    elements: [
      { id: 10, code: 154561, web_name: 'Raya', element_type: 1, team: 1 },
      { id: 20, code: 244851, web_name: 'Palmer', element_type: 3, team: 7 },
      { id: 30, code: 118748, web_name: 'M.Salah', element_type: 3, team: 12 },
      { id: 40, code: 223340, web_name: 'Bowen', element_type: 3, team: 19 },
    ],
  };

  const result = await fetchFplSquadData(
    '2249544',
    DEFAULT_FPL_EVENT,
    ['/api/fpl-squad'],
    async (url) => {
      if (url.startsWith('/api/fpl-squad')) {
        return { ok: false, status: 404 };
      }
      if (url.includes('/entry/2249544/event/12/picks/')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              picks: [
                { element: 10, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false },
                { element: 20, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false },
                { element: 30, position: 3, multiplier: 1, is_captain: false, is_vice_captain: false },
                { element: 40, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false },
              ],
            }),
        };
      }
      if (url.includes('/bootstrap-static/')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify(rawBootstrap),
        };
      }
      if (url.includes('/event/12/live/')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify({
              elements: [
                { id: 10, stats: { total_points: 0, minutes: 0 } },
                { id: 20, stats: { total_points: 0, minutes: 0 } },
                { id: 30, stats: { total_points: 8, minutes: 90 } },
                { id: 40, stats: { total_points: 0, minutes: 0 } },
              ],
            }),
        };
      }
      if (url.includes('/fixtures/?event=12')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () =>
            JSON.stringify([
              // Kickoff in past (started & live even with 0 minutes)
              { team_h: 1, team_a: 12, started: false, finished: false, kickoff_time: '2020-11-22T15:00:00Z' },
              // Future fixture, unstarted
              { team_h: 12, team_a: 7, started: false, finished: false, kickoff_time: '2099-11-29T16:30:00Z' },
            ]),
        };
      }
      return { ok: false, status: 404 };
    },
    false,
    {
      selectedPlayer: {
        id: 'p1',
        teamName: 'اولاد زبانة',
        playerName: 'DR27 (cap)',
        playerId: '2249544',
        playerScore: 49,
      },
    },
  );

  assert.equal(result.source, 'direct');
  assert.ok(result.squad);
  assert.equal(result.squad.eventPoints, 49);
  // Raya (ARS): past kickoff_time -> hasStarted=true, shows 0 pts
  assert.equal(result.squad.startingXI[0].hasStarted, true);
  assert.equal(result.squad.startingXI[0].fixtureStatus, 'live');
  assert.equal(result.squad.startingXI[0].points, 0);
  // Palmer (CHE away @ LIV): future kickoff_time & 0 mins -> hasStarted=false, shows 'LIV (A)' with LIV code 14
  assert.equal(result.squad.startingXI[1].hasStarted, false);
  assert.equal(result.squad.startingXI[1].fixtureStatus, 'upcoming');
  assert.equal(result.squad.startingXI[1].opponentDisplay, 'LIV (A)');
  assert.equal(result.squad.startingXI[1].opponentTeamCode, 14);
  assert.deepEqual(buildTeamBadgeUrls(14), [
    'https://resources.premierleague.com/premierleague/badges/70/t14.png',
    'https://resources.premierleague.com/premierleague/badges/t14.png',
  ]);
  // Salah (LIV): minutes=90 > 0 -> hasStarted=true, shows 8 pts
  assert.equal(result.squad.startingXI[2].hasStarted, true);
  assert.equal(result.squad.startingXI[2].points, 8);
  // Bowen (WHU): no GW12 fixture -> hasStarted=false, shows 'BGW'
  assert.equal(result.squad.bench[0].hasStarted, false);
  assert.equal(result.squad.bench[0].opponentDisplay, 'BGW');

  const teamsMap = buildFplTeamShortMapClient(rawBootstrap);
  const teamCodesMap = buildFplTeamCodeMapClient(rawBootstrap);
  const liveStats = buildFplLiveStatsMapClient({ elements: [{ id: 10, stats: { total_points: 6, minutes: 90 } }] });
  assert.equal(liveStats.get(10)?.minutes, 90);
  assert.equal(teamsMap.get(7), 'CHE');
  assert.equal(teamCodesMap.get(7), 8);
  const dgwLookup = buildTeamFixtureLookupClient(
    [
      { team_h: 1, team_a: 7, started: true, finished: true, kickoff_time: '2020-01-01T00:00:00Z' },
      { team_h: 12, team_a: 1, started: false, kickoff_time: '2099-01-01T00:00:00Z' },
    ],
    teamsMap,
    Date.parse('2026-01-01T00:00:00Z'),
    teamCodesMap,
  );
  assert.equal(dgwLookup?.get(1)?.started, true);
  assert.equal(dgwLookup?.get(1)?.finished, false);
  assert.equal(dgwLookup?.get(1)?.fixtureStatus, 'live');
  assert.equal(dgwLookup?.get(1)?.opponentDisplay, 'CHE (H), LIV (A)');
});

test('computeSquadPlayCounts accounts for captain, Triple Captain (3xc -> 13), and Bench Boost (bboost -> 16/17)', () => {
  const makePlayer = (
    position: number,
    fixtureStatus: 'finished' | 'live' | 'upcoming',
    options: { isCaptain?: boolean; multiplier?: number } = {},
  ) => ({
    elementId: position,
    code: null,
    webName: `P${position}`,
    elementType: position === 1 || position === 12 ? 1 : 3,
    positionLabel: 'MID' as const,
    teamShortName: 'ARS',
    photoUrl: '',
    position,
    multiplier: options.multiplier ?? (position <= 11 ? 1 : 0),
    isCaptain: Boolean(options.isCaptain),
    isViceCaptain: false,
    fixtureStatus,
    hasStarted: fixtureStatus !== 'upcoming',
    points: 0,
  });

  const baseXI = [
    makePlayer(1, 'finished'),
    makePlayer(2, 'finished'),
    makePlayer(3, 'finished'),
    makePlayer(4, 'finished'),
    makePlayer(5, 'finished'),
    makePlayer(6, 'live'),
    makePlayer(7, 'live'),
    makePlayer(8, 'upcoming'),
    makePlayer(9, 'upcoming'),
    makePlayer(10, 'upcoming'),
    makePlayer(11, 'live', { isCaptain: true, multiplier: 2 }),
  ];
  const baseBench = [
    makePlayer(12, 'finished'),
    makePlayer(13, 'live'),
    makePlayer(14, 'upcoming'),
    makePlayer(15, 'upcoming'),
  ];

  // 1. Standard squad (no chip): 11 starters + 1 extra captain = 12
  assert.deepEqual(
    computeSquadPlayCounts({
      entryId: '1',
      event: 12,
      activeChip: null,
      eventPoints: 0,
      totalPoints: null,
      pointsOnBench: null,
      rank: null,
      startingXI: baseXI,
      bench: baseBench,
      updatedAt: '',
    }),
    { played: 5, playing: 4, remaining: 3, total: 12, isBenchBoost: false, isTripleCaptain: false },
  );

  // 2. Triple Captain (3xc): 11 starters + 2 extra captain = 13
  assert.deepEqual(
    computeSquadPlayCounts({
      entryId: '1',
      event: 12,
      activeChip: '3xc',
      eventPoints: 0,
      totalPoints: null,
      pointsOnBench: null,
      rank: null,
      startingXI: baseXI.map((p) => (p.isCaptain ? { ...p, multiplier: 3 } : p)),
      bench: baseBench,
      updatedAt: '',
    }),
    { played: 5, playing: 5, remaining: 3, total: 13, isBenchBoost: false, isTripleCaptain: true },
  );

  // 3. Bench Boost (bboost): 11 starters + 4 bench + 1 extra captain = 16
  assert.deepEqual(
    computeSquadPlayCounts({
      entryId: '1',
      event: 12,
      activeChip: 'bboost',
      eventPoints: 0,
      totalPoints: null,
      pointsOnBench: null,
      rank: null,
      startingXI: baseXI,
      bench: baseBench,
      updatedAt: '',
    }),
    { played: 6, playing: 5, remaining: 5, total: 16, isBenchBoost: true, isTripleCaptain: false },
  );

  // 4. Bench Boost + 3x multiplier edge case -> 17
  assert.deepEqual(
    computeSquadPlayCounts({
      entryId: '1',
      event: 12,
      activeChip: 'bb',
      eventPoints: 0,
      totalPoints: null,
      pointsOnBench: null,
      rank: null,
      startingXI: baseXI.map((p) => (p.isCaptain ? { ...p, multiplier: 3 } : p)),
      bench: baseBench,
      updatedAt: '',
    }),
    { played: 6, playing: 6, remaining: 5, total: 17, isBenchBoost: true, isTripleCaptain: false },
  );
});

test('aggregateTeamCountsFromSquads and fetchTeamCountsData aggregate counts per team cleanly', async () => {
  const players = [
    { id: 'p1', teamName: 'اولاد زبانة', playerName: 'Mgr 1', playerId: '1001', playerScore: 10 },
    { id: 'p2', teamName: 'اولاد زبانة', playerName: 'Mgr 2', playerId: '1002', playerScore: 12 },
    { id: 'p3', teamName: 'اولاد الدليل', playerName: 'Mgr 3', playerId: '2001', playerScore: 15 },
  ];

  // 1. Endpoint response path
  const apiResult = await fetchTeamCountsData(
    players,
    DEFAULT_FPL_EVENT,
    ['/.netlify/functions/team-counts'],
    async (url) => {
      assert.equal(url, '/.netlify/functions/team-counts?event=12');
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () =>
          JSON.stringify({
            event: 12,
            teams: {
              'اولاد زبانة': { total: 25, played: 11, playing: 7, remaining: 7 },
              'اولاد الدليل': { total: 16, played: 10, playing: 2, remaining: 4 },
            },
          }),
      };
    },
    false,
  );
  assert.equal(apiResult.source, 'api');
  assert.deepEqual(getTeamCountsForTeam(apiResult.teams, ' اولاد زبانة '), {
    total: 25,
    played: 11,
    playing: 7,
    remaining: 7,
  });
  assert.deepEqual(getTeamCountsForTeam(apiResult.teams, 'اولاد الدليل'), {
    total: 16,
    played: 10,
    playing: 2,
    remaining: 4,
  });
  assert.equal(normalizeTeamCountsResponse({ invalid: true }), null);

  // 2. Preview fallback sums across all team members cleanly when upstream is blocked
  const fallbackResult = await fetchTeamCountsData(
    players,
    DEFAULT_FPL_EVENT,
    ['/.netlify/functions/team-counts'],
    async () => {
      throw new TypeError('Blocked');
    },
    true,
  );
  assert.equal(fallbackResult.source, 'preview-fallback');
  // 2 members on اولاد زبانة -> 2 * { played: 6, playing: 4, remaining: 2, total: 12 }
  assert.deepEqual(getTeamCountsForTeam(fallbackResult.teams, 'اولاد زبانة'), {
    total: 24,
    played: 12,
    playing: 8,
    remaining: 4,
  });
  // 1 member on اولاد الدليل -> { played: 6, playing: 4, remaining: 2, total: 12 }
  assert.deepEqual(getTeamCountsForTeam(fallbackResult.teams, 'اولاد الدليل'), {
    total: 12,
    played: 6,
    playing: 4,
    remaining: 2,
  });

  // 3. Direct pure helper sanity
  assert.deepEqual(
    sumSquadPlayCountsList([
      { played: 5, playing: 4, remaining: 3, total: 12, isBenchBoost: false, isTripleCaptain: false },
      { played: 6, playing: 5, remaining: 5, total: 16, isBenchBoost: true, isTripleCaptain: false },
    ]),
    { total: 28, played: 11, playing: 9, remaining: 8 },
  );
  const emptyAgg = aggregateTeamCountsFromSquads(players, new Map());
  assert.deepEqual(emptyAgg['اولاد زبانة'], { total: 0, played: 0, playing: 0, remaining: 0 });
});


