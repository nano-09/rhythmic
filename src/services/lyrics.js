export function cleanTrackTitle(title) {
  if (!title) return '';
  return title
    .replace(/\[.*?\]/g, '') // remove [Official Music Video], etc.
    .replace(/\(.*?\)/g, '') // remove (Official Audio), (Lyrics), etc.
    .replace(/(?:official\s*(?:video|music\s*video|audio|lyric\s*video))/gi, '')
    .replace(/(?:ft\.|feat\.)\s+[^\-]+/gi, '')
    .trim();
}

export function parseLrcLyrics(syncedLyrics) {
  if (!syncedLyrics) return [];
  const lines = syncedLyrics.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
      const totalSeconds = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      if (text) {
        result.push({ time: totalSeconds, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export async function fetchLyrics({ title, artist, duration }) {
  const cleanedTitle = cleanTrackTitle(title);
  
  // Try exact lookup first
  try {
    let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanedTitle)}`;
    if (artist) {
      url += `&artist_name=${encodeURIComponent(artist)}`;
    }
    if (duration) {
      url += `&duration=${Math.round(duration)}`;
    }

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics || data.plainLyrics) {
        return {
          synced: parseLrcLyrics(data.syncedLyrics),
          plain: data.plainLyrics || null,
          trackName: data.trackName,
          artistName: data.artistName,
        };
      }
    }
  } catch (e) {
    console.warn('LRCLIB exact get error:', e);
  }

  // Fallback to search endpoint
  try {
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanedTitle + (artist ? ' ' + artist : ''))}`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        const best = results[0];
        return {
          synced: parseLrcLyrics(best.syncedLyrics),
          plain: best.plainLyrics || null,
          trackName: best.trackName,
          artistName: best.artistName,
        };
      }
    }
  } catch (e) {
    console.warn('LRCLIB search error:', e);
  }

  return null;
}
