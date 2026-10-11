/**
 * Service to ensure continuous audio playback and background execution
 * across mobile (Capacitor Android/iOS) and web browsers.
 */

// A tiny valid 1-second silent WAV base64 data URI
const SILENT_WAV_BASE64 =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class BackgroundAudioService {
  constructor() {
    this.silentAudio = null;
    this.wakeLock = null;
    this.isSessionActive = false;
    this.handlers = {
      onPlay: null,
      onPause: null,
      onNext: null,
      onPrevious: null,
      onSeek: null,
    };

    this.initSilentAudio();
    this.initVisibilityListener();
  }

  initSilentAudio() {
    if (typeof window === 'undefined') return;

    try {
      this.silentAudio = new Audio(SILENT_WAV_BASE64);
      this.silentAudio.loop = true;
      this.silentAudio.volume = 0.01; // nearly inaudible anchor
      this.silentAudio.setAttribute('playsinline', 'true');
      this.silentAudio.setAttribute('webkit-playsinline', 'true');
    } catch (e) {
      console.warn('[BackgroundAudio] Failed to initialize silent audio anchor:', e);
    }
  }

  setHandlers({ onPlay, onPause, onNext, onPrevious, onSeek }) {
    this.handlers = { onPlay, onPause, onNext, onPrevious, onSeek };
    this.setupMediaSessionHandlers();
  }

  setupMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (this.handlers.onPlay) this.handlers.onPlay();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.handlers.onPause) this.handlers.onPause();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (this.handlers.onNext) this.handlers.onNext();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (this.handlers.onPrevious) this.handlers.onPrevious();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (this.handlers.onSeek && typeof details.seekTime === 'number') {
          this.handlers.onSeek(details.seekTime);
        }
      });
    } catch (e) {
      console.warn('[BackgroundAudio] Error registering MediaSession action handlers:', e);
    }
  }

  updateMetadata({ title, artist, playlistName, artworkUrl, duration, currentTime }) {
    if (!('mediaSession' in navigator)) return;

    try {
      const artworks = [];
      if (artworkUrl) {
        artworks.push(
          { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
        );
      } else {
        artworks.push(
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        );
      }

      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: title || 'Sync Beats',
        artist: artist || 'Unknown Artist',
        album: playlistName || 'Sync Beats Playlist',
        artwork: artworks,
      });

      if (duration && duration > 0 && typeof currentTime === 'number') {
        if ('setPositionState' in navigator.mediaSession) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(duration, 1),
            playbackRate: 1,
            position: Math.min(Math.max(currentTime, 0), duration),
          });
        }
      }
    } catch (e) {
      console.warn('[BackgroundAudio] MediaSession metadata update error:', e);
    }
  }

  setPlaybackState(isPlaying) {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      } catch (e) {}
    }

    if (isPlaying) {
      this.startSilentAudioAnchor();
      this.requestWakeLock();
    } else {
      this.pauseSilentAudioAnchor();
      this.releaseWakeLock();
    }
  }

  startSilentAudioAnchor() {
    if (!this.silentAudio) return;
    try {
      const promise = this.silentAudio.play();
      if (promise !== undefined) {
        promise.catch(() => {
          // Autoplay policy might delay until user gesture
        });
      }
    } catch (e) {}
  }

  pauseSilentAudioAnchor() {
    if (!this.silentAudio) return;
    try {
      this.silentAudio.pause();
    } catch (e) {}
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator && !this.wakeLock) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      } catch (e) {
        // WakeLock request might fail on some low-power modes
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }
  }

  initVisibilityListener() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isSessionActive) {
        this.requestWakeLock();
      }
    });
  }
}

export const backgroundAudio = new BackgroundAudioService();
