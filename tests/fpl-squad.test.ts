import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleFplSquad,
  buildBootstrapMaps,
  buildLivePointsMap,
  buildPlayerPhotoCandidates,
  FplUpstreamError,
  getFplSquadWithCache,
  resetFplCachesForTests,
  resolvePlayerPhotoUrl,
  validateEntryId,
  validateEventId,
} from '../netlify/lib/fpl.js';
import { handler, resolveExcelPointsForEntry } from '../netlify/functions/fpl-squad.js';

test('validateEntryId accepts numeric manager IDs and rejects invalid inputs', () => {
  assert.equal(validateEntryId('2249544'), '2249544');
  assert.equal(validateEntryId(' 84817 '), '84817');
  assert.equal(validateEntryId('-'), null);
  assert.equal(validateEntryId('0'), null);
  assert.equal(validateEntryId('123abc'), null);
  assert.equal(validateEntryId('../admin'), null);
  assert.equal(validateEntryId('https://evil.test'), null);
  assert.equal(validateEventId(undefined), 12);
  assert.equal(validateEventId('12'), 12);
  assert.equal(validateEventId('39'), null);
});

test('buildPlayerPhotoCandidates and resolvePlayerPhotoUrl prioritize local /custom-players/ first, then Premier League CDN and proxy fallback', () => {
  assert.equal(
    resolvePlayerPhotoUrl(223094, '223094.jpg', {
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
    buildPlayerPhotoCandidates(223094, '654321.jpg', {
      fullName: 'Erling Haaland',
      webName: 'Haaland',
      firstName: 'Erling',
      secondName: 'Haaland',
      teamName: 'Man City',
      teamCode: 43,
    }),
    [
      '/custom-players/Haaland.png',
      '/custom-players/Haaland.jpg',
      '/custom-players/Haaland.jpeg',
      '/custom-players/Haaland.webp',
      '/custom-players/haaland.png',
      '/custom-players/haaland.jpg',
      '/custom-players/haaland.jpeg',
      '/custom-players/haaland.webp',
      'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png',
      'https://resources.premierleague.com/premierleague/photos/players/250x250/p654321.png',
      '/.netlify/functions/player-photo?code=223094&photoCode=654321&name=Erling%20Haaland&webName=Haaland&firstName=Erling&secondName=Haaland&team=Man%20City&teamCode=43',
    ],
  );
  assert.deepEqual(buildPlayerPhotoCandidates(null, '123456.jpg'), [
    'https://resources.premierleague.com/premierleague/photos/players/250x250/p123456.png',
    '/.netlify/functions/player-photo?code=123456',
  ]);
  assert.deepEqual(
    buildPlayerPhotoCandidates(null, '', {
      fullName: 'New Signing',
      webName: 'Signing',
      firstName: 'New',
      secondName: 'Signing',
      teamName: 'Arsenal',
      teamCode: 3,
    }),
    [
      '/custom-players/Signing.png',
      '/custom-players/Signing.jpg',
      '/custom-players/Signing.jpeg',
      '/custom-players/Signing.webp',
      '/custom-players/signing.png',
      '/custom-players/signing.jpg',
      '/custom-players/signing.jpeg',
      '/custom-players/signing.webp',
      '/.netlify/functions/player-photo?name=New%20Signing&webName=Signing&firstName=New&secondName=Signing&team=Arsenal&teamCode=3',
    ],
  );
  assert.equal(
    resolvePlayerPhotoUrl(' p223094-alt.webp ', ''),
    'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png',
  );
  assert.equal(resolvePlayerPhotoUrl(null, ''), '');
});

test('assembleFplSquad maps picks + bootstrap-static + live GW12 player points while keeping eventPoints from Excel', () => {
  const bootstrapMaps = buildBootstrapMaps({
    teams: [
      { id: 1, code: 3, short_name: 'ARS', name: 'Arsenal' },
      { id: 12, code: 14, short_name: 'LIV', name: 'Liverpool' },
    ],
    elements: [
      { id: 10, code: 223094, photo: '223094.jpg', first_name: 'David', second_name: 'Raya', web_name: 'Raya', element_type: 1, team: 1, team_code: 3 },
      { id: 20, code: 118748, photo: '118748.jpg', first_name: 'Mohamed', second_name: 'Salah', web_name: 'M.Salah', element_type: 3, team: 12, team_code: 14 },
      { id: 30, code: 223340, photo: '223340.jpg', first_name: 'Bukayo', second_name: 'Saka', web_name: 'Saka', element_type: 3, team: 1 },
      { id: 40, code: 226597, photo: '226597.jpg', first_name: 'Gabriel', second_name: 'Magalhães', web_name: 'Gabriel', element_type: 2, team: 1 },
      { id: 50, code: null, photo: '', first_name: 'James', second_name: 'Garner', web_name: 'Mystery', element_type: 3, team: 1 },
    ],
  });

  const livePointsMap = buildLivePointsMap({
    elements: [
      { id: 10, stats: { total_points: 6 } },
      { id: 20, stats: { total_points: 12 } },
      { id: 30, stats: { total_points: 0 } },
      { id: 40, stats: { total_points: 5 } },
    ],
  });

  const squad = assembleFplSquad({
    entryId: '2249544',
    event: 12,
    bootstrapMaps,
    livePointsMap,
    excelEventPoints: 41,
    picksPayload: {
      active_chip: '3xc',
      entry_history: { points: 78, total_points: 710, points_on_bench: 11, rank: 52400 },
      picks: [
        { element: 40, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 2 },
        { element: 50, position: 13, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 3 },
        { element: 20, position: 10, multiplier: 3, is_captain: true, is_vice_captain: false, element_type: 3 },
        { element: 30, position: 11, multiplier: 1, is_captain: false, is_vice_captain: true, element_type: 3 },
        { element: 10, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 1 },
      ],
    },
  });

  assert.equal(squad.entryId, '2249544');
  assert.equal(squad.event, 12);
  assert.equal(squad.activeChip, '3xc');
  // Header points strictly from Excel (41), not FPL entry_history.points (78)
  assert.equal(squad.eventPoints, 41);
  assert.equal(squad.pointsOnBench, 11);
  assert.equal(squad.rank, 52400);
  assert.equal(squad.startingXI.length, 3);
  assert.equal(squad.bench.length, 2);
  assert.equal(squad.startingXI[0].webName, 'Raya');
  assert.equal(squad.startingXI[0].code, 223094);
  assert.equal(squad.startingXI[0].points, 6);
  assert.equal(squad.startingXI[1].webName, 'M.Salah');
  assert.equal(squad.startingXI[1].web_name, 'M.Salah');
  assert.equal(squad.startingXI[1].firstName, 'Mohamed');
  assert.equal(squad.startingXI[1].first_name, 'Mohamed');
  assert.equal(squad.startingXI[1].secondName, 'Salah');
  assert.equal(squad.startingXI[1].second_name, 'Salah');
  assert.equal(squad.startingXI[1].fullName, 'Mohamed Salah');
  assert.equal(squad.startingXI[1].teamName, 'Liverpool');
  assert.equal(squad.startingXI[1].teamCode, 14);
  assert.equal(squad.startingXI[1].team_code, 14);
  assert.equal(squad.startingXI[1].code, 118748);
  assert.equal(squad.startingXI[1].isCaptain, true);
  assert.equal(squad.startingXI[1].multiplier, 3);
  assert.equal(squad.startingXI[1].points, 36);
  assert.equal(
    squad.startingXI[1].photoUrl,
    '/custom-players/M.Salah.png',
  );
  assert.deepEqual(squad.startingXI[1].photoUrls, [
    '/custom-players/M.Salah.png',
    '/custom-players/M.Salah.jpg',
    '/custom-players/M.Salah.jpeg',
    '/custom-players/M.Salah.webp',
    '/custom-players/m.salah.png',
    '/custom-players/m.salah.jpg',
    '/custom-players/m.salah.jpeg',
    '/custom-players/m.salah.webp',
    'https://resources.premierleague.com/premierleague/photos/players/250x250/p118748.png',
    '/.netlify/functions/player-photo?code=118748&name=Mohamed%20Salah&webName=M.Salah&firstName=Mohamed&secondName=Salah&team=Liverpool&teamCode=14',
  ]);
  assert.equal(squad.startingXI[2].isViceCaptain, true);
  assert.equal(squad.startingXI[2].points, 0);
  assert.equal(squad.bench[0].webName, 'Gabriel');
  assert.equal(squad.bench[0].points, 5);
  assert.equal(squad.bench[1].elementId, 50);
  assert.equal(squad.bench[1].code, null);
  assert.equal(squad.bench[1].first_name, 'James');
  assert.equal(squad.bench[1].second_name, 'Garner');
  assert.equal(
    squad.bench[1].photoUrl,
    '/custom-players/Mystery.png',
  );
  assert.deepEqual(squad.bench[1].photoUrls, [
    '/custom-players/Mystery.png',
    '/custom-players/Mystery.jpg',
    '/custom-players/Mystery.jpeg',
    '/custom-players/Mystery.webp',
    '/custom-players/mystery.png',
    '/custom-players/mystery.jpg',
    '/custom-players/mystery.jpeg',
    '/custom-players/mystery.webp',
    '/.netlify/functions/player-photo?name=James%20Garner&webName=Mystery&firstName=James&secondName=Garner&team=Arsenal&teamCode=3',
  ]);
});

test('resolveExcelPointsForEntry returns exact Excel playerScore or defaults to 0', () => {
  const players = [
    { playerId: '2249544', playerScore: 0 },
    { playerId: '233289', playerScore: 37 },
    { playerId: '60990', playerScore: null },
  ];
  assert.equal(resolveExcelPointsForEntry('2249544', players), 0);
  assert.equal(resolveExcelPointsForEntry('233289', players), 37);
  assert.equal(resolveExcelPointsForEntry('60990', players), 0);
  assert.equal(resolveExcelPointsForEntry('999999', players), 0);
});

test('getFplSquadWithCache caches per entryId for 90s and coalesces concurrent calls', async () => {
  resetFplCachesForTests();
  let calls = 0;

  const loader = async (entryId: string, event: number = 12) => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 10));
    return {
      entryId,
      event,
      activeChip: null,
      eventPoints: 0,
      totalPoints: 620,
      pointsOnBench: null,
      rank: 210000,
      startingXI: [],
      bench: [],
      updatedAt: '2026-11-25T22:00:00.000Z',
    };
  };

  const now = 5_000_000;
  const [r1, r2] = await Promise.all([
    getFplSquadWithCache('2249544', 12, now, loader),
    getFplSquadWithCache('2249544', 12, now + 5, loader),
  ]);

  assert.equal(calls, 1);
  assert.equal(r1.cacheState, 'MISS');
  assert.equal(r2.cacheState, 'MISS');

  const r3 = await getFplSquadWithCache('2249544', 12, Date.now() + 20_000, loader);
  assert.equal(calls, 1);
  assert.equal(r3.cacheState, 'HIT');
});

test('handler returns 400 for invalid entryId without calling upstream', async () => {
  const res = await handler({ queryStringParameters: { entryId: 'bad-id' } });
  assert.equal(res.statusCode, 400);
  const body = JSON.parse(res.body);
  assert.equal(body.errorCode, 'INVALID_ENTRY_ID');
});
