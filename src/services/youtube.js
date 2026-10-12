const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || 'AIzaSyBskLIkwY1zBmHwl0EuFTF2RHzb5giShko';

export function decodeHtmlEntities(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str || '';
  return txt.value;
}

export function parseIso8601Duration(iso) {
  if (!iso) return 0;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function extractYouTubeId(url) {
  const pattern = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = String(url).match(pattern);
  return match ? match[1] : null;
}

async function fetchWithCapacitorFallback(url) {
  try {
    const cap = window.Capacitor;
    if (cap) {
      if (typeof cap.nativePromise === 'function') {
        const nativeRes = await cap.nativePromise('CapacitorHttp', 'request', {
          url: url,
          method: 'GET',
          headers: { 'Referer': 'http://localhost:5173' }
        });
        if (nativeRes && typeof nativeRes.status === 'number') {
          const data = (typeof nativeRes.data === 'string') ? JSON.parse(nativeRes.data) : nativeRes.data;
          return { ok: nativeRes.status >= 200 && nativeRes.status < 300, data };
        }
      }
      const capHttp = cap.Plugins?.CapacitorHttp;
      if (capHttp && typeof capHttp.get === 'function') {
        const res = await capHttp.get({
          url: url,
          headers: { 'Referer': 'http://localhost:5173' }
        });
        const data = (typeof res.data === 'string') ? JSON.parse(res.data) : res.data;
        return { ok: true, data };
      }
    }
  } catch (err) {
    console.warn('[YouTube API] Native Capacitor request failed, falling back to fetch', err);
  }

  const res = await fetch(url);
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function callYouTubeApi(endpoint, params = {}) {
  const queryStr = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // 1. Try local Vite dev proxy first (automatically attaches Referer: http://localhost:5173/)
  try {
    const proxyUrl = `/api/youtube/${endpoint}?${queryStr}&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      if (!data.error) {
        return { ok: true, data };
      }
    }
  } catch (e) {}

  // 2. Direct request with Capacitor fallback
  const directUrl = `https://www.googleapis.com/youtube/v3/${endpoint}?${queryStr}&key=${YOUTUBE_API_KEY}`;
  return await fetchWithCapacitorFallback(directUrl);
}

export async function searchYouTube(query) {
  if (!query || !query.trim()) return [];

  // Check if direct YouTube URL was pasted
  const directId = extractYouTubeId(query.trim());
  if (directId) {
    return await getVideoDetails([directId]);
  }

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=15&q=${encodeURIComponent(query.trim())}&key=${YOUTUBE_API_KEY}`;

  const { ok, data } = await fetchWithCapacitorFallback(searchUrl);
  if (!ok || !data.items) {
    throw new Error(data.error?.message || 'Failed to search YouTube');
  }

  const videoIds = data.items.map(item => item.id.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  // Fetch duration details
  const durations = await fetchVideoDurations(videoIds);

  return data.items.map(item => {
    const vId = item.id.videoId;
    return {
      youtubeId: vId,
      title: decodeHtmlEntities(item.snippet.title),
      artist: decodeHtmlEntities(item.snippet.channelTitle),
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      duration: durations[vId] || 0,
    };
  });
}

export async function fetchVideoDurations(videoIds) {
  if (!videoIds || videoIds.length === 0) return {};
  const idsStr = videoIds.join(',');
  const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${idsStr}&key=${YOUTUBE_API_KEY}`;
  
  const { ok, data } = await fetchWithCapacitorFallback(videosUrl);
  const durations = {};
  if (ok && data?.items) {
    for (const item of data.items) {
      durations[item.id] = parseIso8601Duration(item.contentDetails?.duration);
    }
  }
  return durations;
}

export async function getVideoDetails(videoIds) {
  if (!videoIds || videoIds.length === 0) return [];
  const idsStr = videoIds.join(',');
  const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${idsStr}&key=${YOUTUBE_API_KEY}`;

  const { ok, data } = await fetchWithCapacitorFallback(videosUrl);
  if (!ok || !data?.items) return [];

  return data.items.map(item => ({
    youtubeId: item.id,
    title: decodeHtmlEntities(item.snippet.title),
    artist: decodeHtmlEntities(item.snippet.channelTitle),
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    duration: parseIso8601Duration(item.contentDetails?.duration),
  }));
}
