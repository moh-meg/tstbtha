import * as XLSXNamespace from 'xlsx';

export const XLSX = XLSXNamespace.read ? XLSXNamespace : XLSXNamespace.default;

export const CACHE_TTL_MS = 90_000;
export const CACHE_CONTROL_HEADER =
  'public, max-age=30, s-maxage=90, stale-while-revalidate=30';

const ALLOWED_HOSTS = new Set([
  '1drv.ms',
  'onedrive.live.com',
  'api.onedrive.com',
]);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

export function isAllowedOneDriveHost(hostname) {
  const lower = hostname.toLowerCase();
  return ALLOWED_HOSTS.has(lower) || lower.endsWith('.sharepoint.com');
}

export function encodeOneDriveShareId(shareUrl) {
  const base64 = Buffer.from(shareUrl, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `u!${base64}`;
}

export function isValidXlsxBuffer(buffer) {
  return (
    buffer &&
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b
  );
}

export function extractSharePointDownloadFromUrl(parsedUrl) {
  const host = parsedUrl.hostname.toLowerCase();
  if (host === '1drv.ms') {
    const parts = parsedUrl.pathname.split('/').filter(Boolean);
    if (parts.length >= 4 && parts[1] === 'c') {
      return `https://onedrive.live.com/personal/${encodeURIComponent(parts[2])}/_layouts/15/download.aspx?share=${encodeURIComponent(parts[3])}`;
    }
  }

  if (host === 'onedrive.live.com') {
    const personalIdx = parsedUrl.pathname.indexOf('/personal/');
    if (personalIdx !== -1 && !parsedUrl.pathname.includes('/_layouts/15/download.aspx')) {
      const rest = parsedUrl.pathname
        .slice(personalIdx + '/personal/'.length)
        .split('/')
        .filter(Boolean);
      if (rest.length >= 2) {
        return `https://onedrive.live.com/personal/${encodeURIComponent(rest[0])}/_layouts/15/download.aspx?share=${encodeURIComponent(rest[1])}`;
      }
    }
  }

  return null;
}

export function normalizeInputUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    return '';
  }
  let cleaned = rawUrl.trim().replace(/^['"]|['"]$/g, '');
  const mdMatch = cleaned.match(/^\[[^\]]*\]\((https:\/\/[^)\s]+)\)$/i);
  if (mdMatch) {
    cleaned = mdMatch[1];
  }
  return cleaned;
}

export function buildOneDriveDownloadCandidates(inputUrl) {
  const cleanedUrl = normalizeInputUrl(inputUrl);
  const parsed = new URL(cleanedUrl);
  if (parsed.protocol !== 'https:' || !isAllowedOneDriveHost(parsed.hostname)) {
    throw new Error('Unsupported Excel source URL host or protocol');
  }

  const candidates = [];
  const spDirect = extractSharePointDownloadFromUrl(parsed);
  if (spDirect) {
    candidates.push(spDirect);
  }

  candidates.push(
    `https://api.onedrive.com/v1.0/shares/${encodeOneDriveShareId(parsed.toString())}/root/content`,
  );

  const withDownloadParam = new URL(parsed.toString());
  withDownloadParam.searchParams.set('download', '1');
  candidates.push(withDownloadParam.toString());

  return [...new Set(candidates)];
}

export function resolveConfiguredShareUrl(envValue, defaultShareUrl) {
  const envUrl = normalizeInputUrl(envValue);
  if (!envUrl) {
    return defaultShareUrl;
  }
  try {
    buildOneDriveDownloadCandidates(envUrl);
    return envUrl;
  } catch {
    return defaultShareUrl;
  }
}

export async function fetchXlsxBufferFromOneDrive(shareUrl) {
  const candidates = buildOneDriveDownloadCandidates(shareUrl);

  for (const candidateUrl of candidates) {
    try {
      const response = await fetch(candidateUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
        },
      });

      if (response.url && response.url !== candidateUrl) {
        try {
          const redirected = new URL(response.url);
          if (redirected.protocol === 'https:' && isAllowedOneDriveHost(redirected.hostname)) {
            const derived = extractSharePointDownloadFromUrl(redirected);
            if (derived && derived !== candidateUrl) {
              const spResp = await fetch(derived, {
                redirect: 'follow',
                headers: {
                  'User-Agent': BROWSER_USER_AGENT,
                  Accept:
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
                },
              });
              if (spResp.ok) {
                const spBuffer = Buffer.from(await spResp.arrayBuffer());
                if (isValidXlsxBuffer(spBuffer)) {
                  return spBuffer;
                }
              }
            }
          }
        } catch {
          // Ignore malformed redirect URL checks and continue
        }
      }

      if (!response.ok) {
        continue;
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (isValidXlsxBuffer(buffer)) {
        return buffer;
      }
    } catch {
      // Try next candidate URL
    }
  }

  throw new Error('Could not download a valid PK-signed .xlsx file from OneDrive');
}

export function readFirstSheetRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excel workbook has no sheets');
  }
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
}

export function cleanCellString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

export function parseCellScore(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const str = String(value).trim();
  if (str === '-') {
    return null;
  }
  const num = Number(str);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : null;
}

export function createTimedCache(ttlMs = CACHE_TTL_MS) {
  let cachedPayload = null;
  let cachedAtMs = 0;
  let inFlightPromise = null;

  return {
    reset() {
      cachedPayload = null;
      cachedAtMs = 0;
      inFlightPromise = null;
    },
    async get(nowMs, loader) {
      if (cachedPayload && nowMs - cachedAtMs < ttlMs) {
        return { payload: cachedPayload, cacheState: 'HIT' };
      }

      if (!inFlightPromise) {
        inFlightPromise = (async () => {
          try {
            const freshPayload = await loader();
            cachedPayload = freshPayload;
            cachedAtMs = Date.now();
            return { payload: freshPayload, cacheState: 'MISS' };
          } finally {
            inFlightPromise = null;
          }
        })();
      }

      try {
        return await inFlightPromise;
      } catch (error) {
        if (cachedPayload) {
          return { payload: cachedPayload, cacheState: 'STALE' };
        }
        throw error;
      }
    },
  };
}
