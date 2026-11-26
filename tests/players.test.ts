import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_CONTROL_HEADER,
  DEFAULT_PLAYERS_ONEDRIVE_SHARE_URL,
  getPlayersWithCache,
  parseExcelRowsToPlayers,
  resetPlayersCacheForTests,
  resolvePlayersDownloadUrl,
} from '../netlify/functions/players.js';

test('resolvePlayersDownloadUrl converts second OneDrive share link to SharePoint download endpoint', () => {
  const url = resolvePlayersDownloadUrl(DEFAULT_PLAYERS_ONEDRIVE_SHARE_URL);
  assert.equal(
    url,
    'https://onedrive.live.com/personal/13310541d7ff2949/_layouts/15/download.aspx?share=IQDbxALpCCljSKuq_WSgqScrAd0gdiRKpUUexj05jBe1WTg',
  );
});

test('parseExcelRowsToPlayers parses Row 2+, trims teamName, preserves 0 scores, and skips empty rows', () => {
  const rows = [
    ['team ', 'player name', 'id', 'points'],
    ['بني مزاب ', 'walid sabeur (cap) ', 233289, '32'],
    [null, null, null, null],
    ['اولاد زبانة ', 'عفيف', 4347009, 0],
    ['اولاد الدليل', 'Hassan Team', '60990', null],
  ];

  const players = parseExcelRowsToPlayers(rows);
  assert.equal(players.length, 3);

  assert.equal(players[0].teamName, 'بني مزاب');
  assert.equal(players[0].playerName, 'walid sabeur (cap)');
  assert.equal(players[0].playerId, '233289');
  assert.equal(players[0].playerScore, 32);

  assert.equal(players[1].teamName, 'اولاد زبانة');
  assert.equal(players[1].playerName, 'عفيف');
  assert.equal(players[1].playerId, '4347009');
  assert.equal(players[1].playerScore, 0);

  assert.equal(players[2].teamName, 'اولاد الدليل');
  assert.equal(players[2].playerScore, null);
});

test('getPlayersWithCache caches for 90s and sets Cache-Control header', async () => {
  resetPlayersCacheForTests();
  let calls = 0;

  const loader = async () => {
    calls += 1;
    return { tournamentTitle: 'BATHA LEAGUE', players: [], updatedAt: 'now' };
  };

  const t0 = 2_000_000;
  const r1 = await getPlayersWithCache(t0, loader);
  const r2 = await getPlayersWithCache(Date.now() + 10_000, loader);

  assert.equal(calls, 1);
  assert.equal(r1.cacheState, 'MISS');
  assert.equal(r2.cacheState, 'HIT');
  assert.equal(
    CACHE_CONTROL_HEADER,
    'public, max-age=30, s-maxage=90, stale-while-revalidate=30',
  );
});
