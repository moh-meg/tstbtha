import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOneDriveDownloadCandidates,
  CACHE_CONTROL_HEADER,
  DEFAULT_ONEDRIVE_SHARE_URL,
  encodeOneDriveShareId,
  getMatchesWithCache,
  isValidXlsxBuffer,
  parseCellScore,
  parseExcelRowsToMatches,
  resetMatchesCacheForTests,
  resolveOneDriveDownloadUrl,
} from '../netlify/functions/matches.js';

test('resolveOneDriveDownloadUrl and buildOneDriveDownloadCandidates produce SharePoint, shares API, and download=1 URLs', () => {
  const url = resolveOneDriveDownloadUrl(DEFAULT_ONEDRIVE_SHARE_URL);
  assert.equal(
    url,
    'https://onedrive.live.com/personal/13310541d7ff2949/_layouts/15/download.aspx?share=IQCa819eDxX5RJBkUo6rcRrNAbXaYV5W9B98WTnFZfSSsew',
  );

  const mdUrl = resolveOneDriveDownloadUrl(
    `[${DEFAULT_ONEDRIVE_SHARE_URL}](${DEFAULT_ONEDRIVE_SHARE_URL})`,
  );
  assert.equal(mdUrl, url);

  const candidates = buildOneDriveDownloadCandidates(DEFAULT_ONEDRIVE_SHARE_URL);
  assert.equal(candidates.length, 3);
  assert.ok(candidates[1].startsWith('https://api.onedrive.com/v1.0/shares/u!'));
  assert.ok(candidates[2].includes('download=1'));
  assert.ok(encodeOneDriveShareId(DEFAULT_ONEDRIVE_SHARE_URL).startsWith('u!'));
});

test('isValidXlsxBuffer verifies PK zip magic signature and rejects HTML', () => {
  assert.equal(isValidXlsxBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04])), true);
  assert.equal(isValidXlsxBuffer(Buffer.from('<!doctype html>')), false);
  assert.equal(isValidXlsxBuffer(Buffer.from([0x50])), false);
});

test('parseCellScore preserves numeric 0 and rejects blank/dash', () => {
  assert.equal(parseCellScore(0), 0);
  assert.equal(parseCellScore('0'), 0);
  assert.equal(parseCellScore(2), 2);
  assert.equal(parseCellScore(''), null);
  assert.equal(parseCellScore(null), null);
  assert.equal(parseCellScore(undefined), null);
  assert.equal(parseCellScore('-'), null);
});

test('resolveOneDriveDownloadUrl rejects non-HTTPS and untrusted hosts', () => {
  assert.throws(() => resolveOneDriveDownloadUrl('http://1drv.ms/x/c/123/abc'));
  assert.throws(() => resolveOneDriveDownloadUrl('https://evil.example.com/file.xlsx'));
});

test('parseExcelRowsToMatches parses Row 2+, trims names, keeps 0 scores, skips empty rows', () => {
  const rows = [
    ['team 1', 'score 1', 'score 2', 'team 2', 'stage'],
    ['اولاد زبانة ', 0, 0, 'اولاد الدليل'],
    [null, null, null, null],
    ['اولاد الزيبان ', '', null, 'بني مزاب ', 'quart de finale'],
  ];

  const matches = parseExcelRowsToMatches(rows);
  assert.equal(matches.length, 2);

  assert.equal(matches[0].homeTeam.name, 'اولاد زبانة');
  assert.equal(matches[0].awayTeam.name, 'اولاد الدليل');
  assert.equal(matches[0].homeScore, 0);
  assert.equal(matches[0].awayScore, 0);
  assert.equal(matches[0].stage, 'DEMI FINALE !!');
  assert.equal(
    matches[0].homeTeam.logoUrl,
    `/logos/${encodeURIComponent('اولاد زبانة')}.png`,
  );

  assert.equal(matches[1].homeTeam.name, 'اولاد الزيبان');
  assert.equal(matches[1].awayTeam.name, 'بني مزاب');
  assert.equal(matches[1].homeScore, null);
  assert.equal(matches[1].awayScore, null);
  assert.equal(matches[1].stage, 'QUART DE FINALE');
});

test('getMatchesWithCache caches for 90s and coalesces concurrent requests', async () => {
  resetMatchesCacheForTests();
  let loaderCalls = 0;

  const loader = async () => {
    loaderCalls += 1;
    await new Promise((r) => setTimeout(r, 15));
    return { tournamentTitle: 'BATHA LEAGUE', matches: [], updatedAt: 'now' };
  };

  const t0 = 1_000_000;
  const [r1, r2, r3] = await Promise.all([
    getMatchesWithCache(t0, loader),
    getMatchesWithCache(t0, loader),
    getMatchesWithCache(t0, loader),
  ]);

  assert.equal(loaderCalls, 1);
  assert.equal(r1.cacheState, 'MISS');
  assert.equal(r2.cacheState, 'MISS');
  assert.equal(r3.cacheState, 'MISS');

  const hit = await getMatchesWithCache(Date.now() + 30_000, loader);
  assert.equal(hit.cacheState, 'HIT');
  assert.equal(loaderCalls, 1);

  assert.equal(
    CACHE_CONTROL_HEADER,
    'public, max-age=30, s-maxage=90, stale-while-revalidate=30',
  );
});
