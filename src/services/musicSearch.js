import { extractYouTubeId, getVideoDetails, searchYouTube, callYouTubeApi } from './youtube';

const YT_CACHE_KEY = 'syncbeats_yt_resolved_cache';

function getResolvedCache() {
  try {
    const raw = localStorage.getItem(YT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveResolvedCache(cache) {
  try {
    localStorage.setItem(YT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) { }
}

const COUNTRY_MAP = {
  all: '',
  ja: 'JP',
  ko: 'KR',
  en: 'US',
};

const RSS_FEED_MAP = {
  all: 'https://itunes.apple.com/us/rss/topsongs/limit=20/json',
  ja: 'https://itunes.apple.com/jp/rss/topsongs/limit=20/json',
  ko: 'https://itunes.apple.com/kr/rss/topsongs/limit=20/json',
  en: 'https://itunes.apple.com/us/rss/topsongs/limit=20/json',
};

/**
 * Searches Apple iTunes Music Catalog with language/country filtering.
 * @param {string} query - The search term
 * @param {string} langFilter - 'all' | 'ja' | 'ko' | 'en'
 */
export async function searchMusic(query, langFilter = 'all') {
  if (!query || !query.trim()) return [];

  // If user pasted a direct YouTube URL, fallback directly to YouTube ID extraction
  const directYtId = extractYouTubeId(query.trim());
  if (directYtId) {
    const details = await getVideoDetails([directYtId]);
    return details.map(d => ({
      ...d,
      isDirectYouTube: true,
      album: 'YouTube Video',
      previewUrl: null,
    }));
  }

  const countryParam = COUNTRY_MAP[langFilter] ? `&country=${COUNTRY_MAP[langFilter]}` : '';
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query.trim())}&entity=song${countryParam}&limit=25`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('iTunes search failed');
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      return await searchYouTube(query);
    }

    return data.results.map(item => ({
      id: item.trackId,
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName || '',
      thumbnail: (item.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
      duration: Math.round((item.trackTimeMillis || 0) / 1000),
      previewUrl: item.previewUrl || null,
      genre: item.primaryGenreName || 'Music',
      country: item.country || '',
      youtubeId: null,
    }));
  } catch (err) {
    console.warn('iTunes search failed, falling back to YouTube:', err);
    return await searchYouTube(query);
  }
}

/**
 * Fetches Apple Music Top Trending Songs for specific region/language.
 * @param {string} langFilter - 'all' | 'ja' | 'ko' | 'en'
 */
export async function getTopTrendingSongs(langFilter = 'all') {
  const feedUrl = RSS_FEED_MAP[langFilter] || RSS_FEED_MAP.all;

  try {
    const res = await fetch(feedUrl);
    if (!res.ok) throw new Error('Failed to fetch top songs');
    const data = await res.json();
    const entries = data.feed?.entry || [];

    return entries.map(entry => {
      const images = entry['im:image'] || [];
      const bestImage = images[images.length - 1]?.label || '';
      const previewLink = entry.link?.find(l => l.attributes?.rel === 'enclosure')?.attributes?.href || null;

      return {
        id: entry.id?.attributes?.['im:id'] || Math.random(),
        title: entry['im:name']?.label || '',
        artist: entry['im:artist']?.label || '',
        album: entry['im:collection']?.['im:name']?.label || '',
        thumbnail: bestImage.replace('170x170bb', '600x600bb'),
        duration: 210,
        previewUrl: previewLink,
        genre: entry.category?.attributes?.label || 'Top Hit',
        youtubeId: null,
      };
    });
  } catch (e) {
    console.warn('Failed to load top trending songs:', e);
    return [];
  }
}

/**
 * Resolves the matching YouTube video ID for a song (title + artist).
 * Used both when adding a track and when playing a track whose id is still pending.
 * All requests go through callYouTubeApi (dev proxy + Capacitor fallback), and the
 * API key comes only from VITE_YOUTUBE_API_KEY.
 */
export async function resolveYouTubeId(track) {
  if (track.youtubeId) return track.youtubeId;

  const cacheKey = `${track.title} - ${track.artist}`.toLowerCase().trim();
  const cache = getResolvedCache();
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const cleanTitle = (track.title || '').replace(/\(.*\)|\[.*\]/g, '').trim();
  const artist = track.artist || '';
  const queries = [
    `${cleanTitle} ${artist} official audio`.trim(), // 1. most precise
    `${cleanTitle} ${artist}`.trim(),                // 2. broader fallback
  ];

  let lastError = null;

  for (const q of queries) {
    try {
      const { ok, data } = await callYouTubeApi('search', {
        part: 'snippet',
        type: 'video',
        videoEmbeddable: 'true',
        maxResults: 3,
        q,
      });

      const vId = ok ? data?.items?.[0]?.id?.videoId : null;
      if (vId) {
        cache[cacheKey] = vId;
        saveResolvedCache(cache);
        return vId;
      }

      if (data?.error) {
        lastError = data.error.message || 'YouTube API error';
        console.warn('[SyncBeats] YouTube API error:', data.error.code, lastError);
        // Key / quota / referrer problems won't be fixed by retrying with another query
        if ([400, 403].includes(data.error.code)) break;
      }
    } catch (e) {
      lastError = e.message;
      console.warn('[SyncBeats] YouTube lookup attempt failed:', e);
    }
  }

  throw new Error(
    lastError
      ? `YouTube lookup failed: ${lastError}`
      : 'Unable to find YouTube stream for ' + track.title
  );
}