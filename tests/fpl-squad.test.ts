import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleFplSquad,
  buildBootstrapMaps,
  buildLivePointsMap,
  buildLiveStatsMap,
  buildPlayerPhotoCandidates,
  buildTeamFixtureLookup,
  FplUpstreamError,
  aggregateAllTeamsPlayCounts,
  computeSquadPlayCounts,
  getFplSquadWithCache,
  resetFplCachesForTests,
  resolvePlayerPhotoUrl,
  sumSquadPlayCountsList,
  validateEntryId,
  validateEventId,
} from '../netlify/lib/fpl.js';
import { handler, resolveExcelPointsForEntry } from '../netlify/functions/fpl-squad.js';
import {
  getTeamCountsWithCache,
  handler as teamCountsHandler,
  resetTeamCountsCacheForTests,
} from '../netlify/functions/team-counts.js';

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
      '/custom-players/haaland.png',
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
      '/custom-players/signing.png',
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
    '/custom-players/m.salah.png',
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
    '/custom-players/mystery.png',
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

test('assembleFplSquad marks started/played players for points and unplayed players with GW12 opponent or BGW', () => {
  const bootstrapMaps = buildBootstrapMaps({
    teams: [
      { id: 1, code: 3, short_name: 'ARS', name: 'Arsenal' },
      { id: 7, code: 8, short_name: 'CHE', name: 'Chelsea' },
      { id: 12, code: 14, short_name: 'LIV', name: 'Liverpool' },
      { id: 19, code: 21, short_name: 'WHU', name: 'West Ham' },
    ],
    elements: [
      { id: 10, code: 154561, first_name: 'David', second_name: 'Raya', web_name: 'Raya', element_type: 1, team: 1 },
      { id: 20, code: 244851, first_name: 'Cole', second_name: 'Palmer', web_name: 'Palmer', element_type: 3, team: 7 },
      { id: 30, code: 118748, first_name: 'Mohamed', second_name: 'Salah', web_name: 'M.Salah', element_type: 3, team: 12 },
      { id: 40, code: 223340, first_name: 'Jarrod', second_name: 'Bowen', web_name: 'Bowen', element_type: 3, team: 19 },
    ],
  });

  const liveStatsMap = buildLiveStatsMap({
    elements: [
      { id: 10, stats: { total_points: 6, minutes: 90 } },
      { id: 20, stats: { total_points: 0, minutes: 0 } },
      { id: 30, stats: { total_points: 1, minutes: 12 } },
      { id: 40, stats: { total_points: 0, minutes: 0 } },
    ],
  });

  const nowMs = Date.parse('2026-11-28T15:00:00Z');
  const teamFixtureLookup = buildTeamFixtureLookup(
    [
      // CHE home vs LIV unstarted in flag, EXCEPT Salah's minutes > 0 overrides
      { team_h: 7, team_a: 12, started: false, finished: false, kickoff_time: '2026-11-29T16:30:00Z' },
      // ARS finished
      { team_h: 1, team_a: 2, started: true, finished: true, kickoff_time: '2026-11-28T12:30:00Z' },
      // WHU (19) omitted -> Blank Gameweek (BGW)
    ],
    bootstrapMaps.teamsById,
    nowMs,
    bootstrapMaps.teamCodesById,
  );

  const squad = assembleFplSquad({
    entryId: '2249544',
    event: 12,
    bootstrapMaps,
    liveStatsMap,
    teamFixtureLookup,
    excelEventPoints: 19,
    picksPayload: {
      picks: [
        { element: 10, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false },
        { element: 20, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false },
        { element: 30, position: 3, multiplier: 2, is_captain: true, is_vice_captain: false },
        { element: 40, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false },
      ],
    },
  });

  assert.equal(squad.eventPoints, 19);
  // Raya: finished fixture + 90 mins -> show 6 pts
  assert.equal(squad.startingXI[0].hasStarted, true);
  assert.equal(squad.startingXI[0].fixtureStatus, 'finished');
  assert.equal(squad.startingXI[0].points, 6);
  // Palmer (CHE home vs LIV): unstarted + 0 mins -> show LIV (H) + LIV teamCode 14
  assert.equal(squad.startingXI[1].hasStarted, false);
  assert.equal(squad.startingXI[1].fixtureStatus, 'upcoming');
  assert.equal(squad.startingXI[1].opponentDisplay, 'LIV (H)');
  assert.equal(squad.startingXI[1].opponentShortName, 'LIV');
  assert.equal(squad.startingXI[1].opponentTeamCode, 14);
  // Salah (LIV away @ CHE): minutes=12 > 0 -> started & live -> show 2 pts
  assert.equal(squad.startingXI[2].hasStarted, true);
  assert.equal(squad.startingXI[2].fixtureStatus, 'live');
  assert.equal(squad.startingXI[2].points, 2);
  assert.equal(squad.startingXI[2].opponentDisplay, 'CHE (A)');
  assert.equal(squad.startingXI[2].opponentTeamCode, 8);
  // Bowen (WHU): no fixture in GW12 -> BGW
  assert.equal(squad.bench[0].hasStarted, false);
  assert.equal(squad.bench[0].fixtureStatus, 'upcoming');
  assert.equal(squad.bench[0].opponentDisplay, 'BGW');
  // Null fixtures payload gracefully defaults to null lookup & shows points
  assert.equal(buildTeamFixtureLookup(null, bootstrapMaps.teamsById), null);
});

test('aggregateAllTeamsPlayCounts sums each manager squad counts (Captain 2x, TC 3x, BB 16) per team', async () => {
  const makeStarter = (pos: number, status: 'finished' | 'live' | 'upcoming', isCap = false, mult = 1) => ({
    position: pos,
    isCaptain: isCap,
    multiplier: mult,
    fixtureStatus: status,
    hasStarted: status !== 'upcoming',
  });
  const makeBench = (pos: number, status: 'finished' | 'live' | 'upcoming') => ({
    position: pos,
    isCaptain: false,
    multiplier: 0,
    fixtureStatus: status,
    hasStarted: status !== 'upcoming',
  });

  const squads = new Map<string, unknown>([
    [
      // Standard 12 total: 6 finished, 4 live (incl. captain 2x), 2 upcoming
      '101',
      {
        activeChip: null,
        startingXI: [
          makeStarter(1, 'finished'),
          makeStarter(2, 'finished'),
          makeStarter(3, 'finished'),
          makeStarter(4, 'finished'),
          makeStarter(5, 'finished'),
          makeStarter(6, 'finished'),
          makeStarter(7, 'live'),
          makeStarter(8, 'live'),
          makeStarter(9, 'live', true, 2),
          makeStarter(10, 'upcoming'),
          makeStarter(11, 'upcoming'),
        ],
        bench: [makeBench(12, 'finished'), makeBench(13, 'upcoming'), makeBench(14, 'upcoming'), makeBench(15, 'upcoming')],
      },
    ],
    [
      // Triple Captain 13 total: 5 finished, 3 live, 5 upcoming (captain 3x)
      '102',
      {
        activeChip: '3xc',
        startingXI: [
          makeStarter(1, 'finished'),
          makeStarter(2, 'finished'),
          makeStarter(3, 'finished'),
          makeStarter(4, 'finished'),
          makeStarter(5, 'finished'),
          makeStarter(6, 'live'),
          makeStarter(7, 'live'),
          makeStarter(8, 'live'),
          makeStarter(9, 'upcoming'),
          makeStarter(10, 'upcoming'),
          makeStarter(11, 'upcoming', true, 3),
        ],
        bench: [makeBench(12, 'finished'), makeBench(13, 'finished'), makeBench(14, 'finished'), makeBench(15, 'finished')],
      },
    ],
    [
      // Bench Boost 16 total: 10 finished (incl. captain 2x), 2 live, 4 upcoming
      '201',
      {
        activeChip: 'bboost',
        startingXI: [
          makeStarter(1, 'finished'),
          makeStarter(2, 'finished'),
          makeStarter(3, 'finished'),
          makeStarter(4, 'finished'),
          makeStarter(5, 'finished'),
          makeStarter(6, 'finished'),
          makeStarter(7, 'finished'),
          makeStarter(8, 'finished', true, 2),
          makeStarter(9, 'live'),
          makeStarter(10, 'live'),
          makeStarter(11, 'upcoming'),
        ],
        bench: [
          makeBench(12, 'finished'),
          makeBench(13, 'upcoming'),
          makeBench(14, 'upcoming'),
          makeBench(15, 'upcoming'),
        ],
      },
    ],
  ]);

  const result = await aggregateAllTeamsPlayCounts({
    players: [
      { teamName: 'اولاد زبانة', playerId: '101' },
      { teamName: 'اولاد زبانة', playerId: '102' },
      { teamName: 'اولاد الدليل', playerId: '201' },
      { teamName: 'اولاد الدليل', playerId: '999999999' }, // missing/404 manager skipped cleanly
    ],
    event: 12,
    squadLoader: async (entryId) => squads.get(entryId) ?? null,
  });

  assert.equal(result.event, 12);
  assert.deepEqual(result.teams['اولاد زبانة'], {
    total: 25, // 12 + 13
    played: 11, // 6 + 5
    playing: 7, // 4 + 3
    remaining: 7, // 2 + 5
  });
  assert.deepEqual(result.teams['اولاد الدليل'], {
    total: 16,
    played: 10,
    playing: 2,
    remaining: 4,
  });
  assert.deepEqual(
    sumSquadPlayCountsList([
      computeSquadPlayCounts(squads.get('101') as never),
      computeSquadPlayCounts(squads.get('102') as never),
    ]),
    result.teams['اولاد زبانة'],
  );

  // team-counts handler returns 400 on invalid event & caches valid responses
  const badRes = await teamCountsHandler({ queryStringParameters: { event: '99' } });
  assert.equal(badRes.statusCode, 400);

  resetTeamCountsCacheForTests();
  let calls = 0;
  const first = await getTeamCountsWithCache(12, 1_000_000, async () => {
    calls += 1;
    return { event: 12, teams: result.teams, updatedAt: 'now' };
  });
  const second = await getTeamCountsWithCache(12, Date.now() + 5_000, async () => {
    calls += 1;
    return { event: 12, teams: result.teams, updatedAt: 'now' };
  });
  assert.equal(calls, 1);
  assert.equal(first.cacheState, 'MISS');
  assert.equal(second.cacheState, 'HIT');
});
