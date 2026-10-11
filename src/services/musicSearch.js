import { extractYouTubeId, getVideoDetails, searchYouTube } from './youtube';

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || 'AIzaSyBskLIkwY1zBmHwl0EuFTF2RHzb5giShko';
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
  } catch (e) {}
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
 * Resolves the matching YouTube video ID for an iTunes song.
 */
export async function resolveYouTubeId(track) {
  if (track.youtubeId) return track.youtubeId;

  const cacheKey = `${track.title} - ${track.artist}`.toLowerCase().trim();
  const cache = getResolvedCache();
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const searchQuery = `${track.title} ${track.artist} audio`;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=1&q=${encodeURIComponent(searchQuery)}&key=${YOUTUBE_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const item = data.items?.[0];
    if (item && item.id?.videoId) {
      const vId = item.id.videoId;
      cache[cacheKey] = vId;
      saveResolvedCache(cache);
      return vId;
    }
  } catch (e) {
    console.warn('Category search failed, falling back:', e);
  }

  try {
    const fallbackUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(`${track.title} ${track.artist}`)}&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(fallbackUrl);
    const data = await res.json();
    const item = data.items?.[0];
    if (item && item.id?.videoId) {
      const vId = item.id.videoId;
      cache[cacheKey] = vId;
      saveResolvedCache(cache);
      return vId;
    }
  } catch (e) {
    console.error('All YouTube resolution attempts failed:', e);
  }

  throw new Error('Unable to find YouTube stream for ' + track.title);
}
