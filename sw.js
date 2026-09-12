// Sync Beats service worker
//
// What this does:
//   1. Precaches the app shell (this HTML page + manifest + icons) so the
//      app itself loads instantly with no network, and can be added to the
//      home screen as an installable PWA.
//   2. Caches cross-origin "shell" scripts (Tailwind, Supabase client,
//      Google Fonts) with a stale-while-revalidate strategy, so a second
//      visit still boots even if those CDNs are briefly unreachable.
//   3. Caches direct-URL audio files (mp3/m4a/etc, NOT YouTube) the first
//      time they're played, including Range-request support so seeking
//      still works when replaying a cached track offline.
//
// What this deliberately does NOT do:
//   - Cache or proxy Supabase Realtime / REST traffic. Room sync is
//     inherently live — caching it would just serve stale playlists and
//     confuse people. Those requests are left alone (network only).
//   - Cache YouTube's player or video/audio streams. That's against
//     YouTube's terms and the iframe player needs a live connection anyway.

const SHELL_CACHE = 'syncbeats-shell-v1';
const RUNTIME_CACHE = 'syncbeats-runtime-v1';
const AUDIO_CACHE = 'syncbeats-audio-v1';
const CURRENT_CACHES = [SHELL_CACHE, RUNTIME_CACHE, AUDIO_CACHE];

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Hosts we never want to intercept: live sync traffic, and anything
// YouTube (playback there needs a live connection regardless of caching).
// Matched as domain suffixes, e.g. 'youtube.com' also matches
// 'www.youtube.com'.
const NEVER_CACHE_HOST_SUFFIXES = [
  'supabase.co',
  'supabase.in',
  'youtube.com',
  'ytimg.com',
  'googlevideo.com',
];
// Exact hosts only — NOT a suffix match, so this excludes the YouTube
// Data API (search results) without also excluding fonts.googleapis.com,
// which we do want cached as part of the app shell.
const NEVER_CACHE_EXACT_HOSTS = ['www.googleapis.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Cache each asset individually so one missing file (e.g. if this
      // is hosted from a subpath) doesn't fail the whole install.
      await Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] shell cache miss:', url, err))
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !CURRENT_CACHES.includes(name)).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

function isNeverCacheHost(url) {
  if (NEVER_CACHE_EXACT_HOSTS.includes(url.hostname)) return true;
  return NEVER_CACHE_HOST_SUFFIXES.some((host) => url.hostname.endsWith(host));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never intercept writes

  const url = new URL(request.url);
  if (isNeverCacheHost(url)) return; // let the browser handle it natively

  // 1) Audio files (destination === 'audio' covers any <audio src>,
  //    regardless of file extension or query string).
  if (request.destination === 'audio') {
    event.respondWith(handleAudioRequest(request));
    return;
  }

  // 2) Page navigations — network-first so people get the latest build
  //    when online, falling back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // 3) Same-origin static assets (this file, manifest, icons) — cache
  //    first, since they only change when we ship a new service worker.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 4) Everything else cross-origin (Tailwind CDN, Supabase JS bundle,
  //    Google Fonts) — stale-while-revalidate: instant from cache if we
  //    have it, refreshed in the background for next time.
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

async function handleNavigationRequest(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match('./index.html');
    if (cached) return cached;
    throw err;
  }
}

// response.ok is always false for opaque (no-cors, cross-origin) responses
// even when the request actually succeeded, since the browser hides the
// real status. Cache those too — it's the normal, expected shape for
// third-party CDN <script> tags loaded without a crossorigin attribute.
function isCacheableResponse(response) {
  return !!response && (response.ok || response.type === 'opaque');
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (isCacheableResponse(fresh)) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((fresh) => {
      if (isCacheableResponse(fresh)) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => null);
  return cached || (await networkPromise) || Response.error();
}

// --- Audio caching with Range-request support -------------------------
//
// <audio> elements almost always issue Range requests (even on first
// play), so a naive cache.put(request, response) keyed on a partial
// response would only ever satisfy that one byte range. Instead we cache
// the FULL file once (fetched without a Range header) and, on every
// request after that, slice out whatever range was actually asked for.
//
// Caveat: slicing requires reading the response's bytes, which is only
// possible for a CORS-readable response. Many third-party file hosts
// don't send CORS headers, in which case the browser only gives us an
// "opaque" response — cacheable and replayable as a whole file, but not
// sliceable. We try a CORS fetch first and fall back to opaque so at
// least whole-file offline playback works everywhere; proper Range/206
// (smooth seeking on a cached track) works wherever the host allows it.

async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cachedFull = await cache.match(request.url);

  if (cachedFull) {
    return serveFromCachedFull(cachedFull, request);
  }

  // Nothing cached yet: let this play request go straight to the network
  // (so playback isn't delayed even a moment), and in parallel fetch +
  // store the full file so replays — including offline ones — are covered.
  cacheFullFileInBackground(cache, request.url);

  try {
    return await fetch(request);
  } catch (err) {
    return new Response('Offline and this track has not been cached yet.', {
      status: 503,
      statusText: 'Offline',
    });
  }
}

async function cacheFullFileInBackground(cache, url) {
  try {
    const already = await cache.match(url);
    if (already) return;

    let full;
    try {
      // Prefer CORS: only a non-opaque response lets us read bytes later
      // to serve proper Range/206 responses for smooth offline seeking.
      full = await fetch(url, { mode: 'cors' });
      if (!full.ok) throw new Error('non-ok cors response for ' + url);
    } catch (corsErr) {
      // Host doesn't allow cross-origin reads — fall back to no-cors.
      // We can still cache and replay the whole file offline, just
      // without being able to slice it into Range responses.
      full = await fetch(url, { mode: 'no-cors' });
    }

    if (full && (full.ok || full.type === 'opaque')) {
      await cache.put(url, full.clone());
    }
  } catch (err) {
    // Offline, 404, or otherwise unfetchable — skip caching this one.
  }
}

async function serveFromCachedFull(cachedResponse, request) {
  if (cachedResponse.type === 'opaque') {
    // Can't read/slice an opaque body — hand back the whole cached
    // response as-is. The browser treats this like a host that doesn't
    // support Range requests: playback still works, seeking is just less
    // smooth (it downloads-then-seeks locally instead of jumping straight
    // to a byte offset).
    return cachedResponse;
  }

  const buffer = await cachedResponse.clone().arrayBuffer();
  const total = buffer.byteLength;
  const contentType = cachedResponse.headers.get('Content-Type') || 'audio/mpeg';
  const rangeHeader = request.headers.get('range');

  if (!rangeHeader) {
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(total),
        'Accept-Ranges': 'bytes',
      },
    });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  let start = match && match[1] ? parseInt(match[1], 10) : 0;
  let end = match && match[2] ? parseInt(match[2], 10) : total - 1;
  if (Number.isNaN(start) || start < 0) start = 0;
  if (Number.isNaN(end) || end >= total) end = total - 1;
  if (start > end) start = end;

  const chunk = buffer.slice(start, end + 1);
  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': contentType,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(chunk.byteLength),
      'Accept-Ranges': 'bytes',
    },
  });
}
