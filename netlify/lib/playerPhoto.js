import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLAYER_PHOTO_CACHE_CONTROL = 'public, max-age=2592000, s-maxage=2592000';
export const PLAYER_PHOTO_EXTERNAL_CACHE_CONTROL = 'public, max-age=2592000, s-maxage=2592000';
export const PLAYER_PHOTO_MISS_CACHE_CONTROL = 'public, max-age=300, s-maxage=300';

const FPL_PHOTO_BASE_LEGACY_250 =
  'https://resources.premierleague.com/premierleague/photos/players/250x250';
const FPL_PHOTO_BASE_25_250 =
  'https://resources.premierleague.com/premierleague25/photos/players/250x250';
const FPL_PHOTO_BASE_110 =
  'https://resources.premierleague.com/premierleague/photos/players/110x140';
const THESPORTSDB_SEARCH_BASE =
  'https://www.thesportsdb.com/api/v1/json/3/searchplayers.php';
const WIKIPEDIA_API_BASE = 'https://en.wikipedia.org/w/api.php';
const REMOVE_BG_API_URL = 'https://api.remove.bg/v1.0/removebg';

const CUSTOM_PLAYER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const CUSTOM_EXTENSION_CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const UPSTREAM_IMAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://fantasy.premierleague.com/',
};

const CLUB_HTML_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const API_JSON_HEADERS = {
  'User-Agent': 'BathaLeagueMatchResult/1.0 (https://bathaleague.app; contact@bathaleague.app)',
  Accept: 'application/json',
};

const PHOTO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PHOTO_EXTERNAL_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PHOTO_MISS_CACHE_TTL_MS = 5 * 60 * 1000;
const PHOTO_CACHE_MAX_ENTRIES = 300;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const UPSTREAM_FETCH_TIMEOUT_MS = 5000;
const REMOVE_BG_TIMEOUT_MS = 8000;
const TARGET_PHOTO_SIZE = 250;

const SPECIAL_DIACRITIC_MAP = {
  ø: 'o',
  Ø: 'O',
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ð: 'd',
  Ð: 'D',
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  þ: 'th',
  Þ: 'TH',
};

const ALLOWED_EXTERNAL_EXACT_HOSTS = new Set([
  'resources.premierleague.com',
  'thesportsdb.com',
  'upload.wikimedia.org',
  'res.cloudinary.com',
  'assets.arsenal.com',
  'www.arsenal.com',
  'www.chelseafc.com',
  'img.chelseafc.com',
  'www.brightonandhovealbion.com',
  'www.tottenhamhotspur.com',
  'tot-cms.azureedge.net',
  'cdns.tottenhamhotspur.com',
  'media.tottenhamhotspur.com',
  'www.avfc.co.uk',
  'images.avfc.co.uk',
  'www.liverpoolfc.com',
  'backend.liverpoolfc.com',
  'd3j2s6hdd6a7rg.cloudfront.net',
  'www.mancity.com',
  'www.manutd.com',
  'assets.manutd.com',
  'www.newcastleunited.com',
  'www.whufc.com',
  'www.cpfc.co.uk',
  'www.evertonfc.com',
  'www.fulhamfc.com',
  'www.brentfordfc.com',
  'www.afcb.co.uk',
  'www.nottinghamforest.co.uk',
  'www.wolves.co.uk',
  'www.leedsunited.com',
  'www.burnleyfc.com',
  'www.safc.com',
  'resources-uk.yinzcam.com',
]);

const ALLOWED_EXTERNAL_SUFFIXES = [
  '.thesportsdb.com',
  '.wikimedia.org',
  '.wikipedia.org',
  '.arsenal.com',
  '.chelseafc.com',
  '.brightonandhovealbion.com',
  '.tottenhamhotspur.com',
  '.avfc.co.uk',
  '.liverpoolfc.com',
  '.mancity.com',
  '.manutd.com',
  '.newcastleunited.com',
  '.whufc.com',
  '.cpfc.co.uk',
  '.evertonfc.com',
  '.fulhamfc.com',
  '.brentfordfc.com',
  '.afcb.co.uk',
  '.nottinghamforest.co.uk',
  '.wolves.co.uk',
  '.leedsunited.com',
  '.burnleyfc.com',
  '.safc.com',
];

const CLUB_PLAYER_SOURCES = [
  {
    key: 'arsenal',
    teamCodes: [3],
    aliases: ['arsenal', 'ars'],
    profileUrls: (slug) => [`https://www.arsenal.com/men/players/${slug}`],
    imageHostHints: ['assets.arsenal.com', 'arsenal.com'],
  },
  {
    key: 'aston-villa',
    teamCodes: [7],
    aliases: ['aston villa', 'villa', 'avl'],
    profileUrls: (slug) => [`https://www.avfc.co.uk/players/${slug}`],
    imageHostHints: ['avfc.co.uk', 'images.avfc.co.uk'],
  },
  {
    key: 'brighton',
    teamCodes: [36],
    aliases: ['brighton', 'brighton and hove albion', 'brighton hove albion', 'bha'],
    profileUrls: (slug) => [
      `https://www.brightonandhovealbion.com/teams/mens-team/players/${slug}`,
    ],
    imageHostHints: ['brightonandhovealbion.com', 'yinzcam.com'],
  },
  {
    key: 'chelsea',
    teamCodes: [8],
    aliases: ['chelsea', 'che'],
    profileUrls: (slug) => [`https://www.chelseafc.com/en/teams/profile/${slug}`],
    imageHostHints: ['res.cloudinary.com/chelsea-production', 'chelseafc.com'],
  },
  {
    key: 'tottenham',
    teamCodes: [6],
    aliases: ['tottenham', 'tottenham hotspur', 'spurs', 'tot'],
    profileUrls: (slug) => [
      `https://www.tottenhamhotspur.com/teams/first-team/players/${slug}/`,
    ],
    imageHostHints: ['tottenhamhotspur.com', 'tot-cms.azureedge.net'],
  },
  {
    key: 'liverpool',
    teamCodes: [14],
    aliases: ['liverpool', 'liv'],
    profileUrls: (slug) => [`https://www.liverpoolfc.com/team/mens/player/${slug}`],
    imageHostHints: ['liverpoolfc.com', 'backend.liverpoolfc.com'],
  },
  {
    key: 'man-city',
    teamCodes: [43],
    aliases: ['man city', 'manchester city', 'mci'],
    profileUrls: (slug) => [`https://www.mancity.com/players/${slug}`],
    imageHostHints: ['mancity.com'],
  },
  {
    key: 'man-utd',
    teamCodes: [1],
    aliases: ['man utd', 'man united', 'manchester united', 'mun'],
    profileUrls: (slug) => [`https://www.manutd.com/en/players-and-staff/detail/${slug}`],
    imageHostHints: ['manutd.com', 'assets.manutd.com'],
  },
  {
    key: 'newcastle',
    teamCodes: [4],
    aliases: ['newcastle', 'newcastle united', 'new'],
    profileUrls: (slug) => [`https://www.newcastleunited.com/en/teams/mens-team/${slug}`],
    imageHostHints: ['newcastleunited.com'],
  },
  {
    key: 'west-ham',
    teamCodes: [21],
    aliases: ['west ham', 'west ham united', 'whu'],
    profileUrls: (slug) => [`https://www.whufc.com/teams/first-team/squad/${slug}`],
    imageHostHints: ['whufc.com'],
  },
  {
    key: 'crystal-palace',
    teamCodes: [31],
    aliases: ['crystal palace', 'palace', 'cry'],
    profileUrls: (slug) => [`https://www.cpfc.co.uk/teams/mens-first-team/player/${slug}`],
    imageHostHints: ['cpfc.co.uk'],
  },
  {
    key: 'everton',
    teamCodes: [11],
    aliases: ['everton', 'eve'],
    profileUrls: (slug) => [`https://www.evertonfc.com/players/${slug}`],
    imageHostHints: ['evertonfc.com'],
  },
  {
    key: 'fulham',
    teamCodes: [54],
    aliases: ['fulham', 'ful'],
    profileUrls: (slug) => [`https://www.fulhamfc.com/first-team/${slug}`],
    imageHostHints: ['fulhamfc.com'],
  },
  {
    key: 'brentford',
    teamCodes: [94],
    aliases: ['brentford', 'bre'],
    profileUrls: (slug) => [`https://www.brentfordfc.com/en/teams/first-team/${slug}`],
    imageHostHints: ['brentfordfc.com'],
  },
  {
    key: 'bournemouth',
    teamCodes: [91],
    aliases: ['bournemouth', 'afc bournemouth', 'bou'],
    profileUrls: (slug) => [`https://www.afcb.co.uk/teams/first-team/${slug}`],
    imageHostHints: ['afcb.co.uk'],
  },
  {
    key: 'nottm-forest',
    teamCodes: [17],
    aliases: ['nottm forest', 'nottingham forest', 'nfo'],
    profileUrls: (slug) => [`https://www.nottinghamforest.co.uk/players/${slug}`],
    imageHostHints: ['nottinghamforest.co.uk'],
  },
  {
    key: 'wolves',
    teamCodes: [39],
    aliases: ['wolves', 'wolverhampton', 'wolverhampton wanderers', 'wol'],
    profileUrls: (slug) => [`https://www.wolves.co.uk/teams/mens-first-team/${slug}`],
    imageHostHints: ['wolves.co.uk'],
  },
  {
    key: 'leeds',
    teamCodes: [2],
    aliases: ['leeds', 'leeds united', 'lee'],
    profileUrls: (slug) => [`https://www.leedsunited.com/en/teams/mens-first-team/${slug}`],
    imageHostHints: ['leedsunited.com'],
  },
  {
    key: 'burnley',
    teamCodes: [90],
    aliases: ['burnley', 'bur'],
    profileUrls: (slug) => [`https://www.burnleyfc.com/teams/first-team/${slug}`],
    imageHostHints: ['burnleyfc.com'],
  },
  {
    key: 'sunderland',
    teamCodes: [56],
    aliases: ['sunderland', 'sun'],
    profileUrls: (slug) => [`https://www.safc.com/teams/first-team/${slug}`],
    imageHostHints: ['safc.com'],
  },
];

export function validatePlayerPhotoCode(rawCode) {
  if (rawCode === null || rawCode === undefined) {
    return null;
  }
  const cleaned = String(rawCode).trim();
  if (!/^\d{1,12}$/.test(cleaned)) {
    return null;
  }
  const numeric = Number(cleaned);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    return null;
  }
  return cleaned;
}

export function cleanPlayerQueryText(rawText, maxLength = 80) {
  if (typeof rawText !== 'string') {
    return '';
  }
  return rawText.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function normalizeSearchText(rawText, maxLength = 80) {
  const cleaned = cleanPlayerQueryText(rawText, maxLength);
  if (!cleaned) {
    return '';
  }
  const transliterated = cleaned.replace(
    /[øØłŁđĐðÐßæÆœŒþÞ]/g,
    (ch) => SPECIAL_DIACRITIC_MAP[ch] ?? ch,
  );
  return transliterated
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveFullPlayerName({ name = '', firstName = '', secondName = '' } = {}) {
  const combinedFromParts = [cleanPlayerQueryText(firstName), cleanPlayerQueryText(secondName)]
    .filter(Boolean)
    .join(' ');
  const cleanedName = cleanPlayerQueryText(name);
  return combinedFromParts || cleanedName;
}

export function getDefaultCustomPlayersDirectories() {
  const candidates = [
    path.resolve(process.cwd(), 'public', 'custom-players'),
    path.resolve(process.cwd(), 'client', 'public', 'custom-players'),
  ];
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(
      path.resolve(moduleDir, '../../public/custom-players'),
      path.resolve(moduleDir, '../../client/public/custom-players'),
    );
  } catch {
    // Ignore import.meta.url resolution issues in bundled runtimes
  }
  return [...new Set(candidates)];
}

/**
 * Step 1: Look in `public/custom-players/` (or `client/public/custom-players/`)
 * for a file matching the player's displayed squad name (`web_name`).
 * Priority: exact > case-insensitive > accent/diacritic-normalized across .png, .jpg, .jpeg, .webp.
 * @param {{
 *   webName?: string | null,
 *   name?: string | null,
 *   customPlayersDirs?: string[] | null,
 * }} [options]
 */
export async function findCustomPlayerPhotoAsset(
  { webName = '', name = '', customPlayersDirs = null } = {},
) {
  const targetName = cleanPlayerQueryText(webName) || cleanPlayerQueryText(name);
  if (!targetName) {
    return null;
  }

  const targetLower = targetName.toLowerCase();
  const targetNormalized = normalizeSearchText(targetName).toLowerCase();
  const dirs =
    Array.isArray(customPlayersDirs) && customPlayersDirs.length > 0
      ? customPlayersDirs
      : getDefaultCustomPlayersDirectories();

  for (const dirPath of dirs) {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    let bestMatch = null;

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      const extIndex = CUSTOM_PLAYER_EXTENSIONS.indexOf(ext);
      if (extIndex === -1) {
        continue;
      }

      const baseName = cleanPlayerQueryText(entry.name.slice(0, entry.name.length - ext.length));
      if (!baseName) {
        continue;
      }

      let matchTier = 0;
      if (baseName === targetName) {
        matchTier = 3;
      } else if (baseName.toLowerCase() === targetLower) {
        matchTier = 2;
      } else if (targetNormalized && normalizeSearchText(baseName).toLowerCase() === targetNormalized) {
        matchTier = 1;
      }

      if (matchTier === 0) {
        continue;
      }

      if (
        !bestMatch ||
        matchTier > bestMatch.matchTier ||
        (matchTier === bestMatch.matchTier && extIndex < bestMatch.extIndex)
      ) {
        bestMatch = {
          fileName: entry.name,
          fullPath: path.join(dirPath, entry.name),
          ext,
          extIndex,
          matchTier,
        };
      }
    }

    if (!bestMatch) {
      continue;
    }

    try {
      const fileBuffer = await fs.readFile(bestMatch.fullPath);
      const bytes = new Uint8Array(fileBuffer);
      const contentType = CUSTOM_EXTENSION_CONTENT_TYPES[bestMatch.ext] || 'image/png';
      if (!isValidImageBuffer(bytes, contentType)) {
        continue;
      }

      return {
        ok: true,
        statusCode: 200,
        contentType,
        bytes,
        base64Body: Buffer.from(bytes).toString('base64'),
        source: 'custom-folder',
        fileName: bestMatch.fileName,
        cacheControl: PLAYER_PHOTO_CACHE_CONTROL,
      };
    } catch {
      // Skip unreadable file and continue checking
    }
  }

  return null;
}

/**
 * Step 2: Official Premier League Endpoints
 * @param {string | number | null | undefined} code
 * @param {string | number | null | undefined} [photoCode]
 */
export function buildUpstreamPhotoUrls(code, photoCode = null) {
  const validCode = validatePlayerPhotoCode(code);
  const validPhotoCode = validatePlayerPhotoCode(photoCode);

  const ids = [];
  if (validCode) {
    ids.push(validCode);
  }
  if (validPhotoCode && !ids.includes(validPhotoCode)) {
    ids.push(validPhotoCode);
  }

  const urls = [];
  for (const id of ids) {
    urls.push(`${FPL_PHOTO_BASE_LEGACY_250}/p${id}.png`);
    urls.push(`${FPL_PHOTO_BASE_25_250}/p${id}.png`);
    urls.push(`${FPL_PHOTO_BASE_110}/p${id}.png`);
  }
  return urls;
}

export function isAllowedExternalImageUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return false;
  }
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_EXTERNAL_EXACT_HOSTS.has(host)) {
      return true;
    }
    return ALLOWED_EXTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

export function isValidImageBuffer(bytes, contentType = '') {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > MAX_PHOTO_BYTES) {
    return false;
  }
  const lowered = String(contentType).toLowerCase();
  if (lowered && !lowered.startsWith('image/')) {
    return false;
  }
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  return isPng || isJpeg || isWebp;
}

async function fetchWithTimeout(fetcher, url, init = {}, timeoutMs = UPSTREAM_FETCH_TIMEOUT_MS) {
  if (fetcher !== fetch) {
    return fetcher(url, init);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryFetchImageUrl(url, fetcher = fetch, headers = UPSTREAM_IMAGE_HEADERS) {
  if (typeof fetcher !== 'function' || !isAllowedExternalImageUrl(url)) {
    return null;
  }
  try {
    const response = await fetchWithTimeout(fetcher, url, { headers });
    if (!response.ok || typeof response.arrayBuffer !== 'function') {
      return null;
    }

    const contentType = (response.headers?.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (contentType && !contentType.startsWith('image/')) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (!isValidImageBuffer(bytes, contentType || 'image/png')) {
      return null;
    }

    const inferredType =
      bytes[0] === 0x89
        ? 'image/png'
        : bytes[0] === 0xff
          ? 'image/jpeg'
          : 'image/webp';

    return {
      ok: true,
      statusCode: 200,
      contentType: contentType || inferredType,
      bytes,
      base64Body: Buffer.from(bytes).toString('base64'),
    };
  } catch {
    return null;
  }
}

function normalizeMatchToken(value) {
  return normalizeSearchText(String(value || ''), 120)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TEAM_ALIAS_GROUPS = [
  ['man city', 'manchester city', 'mci'],
  ['man utd', 'man united', 'manchester united', 'mun'],
  ['spurs', 'tottenham', 'tottenham hotspur', 'tot'],
  ['wolves', 'wolverhampton', 'wolverhampton wanderers', 'wol'],
  ['nottm forest', 'nottingham forest', 'nfo'],
  ['newcastle', 'newcastle united', 'new'],
  ['brighton', 'brighton and hove albion', 'bha'],
  ['west ham', 'west ham united', 'whu'],
  ['aston villa', 'avl'],
  ['crystal palace', 'cry'],
  ['leicester', 'leicester city', 'lei'],
  ['ipswich', 'ipswich town', 'ips'],
  ['leeds', 'leeds united', 'lee'],
  ['sunderland', 'sun'],
  ['burnley', 'bur'],
  ['freiburg', 'sc freiburg'],
];

function teamNamesMatch(candidateTeam, targetTeam) {
  const normCandidate = normalizeMatchToken(candidateTeam);
  const normTarget = normalizeMatchToken(targetTeam);
  if (!normCandidate || !normTarget) {
    return false;
  }
  if (normCandidate.includes(normTarget) || normTarget.includes(normCandidate)) {
    return true;
  }
  for (const group of TEAM_ALIAS_GROUPS) {
    const inGroupCandidate = group.some((alias) => normCandidate.includes(alias));
    const inGroupTarget = group.some((alias) => normTarget.includes(alias));
    if (inGroupCandidate && inGroupTarget) {
      return true;
    }
  }
  return false;
}

function hasNameTokenMatch(candidateText, targetName, targetWebName = '') {
  const normCandidate = normalizeMatchToken(candidateText);
  if (!normCandidate) {
    return false;
  }
  const tokens = [
    ...normalizeMatchToken(targetName).split(' '),
    ...normalizeMatchToken(targetWebName).split(' '),
  ].filter((t) => t.length >= 3);

  if (tokens.length === 0) {
    return true;
  }
  return tokens.some((token) => normCandidate.includes(token));
}

/**
 * @param {string} [teamName]
 * @param {number | string | null} [teamCode]
 */
export function resolveClubSourceConfig(teamName = '', teamCode = null) {
  const validCode = validatePlayerPhotoCode(teamCode);
  const codeNum = validCode ? Number(validCode) : null;
  if (codeNum !== null) {
    const byCode = CLUB_PLAYER_SOURCES.find((c) => c.teamCodes.includes(codeNum));
    if (byCode) {
      return byCode;
    }
  }

  const normTeam = normalizeMatchToken(teamName);
  if (!normTeam) {
    return null;
  }

  return (
    CLUB_PLAYER_SOURCES.find((c) =>
      c.aliases.some((alias) => normTeam === alias || normTeam.includes(alias)),
    ) || null
  );
}

export function buildPlayerSlugCandidates(name = '', webName = '') {
  const toSlug = (input) =>
    normalizeSearchText(input, 100)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .trim()
      .replace(/\s+/g, '-');

  const slugs = [];
  const pushSlug = (slug) => {
    if (slug && slug.length >= 2 && !slugs.includes(slug)) {
      slugs.push(slug);
    }
  };

  const normName = normalizeSearchText(name, 100);
  pushSlug(toSlug(normName));

  const parts = normName.split(' ').filter(Boolean);
  if (parts.length >= 3) {
    pushSlug(toSlug(`${parts[0]} ${parts[parts.length - 1]}`));
  }

  pushSlug(toSlug(webName));
  return slugs;
}

const GENERIC_SHARE_IMAGE_PATTERN =
  /(share-card|og-image|default-og|club-crest|site-logo|favicon|placeholder|\/logo\.png)/i;

export function extractClubPortraitUrlFromHtml(html, baseOrigin, clubConfig, slugCandidates = []) {
  if (typeof html !== 'string' || !html.trim()) {
    return null;
  }

  const resolveUrl = (raw) => {
    if (!raw || typeof raw !== 'string') {
      return null;
    }
    const cleaned = raw.replace(/&amp;/g, '&').trim();
    if (!cleaned || cleaned.startsWith('data:')) {
      return null;
    }
    try {
      const resolved = new URL(cleaned, baseOrigin).toString();
      return isAllowedExternalImageUrl(resolved) ? resolved : null;
    } catch {
      return null;
    }
  };

  const candidates = [];
  const pushCandidate = (rawUrl, score) => {
    const resolved = resolveUrl(rawUrl);
    if (!resolved || GENERIC_SHARE_IMAGE_PATTERN.test(resolved)) {
      return;
    }
    candidates.push({ url: resolved, score });
  };

  // 1. OpenGraph image meta tag (e.g. Chelsea Cloudinary avatar)
  const ogMatches = [
    ...html.matchAll(
      /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    ),
    ...html.matchAll(
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["'][^>]*>/gi,
    ),
  ];
  for (const m of ogMatches) {
    pushCandidate(m[1], 40);
  }

  // 2. JSON-LD or embedded portrait/avatar URLs inside HTML
  const slugTokens = slugCandidates
    .flatMap((s) => s.split('-'))
    .filter((t) => t.length >= 3);

  const urlRegex = /https:\/\/[^"'\s<>]+\.(?:png|jpg|jpeg|webp)(?:\?[^"'\s<>]*)?/gi;
  for (const match of html.matchAll(urlRegex)) {
    const candidate = match[0];
    const lower = candidate.toLowerCase();
    let score = 0;
    if (clubConfig?.imageHostHints?.some((hint) => lower.includes(hint))) {
      score += 30;
    }
    if (slugTokens.some((token) => lower.includes(token))) {
      score += 35;
    }
    if (/(avatar|portrait|headshot|player|squad)/i.test(lower)) {
      score += 15;
    }
    if (score >= 30) {
      pushCandidate(candidate, score);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

/**
 * @param {{
 *   name?: string | null,
 *   webName?: string | null,
 *   team?: string | null,
 *   teamCode?: string | number | null,
 * }} [options]
 * @param {(input: string, init?: any) => Promise<any>} [fetcher]
 */
export async function searchOfficialClubPlayerPhotoUrl(
  { name = '', webName = '', team = '', teamCode = null } = {},
  fetcher = fetch,
) {
  if (typeof fetcher !== 'function') {
    return null;
  }
  const clubConfig = resolveClubSourceConfig(team, teamCode);
  if (!clubConfig) {
    return null;
  }

  const slugs = buildPlayerSlugCandidates(name, webName);
  if (slugs.length === 0) {
    return null;
  }

  for (const slug of slugs) {
    const profileUrls = clubConfig.profileUrls(slug);
    for (const profileUrl of profileUrls) {
      if (!isAllowedExternalImageUrl(profileUrl)) {
        continue;
      }
      try {
        const response = await fetchWithTimeout(fetcher, profileUrl, {
          headers: CLUB_HTML_HEADERS,
        });
        if (!response.ok) {
          continue;
        }
        const contentType = (response.headers?.get('content-type') ?? '').toLowerCase();
        if (contentType.includes('application/json') && typeof response.json === 'function') {
          const json = await response.json();
          const directJsonUrl =
            json?.image || json?.photoUrl || json?.avatar || json?.player?.image || null;
          if (isAllowedExternalImageUrl(directJsonUrl)) {
            return directJsonUrl.trim();
          }
          continue;
        }
        if (typeof response.text !== 'function') {
          continue;
        }
        const html = await response.text();
        const origin = new URL(profileUrl).origin;
        const portraitUrl = extractClubPortraitUrlFromHtml(html, origin, clubConfig, slugs);
        if (portraitUrl) {
          return portraitUrl;
        }
      } catch {
        // Try next profile URL or slug
      }
    }
  }

  return null;
}

export function buildTheSportsDbSearchQueries(name, webName = '') {
  const cleanName = normalizeSearchText(name);
  const cleanWebName = normalizeSearchText(webName);
  const rawName = cleanPlayerQueryText(name);

  const queries = [];
  const pushUnique = (q) => {
    if (q && q.length >= 2 && !queries.includes(q)) {
      queries.push(q);
    }
  };

  pushUnique(cleanName);
  pushUnique(rawName);

  // If fullName has 3+ tokens (middle names), also try first + last
  const parts = cleanName.split(' ').filter(Boolean);
  if (parts.length >= 3) {
    pushUnique(`${parts[0]} ${parts[parts.length - 1]}`);
  }

  pushUnique(cleanWebName);
  return queries;
}

export function buildWikipediaSearchQueries(name, webName = '', team = '') {
  const cleanName = normalizeSearchText(name);
  const cleanWebName = normalizeSearchText(webName);
  const cleanTeam = normalizeSearchText(team);

  const queries = [];
  const pushUnique = (q) => {
    if (q && !queries.includes(q)) {
      queries.push(q);
    }
  };

  if (cleanName) {
    if (cleanTeam) {
      pushUnique(`${cleanName} ${cleanTeam} football`);
    }
    pushUnique(`${cleanName} footballer`);
  }

  if (cleanWebName && cleanWebName.toLowerCase() !== cleanName.toLowerCase()) {
    if (cleanTeam) {
      pushUnique(`${cleanWebName} ${cleanTeam} football`);
    }
    pushUnique(`${cleanWebName} footballer`);
  }

  return queries;
}

export function selectBestSportsDbImageUrl(players, targetName, targetWebName = '', targetTeam = '') {
  if (!Array.isArray(players) || players.length === 0) {
    return null;
  }

  const normTargetName = normalizeMatchToken(targetName);
  const normWebName = normalizeMatchToken(targetWebName);

  let bestUrl = null;
  let bestScore = -1;

  for (const player of players) {
    if (!player || typeof player !== 'object') {
      continue;
    }

    const sport = normalizeMatchToken(player.strSport);
    if (sport && sport !== 'soccer' && sport !== 'football') {
      continue;
    }

    const cutout = isAllowedExternalImageUrl(player.strCutout) ? player.strCutout.trim() : '';
    const thumb = isAllowedExternalImageUrl(player.strThumb) ? player.strThumb.trim() : '';
    const imageUrl = cutout || thumb;
    if (!imageUrl) {
      continue;
    }

    if (!hasNameTokenMatch(player.strPlayer, targetName, targetWebName)) {
      continue;
    }

    let score = 0;
    const candidateName = normalizeMatchToken(player.strPlayer);
    if (normTargetName && candidateName === normTargetName) {
      score += 50;
    } else if (normTargetName && candidateName.includes(normTargetName)) {
      score += 30;
    } else if (normWebName && candidateName.includes(normWebName)) {
      score += 15;
    }

    if (targetTeam && teamNamesMatch(player.strTeam, targetTeam)) {
      score += 40;
    }

    if (cutout) {
      score += 20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestUrl = imageUrl;
    }
  }

  return bestUrl;
}

export async function searchTheSportsDbPlayerPhotoUrl(
  name,
  webName = '',
  team = '',
  fetcher = fetch,
) {
  if (typeof fetcher !== 'function') {
    return null;
  }
  const queries = buildTheSportsDbSearchQueries(name, webName);
  if (queries.length === 0) {
    return null;
  }

  for (const query of queries) {
    try {
      const url = `${THESPORTSDB_SEARCH_BASE}?p=${encodeURIComponent(query)}`;
      const response = await fetchWithTimeout(fetcher, url, { headers: API_JSON_HEADERS });
      if (!response.ok || typeof response.json !== 'function') {
        continue;
      }
      const json = await response.json();
      const players = Array.isArray(json?.player) ? json.player : [];
      const selected = selectBestSportsDbImageUrl(players, name || webName, webName, team);
      if (selected) {
        return selected;
      }
    } catch {
      // Try next query variant
    }
  }

  return null;
}

const FOOTBALL_EXTRACT_KEYWORDS = [
  'football',
  'soccer',
  'midfielder',
  'forward',
  'striker',
  'defender',
  'goalkeeper',
  'winger',
  'premier league',
  'bundesliga',
  'la liga',
  'serie a',
  'ligue 1',
  'champions league',
  'national team',
  'fc',
];

export function isFootballWikipediaPage(page, targetName = '', targetWebName = '', targetTeam = '') {
  if (!page || typeof page !== 'object') {
    return false;
  }
  const title = typeof page.title === 'string' ? page.title : '';
  const extract = typeof page.extract === 'string' ? page.extract : '';
  if (!title && !extract) {
    return true;
  }

  const combined = normalizeMatchToken(`${title} ${extract}`);
  if (!combined) {
    return false;
  }

  const nameMatches = hasNameTokenMatch(`${title} ${extract}`, targetName, targetWebName);
  if (!nameMatches) {
    return false;
  }

  const hasFootballTerm = FOOTBALL_EXTRACT_KEYWORDS.some((kw) => combined.includes(kw));
  const hasTeamTerm = targetTeam ? teamNamesMatch(combined, targetTeam) : false;

  return hasFootballTerm || hasTeamTerm;
}

export function extractWikipediaThumbnailUrl(
  apiPayload,
  targetName = '',
  targetWebName = '',
  targetTeam = '',
) {
  const pages = apiPayload?.query?.pages;
  if (!pages || typeof pages !== 'object') {
    return null;
  }

  const candidates = [];
  for (const page of Object.values(pages)) {
    if (!page || typeof page !== 'object') {
      continue;
    }
    const source = page.thumbnail?.source;
    if (!isAllowedExternalImageUrl(source)) {
      continue;
    }
    if (!isFootballWikipediaPage(page, targetName, targetWebName, targetTeam)) {
      continue;
    }

    let score = 0;
    const titleAndExtract = normalizeMatchToken(`${page.title || ''} ${page.extract || ''}`);
    if (targetTeam && teamNamesMatch(titleAndExtract, targetTeam)) {
      score += 30;
    }
    if (hasNameTokenMatch(page.title || '', targetName, targetWebName)) {
      score += 20;
    }
    if (typeof page.index === 'number') {
      score -= page.index;
    }

    candidates.push({ url: source.trim(), score });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

export async function searchWikipediaPlayerPhotoUrl(
  name,
  webName = '',
  team = '',
  fetcher = fetch,
) {
  if (typeof fetcher !== 'function') {
    return null;
  }
  const queries = buildWikipediaSearchQueries(name, webName, team);
  if (queries.length === 0) {
    return null;
  }

  for (const query of queries) {
    try {
      const url = `${WIKIPEDIA_API_BASE}?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&prop=pageimages|extracts&exintro=1&explaintext=1&exsentences=3&pithumbsize=300&format=json`;
      const response = await fetchWithTimeout(fetcher, url, { headers: API_JSON_HEADERS });
      if (!response.ok || typeof response.json !== 'function') {
        continue;
      }
      const json = await response.json();
      const thumbUrl = extractWikipediaThumbnailUrl(json, name || webName, webName, team);
      if (thumbUrl) {
        return thumbUrl;
      }
    } catch {
      // Try next query variant
    }
  }

  return null;
}

/**
 * @param {{ ok: boolean, statusCode: number, contentType: string, bytes: Uint8Array, base64Body: string }} asset
 * @param {string | null | undefined} [apiKey]
 * @param {(input: string, init?: RequestInit) => Promise<any>} [fetcher]
 */
export async function removeBackgroundIfConfigured(
  asset,
  apiKey = process.env.REMOVE_BG_API_KEY,
  fetcher = fetch,
) {
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!cleanKey || !asset || !asset.bytes || typeof fetcher !== 'function') {
    return { ...asset, bgRemoved: false };
  }

  try {
    const formData = new FormData();
    formData.append(
      'image_file',
      new Blob([asset.bytes], { type: asset.contentType || 'image/png' }),
      'player.png',
    );
    formData.append('size', 'auto');

    const response = await fetchWithTimeout(
      fetcher,
      REMOVE_BG_API_URL,
      {
        method: 'POST',
        headers: {
          'X-Api-Key': cleanKey,
        },
        body: formData,
      },
      REMOVE_BG_TIMEOUT_MS,
    );

    if (!response.ok || typeof response.arrayBuffer !== 'function') {
      return { ...asset, bgRemoved: false };
    }

    const outType = (response.headers?.get('content-type') ?? 'image/png')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const outBuffer = await response.arrayBuffer();
    const outBytes = new Uint8Array(outBuffer);

    if (!isValidImageBuffer(outBytes, outType)) {
      return { ...asset, bgRemoved: false };
    }

    return {
      ok: true,
      statusCode: 200,
      contentType: outType.startsWith('image/') ? outType : 'image/png',
      bytes: outBytes,
      base64Body: Buffer.from(outBytes).toString('base64'),
      bgRemoved: true,
    };
  } catch {
    return { ...asset, bgRemoved: false };
  }
}

let cachedSharpImporter = null;

async function getSharpFn() {
  if (cachedSharpImporter === false) {
    return null;
  }
  if (typeof cachedSharpImporter === 'function') {
    return cachedSharpImporter;
  }
  try {
    const sharpPkg = 'sharp';
    const mod = await import(/* @vite-ignore */ sharpPkg);
    const fn = mod?.default ?? mod;
    if (typeof fn === 'function') {
      cachedSharpImporter = fn;
      return fn;
    }
  } catch {
    // sharp not installed or unavailable in this runtime
  }
  cachedSharpImporter = false;
  return null;
}

/**
 * Resizes a fetched/background-removed image asset to an exact 250x250 PNG
 * using sharp when available, falling back safely to the original asset.
 * @param {{ ok?: boolean, statusCode?: number, contentType?: string, bytes?: Uint8Array, base64Body?: string, [key: string]: any }} asset
 * @param {any} [sharpOverride]
 */
export async function resizeImageTo250Png(asset, sharpOverride = undefined) {
  if (!asset || !asset.bytes) {
    return { ...asset, resized250: false };
  }

  try {
    const sharpFn = sharpOverride === undefined ? await getSharpFn() : sharpOverride;
    if (typeof sharpFn !== 'function') {
      return { ...asset, resized250: false };
    }

    const outBuffer = await sharpFn(Buffer.from(asset.bytes))
      .resize(TARGET_PHOTO_SIZE, TARGET_PHOTO_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const outBytes = new Uint8Array(outBuffer);
    if (!isValidImageBuffer(outBytes, 'image/png')) {
      return { ...asset, resized250: false };
    }

    return {
      ...asset,
      ok: true,
      statusCode: 200,
      contentType: 'image/png',
      bytes: outBytes,
      base64Body: Buffer.from(outBytes).toString('base64'),
      resized250: true,
    };
  } catch {
    return { ...asset, resized250: false };
  }
}

async function processExternalPortraitAsset(asset, removeBgApiKey, fetcher, sharpOverride) {
  try {
    const bgProcessed = await removeBackgroundIfConfigured(asset, removeBgApiKey, fetcher);
    const resized = await resizeImageTo250Png(bgProcessed, sharpOverride);
    return {
      contentType: resized?.contentType || asset.contentType || 'image/png',
      base64Body: resized?.base64Body || asset.base64Body,
      bgRemoved: Boolean(bgProcessed?.bgRemoved),
      resized250: Boolean(resized?.resized250),
    };
  } catch {
    return {
      contentType: asset.contentType || 'image/png',
      base64Body: asset.base64Body,
      bgRemoved: false,
      resized250: false,
    };
  }
}

/**
 * Executes the 5-step player photo lookup pipeline (steps 1–4 server-side; step 5 on UI):
 * 1. Custom uploaded player folder (`public/custom-players/`)
 * 2. Official Premier League endpoints
 * 3. Official Club Sources (with bg removal + 250x250 PNG resize)
 * 4. Alternative External Sources: TheSportsDB + Wikipedia/Wikimedia (with bg removal + 250x250 PNG resize)
 *
 * @param {{
 *   code?: string | number | null,
 *   photoCode?: string | number | null,
 *   firstName?: string | null,
 *   secondName?: string | null,
 *   name?: string | null,
 *   webName?: string | null,
 *   team?: string | null,
 *   teamCode?: string | number | null,
 *   removeBgApiKey?: string | null,
 *   customPlayersDirs?: string[] | null,
 *   sharp?: any,
 * } | string | number | null | undefined} codeOrOptions
 * @param {string | number | null | undefined} [photoCode]
 * @param {(input: string, init?: any) => Promise<any>} [fetcher]
 */
export async function fetchPlayerPhotoAsset(
  codeOrOptions,
  photoCode = null,
  fetcher = fetch,
) {
  const options =
    codeOrOptions && typeof codeOrOptions === 'object'
      ? codeOrOptions
      : { code: codeOrOptions, photoCode };

  const validCode = validatePlayerPhotoCode(options.code);
  const validPhotoCode = validatePlayerPhotoCode(options.photoCode);
  const firstName = cleanPlayerQueryText(options.firstName);
  const secondName = cleanPlayerQueryText(options.secondName);
  const webName = cleanPlayerQueryText(options.webName);
  const name = resolveFullPlayerName({
    name: options.name,
    firstName,
    secondName,
  });
  const team = cleanPlayerQueryText(options.team);
  const teamCode = validatePlayerPhotoCode(options.teamCode);
  const removeBgApiKey =
    options.removeBgApiKey !== undefined ? options.removeBgApiKey : process.env.REMOVE_BG_API_KEY;
  const customPlayersDirs = options.customPlayersDirs;
  const sharpOverride = options.sharp;

  if (!validCode && !validPhotoCode && !name && !webName) {
    return { ok: false, statusCode: 400, error: 'INVALID_CODE' };
  }

  // Step 1: Custom Uploaded Player Folder (Highest Priority — before any external request)
  try {
    const customAsset = await findCustomPlayerPhotoAsset({
      webName,
      name,
      customPlayersDirs,
    });
    if (customAsset) {
      return {
        ok: true,
        statusCode: 200,
        contentType: customAsset.contentType,
        base64Body: customAsset.base64Body,
        source: 'custom-folder',
        cacheControl: PLAYER_PHOTO_CACHE_CONTROL,
      };
    }
  } catch {
    // Continue to Step 2 if custom folder lookup fails
  }

  // Step 2: Official Premier League Endpoints
  if (validCode || validPhotoCode) {
    try {
      const plUrls = buildUpstreamPhotoUrls(validCode, validPhotoCode);
      for (const url of plUrls) {
        const asset = await tryFetchImageUrl(url, fetcher, UPSTREAM_IMAGE_HEADERS);
        if (asset) {
          return {
            ok: true,
            statusCode: 200,
            contentType: asset.contentType,
            base64Body: asset.base64Body,
            source: 'premierleague',
            cacheControl: PLAYER_PHOTO_CACHE_CONTROL,
          };
        }
      }
    } catch {
      // Continue to Step 3 if Premier League fetch fails
    }
  }

  // Step 3: Official Club Sources (with Background Removal + 250x250 PNG Resize)
  if ((team || teamCode) && (name || webName)) {
    try {
      const clubUrl = await searchOfficialClubPlayerPhotoUrl(
        { name, webName, team, teamCode },
        fetcher,
      );
      if (clubUrl) {
        const asset = await tryFetchImageUrl(clubUrl, fetcher, {
          'User-Agent': UPSTREAM_IMAGE_HEADERS['User-Agent'],
          Accept: UPSTREAM_IMAGE_HEADERS.Accept,
        });
        if (asset) {
          const processed = await processExternalPortraitAsset(
            asset,
            removeBgApiKey,
            fetcher,
            sharpOverride,
          );
          return {
            ok: true,
            statusCode: 200,
            contentType: processed.contentType,
            base64Body: processed.base64Body,
            source: 'official-club',
            bgRemoved: processed.bgRemoved,
            resized250: processed.resized250,
            cacheControl: PLAYER_PHOTO_EXTERNAL_CACHE_CONTROL,
          };
        }
      }
    } catch {
      // Continue to Step 4 if club source lookup fails
    }
  }

  // Step 4: Alternative External Sources — TheSportsDB & Wikipedia/Wikimedia (with Bg Removal + 250x250 PNG Resize)
  if (name || webName) {
    try {
      const sportsDbUrl = await searchTheSportsDbPlayerPhotoUrl(name, webName, team, fetcher);
      if (sportsDbUrl) {
        const asset = await tryFetchImageUrl(sportsDbUrl, fetcher, {
          'User-Agent': UPSTREAM_IMAGE_HEADERS['User-Agent'],
          Accept: UPSTREAM_IMAGE_HEADERS.Accept,
        });
        if (asset) {
          const processed = await processExternalPortraitAsset(
            asset,
            removeBgApiKey,
            fetcher,
            sharpOverride,
          );
          return {
            ok: true,
            statusCode: 200,
            contentType: processed.contentType,
            base64Body: processed.base64Body,
            source: 'thesportsdb',
            bgRemoved: processed.bgRemoved,
            resized250: processed.resized250,
            cacheControl: PLAYER_PHOTO_EXTERNAL_CACHE_CONTROL,
          };
        }
      }
    } catch {
      // Continue to Wikipedia fallback
    }

    try {
      const wikiUrl = await searchWikipediaPlayerPhotoUrl(name, webName, team, fetcher);
      if (wikiUrl) {
        const asset = await tryFetchImageUrl(wikiUrl, fetcher, {
          'User-Agent': API_JSON_HEADERS['User-Agent'],
          Accept: UPSTREAM_IMAGE_HEADERS.Accept,
        });
        if (asset) {
          const processed = await processExternalPortraitAsset(
            asset,
            removeBgApiKey,
            fetcher,
            sharpOverride,
          );
          return {
            ok: true,
            statusCode: 200,
            contentType: processed.contentType,
            base64Body: processed.base64Body,
            source: 'wikipedia',
            bgRemoved: processed.bgRemoved,
            resized250: processed.resized250,
            cacheControl: PLAYER_PHOTO_EXTERNAL_CACHE_CONTROL,
          };
        }
      }
    } catch {
      // Fall through cleanly to 404
    }
  }

  return { ok: false, statusCode: 404, error: 'PHOTO_NOT_FOUND' };
}

const photoCache = new Map();
const photoInFlight = new Map();

export function resetPlayerPhotoCacheForTests() {
  photoCache.clear();
  photoInFlight.clear();
}

/**
 * @param {{
 *   code?: string | number | null,
 *   photoCode?: string | number | null,
 *   firstName?: string | null,
 *   secondName?: string | null,
 *   name?: string | null,
 *   webName?: string | null,
 *   team?: string | null,
 *   teamCode?: string | number | null,
 *   removeBgApiKey?: string | null,
 *   customPlayersDirs?: string[] | null,
 *   sharp?: any,
 * } | string | number | null | undefined} codeOrOptions
 * @param {string | number | null | undefined} [photoCode]
 * @param {number} [nowMs]
 * @param {(input: string, init?: any) => Promise<any>} [fetcher]
 */
export async function getPlayerPhotoWithCache(
  codeOrOptions,
  photoCode = null,
  nowMs = Date.now(),
  fetcher = fetch,
) {
  const options =
    codeOrOptions && typeof codeOrOptions === 'object'
      ? codeOrOptions
      : { code: codeOrOptions, photoCode };

  const validCode = validatePlayerPhotoCode(options.code);
  const validPhotoCode = validatePlayerPhotoCode(options.photoCode);
  const firstName = cleanPlayerQueryText(options.firstName);
  const secondName = cleanPlayerQueryText(options.secondName);
  const webName = cleanPlayerQueryText(options.webName);
  const name = resolveFullPlayerName({
    name: options.name,
    firstName,
    secondName,
  });
  const team = cleanPlayerQueryText(options.team);
  const teamCode = validatePlayerPhotoCode(options.teamCode);

  if (!validCode && !validPhotoCode && !name && !webName) {
    return { ok: false, statusCode: 400, error: 'INVALID_CODE', cacheState: 'BYPASS' };
  }

  const cacheKey = [
    validCode ?? '',
    validPhotoCode ?? '',
    normalizeSearchText(name).toLowerCase(),
    normalizeSearchText(webName).toLowerCase(),
    normalizeSearchText(team).toLowerCase(),
    teamCode ?? '',
  ].join(':');

  const existing = photoCache.get(cacheKey);
  if (existing) {
    const ttl = existing.result.ok
      ? existing.result.source === 'premierleague' || existing.result.source === 'custom-folder'
        ? PHOTO_CACHE_TTL_MS
        : PHOTO_EXTERNAL_CACHE_TTL_MS
      : PHOTO_MISS_CACHE_TTL_MS;
    if (nowMs - existing.cachedAt < ttl) {
      return { ...existing.result, cacheState: 'HIT' };
    }
  }

  let pending = photoInFlight.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      try {
        let result;
        try {
          result = await fetchPlayerPhotoAsset(
            {
              code: validCode,
              photoCode: validPhotoCode,
              firstName,
              secondName,
              name,
              webName,
              team,
              teamCode,
              removeBgApiKey: options.removeBgApiKey,
              customPlayersDirs: options.customPlayersDirs,
              sharp: options.sharp,
            },
            null,
            fetcher,
          );
        } catch {
          result = { ok: false, statusCode: 404, error: 'PHOTO_NOT_FOUND' };
        }

        if (result.statusCode !== 400) {
          if (photoCache.size >= PHOTO_CACHE_MAX_ENTRIES) {
            const oldestKey = photoCache.keys().next().value;
            if (oldestKey !== undefined) {
              photoCache.delete(oldestKey);
            }
          }
          photoCache.set(cacheKey, { result, cachedAt: nowMs });
        }

        return result;
      } finally {
        photoInFlight.delete(cacheKey);
      }
    })();
    photoInFlight.set(cacheKey, pending);
  }

  const resolvedResult = await pending;
  return { ...resolvedResult, cacheState: 'MISS' };
}
