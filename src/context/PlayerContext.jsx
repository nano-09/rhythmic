import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, playlistService } from '../services/supabase';
import { backgroundAudio } from '../services/backgroundAudio';
import { resolveYouTubeId } from '../services/musicSearch';
import { useAuth } from './AuthContext';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const { user } = useAuth();

  // Active room / playlist state
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopMode, setLoopMode] = useState('off'); // 'off' | 'playlist' | 'track'
  const [isShuffle, setIsShuffle] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);

  // References
  const ytPlayerRef = useRef(null);
  const isYtReadyRef = useRef(false);
  const pendingPlayRef = useRef(null);
  const progressTimerRef = useRef(null);
  const channelRef = useRef(null);
  const isSyncingFromRemoteRef = useRef(false);
  const shouldBePlayingRef = useRef(false);
  // Auto-start request: set when a track is added while nothing is playing
  const autoStartRef = useRef(null);
  // Always holds the latest functions/state, so long-lived callbacks
  // (YouTube player events, realtime channel handlers) never use stale closures
  const latestRef = useRef({});
  // Id of the YouTube video currently loaded into the player
  const loadedVideoIdRef = useRef(null);

  // Derived state
  const currentTrack = currentTrackIndex >= 0 && tracks[currentTrackIndex] ? tracks[currentTrackIndex] : null;
  const isHost = currentPlaylist && user ? currentPlaylist.host_user_id === user.id : false;

  const canControlPlayback = () => {
    if (!currentPlaylist) return false;
    if (currentPlaylist.type === 'party') return isHost;
    if (currentPlaylist.type === 'jam') return true;
    if (currentPlaylist.type === 'playlist') return true;
    return true;
  };

  const canModifyTracks = () => {
    if (!currentPlaylist) return false;
    if (currentPlaylist.type === 'party') return isHost;
    if (currentPlaylist.type === 'jam') return true;
    if (currentPlaylist.type === 'playlist') return isHost;
    return true;
  };

  const canReorderTracks = () => {
    if (!currentPlaylist) return false;
    if (currentPlaylist.type === 'party') return isHost;
    if (currentPlaylist.type === 'jam') return true;
    if (currentPlaylist.type === 'playlist') return true; // affects only local user
    return false;
  };

  // Setup BackgroundAudio lockscreen handlers
  useEffect(() => {
    backgroundAudio.setHandlers({
      onPlay: () => play(),
      onPause: () => pause(),
      onNext: () => playNextTrack(),
      onPrevious: () => playPreviousTrack(),
      onSeek: (targetTime) => seekTo(targetTime),
    });
  }, [tracks, currentTrackIndex, currentPlaylist]);

  // Keep lockscreen metadata updated
  useEffect(() => {
    if (currentTrack) {
      backgroundAudio.updateMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        playlistName: currentPlaylist?.name,
        artworkUrl: currentTrack.thumbnail,
        duration: duration || currentTrack.duration,
        currentTime: currentTime,
      });
    }
  }, [currentTrack, duration, currentPlaylist?.name]);

  // Background guardian: prevents pause when app is minimized or screen is locked
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && shouldBePlayingRef.current) {
        backgroundAudio.startSilentAudioAnchor();
        if (ytPlayerRef.current && isYtReadyRef.current) {
          try {
            ytPlayerRef.current.playVideo();
          } catch (e) { }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleVisibility);
    };
  }, []);

  // Initialize YouTube IFrame Player
  useEffect(() => {
    window.__onYouTubeReadyCallback = () => {
      initPlayer();
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.YT && window.YT.Player) {
          initPlayer();
          clearInterval(interval);
        } else if (attempts > 20) {
          clearInterval(interval);
        }
      }, 300);
      return () => {
        clearInterval(interval);
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      };
    }

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const initPlayer = () => {
    if (ytPlayerRef.current) return;
    const playerContainer = document.getElementById('youtube-hidden-player');
    if (!playerContainer) return;

    try {
      ytPlayerRef.current = new window.YT.Player('youtube-hidden-player', {
        height: '10',
        width: '10',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            isYtReadyRef.current = true;
            if (pendingPlayRef.current) {
              const { index, autoPlay } = pendingPlayRef.current;
              pendingPlayRef.current = null;
              latestRef.current.selectTrack(index, autoPlay);
            }
          },
          onStateChange: (e) => latestRef.current.handleYtStateChange(e),
          onError: (e) => {
            console.warn('[YouTube Player Error code]', e.data);
            setIsPlaying(false);
            shouldBePlayingRef.current = false;
            // Error codes: 2=invalid param, 5=html5 error, 100=not found, 101/150=embed blocked
            // Auto-skip to next track on unrecoverable errors
            if ([100, 101, 150].includes(e.data)) {
              setTimeout(() => latestRef.current.handleTrackEnded(), 1500);
            }
          },
        },
      });
    } catch (e) {
      console.error('Failed to initialize YouTube player:', e);
    }
  };

  // Polling current playback time
  useEffect(() => {
    if (isPlaying) {
      let tickCount = 0;
      progressTimerRef.current = setInterval(() => {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          try {
            const time = ytPlayerRef.current.getCurrentTime() || 0;
            const dur = ytPlayerRef.current.getDuration() || (currentTrack?.duration || 0);
            setCurrentTime(time);
            if (dur > 0) setDuration(dur);

            tickCount++;
            if (tickCount % 4 === 0 && currentTrack) {
              backgroundAudio.updateMetadata({
                title: currentTrack.title,
                artist: currentTrack.artist,
                playlistName: currentPlaylist?.name,
                artworkUrl: currentTrack.thumbnail,
                duration: dur,
                currentTime: time,
              });
            }
          } catch (e) { }
        }
      }, 500);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, currentTrack]);

  // Handle YouTube player state changes
  const handleYtStateChange = (event) => {
    if (!window.YT) return;

    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      shouldBePlayingRef.current = true;
      backgroundAudio.setPlaybackState(true);
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      // If paused due to app backgrounding / screen off while user intended to play:
      if (document.hidden && shouldBePlayingRef.current) {
        setTimeout(() => {
          if (ytPlayerRef.current && shouldBePlayingRef.current) {
            try {
              ytPlayerRef.current.playVideo();
            } catch (e) { }
          }
        }, 150);
        return;
      }

      setIsPlaying(false);
      backgroundAudio.setPlaybackState(false);
    } else if (event.data === window.YT.PlayerState.ENDED) {
      handleTrackEnded();
    }
  };

  const handleTrackEnded = () => {
    if (loopMode === 'track') {
      seekTo(0);
      play();
      return;
    }

    if (!autoplay) {
      setIsPlaying(false);
      shouldBePlayingRef.current = false;
      backgroundAudio.setPlaybackState(false);
      return;
    }

    playNextTrack();
  };

  const playNextTrack = () => {
    if (tracks.length === 0) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * tracks.length);
      selectTrack(randomIndex);
      return;
    }

    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < tracks.length) {
      selectTrack(nextIndex);
    } else if (loopMode === 'playlist') {
      selectTrack(0);
    } else {
      setIsPlaying(false);
      shouldBePlayingRef.current = false;
      backgroundAudio.setPlaybackState(false);
    }
  };

  const playPreviousTrack = () => {
    if (tracks.length === 0) return;
    if (currentTime > 4) {
      seekTo(0);
      return;
    }
    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      selectTrack(prevIndex);
    } else {
      seekTo(0);
    }
  };

  // After asking YouTube to autoplay, check that it really started. Browsers
  // (especially iOS Safari) can silently block autoplay that isn't directly
  // triggered by a tap. If blocked, reset the UI to "paused" so one tap on Play works.
  const watchPlaybackStart = () => {
    setTimeout(() => {
      try {
        const p = ytPlayerRef.current;
        if (!p || !shouldBePlayingRef.current || !window.YT) return;
        const st = p.getPlayerState();
        if (st !== window.YT.PlayerState.PLAYING && st !== window.YT.PlayerState.BUFFERING) {
          console.warn('[SyncBeats] Playback did not start (player state ' + st + '). Autoplay was probably blocked by the browser. Tap Play.');
          setIsPlaying(false);
        }
      } catch (e) { }
    }, 3000);
  };

  const resolveAndPlay = async (track, index, autoPlay) => {
    try {
      const videoId = await resolveYouTubeId({ title: track.title, artist: track.artist });

      // Update the track in memory (match by id in case the list changed meanwhile)
      setTracks(prev => prev.map((t) => (t.id === track.id ? { ...t, youtube_id: videoId } : t)));

      // Save the resolved id so nobody has to look it up again
      supabase
        .from('playlist_tracks')
        .update({ youtube_id: videoId })
        .eq('id', track.id)
        .then(({ error }) => {
          if (error) console.warn('[SyncBeats] Could not save resolved youtube_id:', error.message);
        });

      // The user may have skipped to another track while we were resolving
      if (latestRef.current.currentTrackIndex !== index) {
        console.log('[SyncBeats] Track changed while resolving; not starting it.');
        return;
      }

      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          loadedVideoIdRef.current = videoId;
          if (autoPlay) {
            ytPlayerRef.current.loadVideoById(videoId, 0);
            setIsPlaying(true);
            watchPlaybackStart();
          } else {
            ytPlayerRef.current.cueVideoById(videoId, 0);
            setIsPlaying(false);
          }
        } catch (err) {
          console.error('[SyncBeats] Error starting resolved video:', err);
        }
      } else {
        pendingPlayRef.current = { index, autoPlay };
      }
    } catch (e) {
      console.error('[SyncBeats] Could not find a YouTube video for "' + track.title + '":', e.message);
    }
  };

  const selectTrack = (index, autoPlay = true) => {
    if (index < 0 || index >= tracks.length) return;
    const track = tracks[index];
    console.log('[SyncBeats] selectTrack', {
      index,
      title: track.title,
      youtube_id: track.youtube_id,
      autoPlay,
      playerReady: !!(ytPlayerRef.current && isYtReadyRef.current),
    });
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    if (autoPlay) {
      shouldBePlayingRef.current = true;
      backgroundAudio.setPlaybackState(true);
    } else {
      shouldBePlayingRef.current = false;
      backgroundAudio.setPlaybackState(false);
    }

    backgroundAudio.updateMetadata({
      title: track.title,
      artist: track.artist,
      playlistName: currentPlaylist?.name,
      artworkUrl: track.thumbnail,
      duration: track.duration,
      currentTime: 0,
    });

    if (ytPlayerRef.current && isYtReadyRef.current) {
      // Handle pending YouTube ID (iTunes song whose YT ID wasn't resolved at add time)
      if (track.youtube_id?.startsWith('__pending__')) {
        resolveAndPlay(track, index, autoPlay);
      } else if (track.youtube_id) {
        loadedVideoIdRef.current = track.youtube_id;
        try {
          if (autoPlay) {
            ytPlayerRef.current.loadVideoById(track.youtube_id, 0);
            setIsPlaying(true);
            watchPlaybackStart();
          } else {
            ytPlayerRef.current.cueVideoById(track.youtube_id, 0);
            setIsPlaying(false);
          }
        } catch (e) {
          console.error('Error loading video:', e);
        }
      } else {
        console.warn('[SyncBeats] Track has no youtube_id, cannot play:', track.title);
      }
    } else {
      pendingPlayRef.current = { index, autoPlay };
      if (!ytPlayerRef.current && window.YT && window.YT.Player) {
        initPlayer();
      }
    }

    if (!isSyncingFromRemoteRef.current && currentPlaylist && currentPlaylist.type !== 'playlist') {
      broadcastPlaybackUpdate({
        action: 'CHANGE_TRACK',
        trackIndex: index,
        isPlaying: autoPlay,
        currentTime: 0,
      });
    }
  };

  const play = () => {
    if (currentTrackIndex === -1 && tracks.length > 0) {
      selectTrack(0, true);
      return;
    }

    // The selected track may never have been loaded into the YouTube player
    // (e.g. the index was restored from the room state when joining). Load it first.
    const selected = tracks[currentTrackIndex];
    if (
      selected &&
      ytPlayerRef.current &&
      isYtReadyRef.current &&
      loadedVideoIdRef.current !== selected.youtube_id
    ) {
      selectTrack(currentTrackIndex, true);
      return;
    }

    shouldBePlayingRef.current = true;
    backgroundAudio.setPlaybackState(true);

    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      } catch (e) {
        console.error('Play error:', e);
      }
    }

    if (!isSyncingFromRemoteRef.current && currentPlaylist && currentPlaylist.type !== 'playlist') {
      broadcastPlaybackUpdate({
        action: 'PLAY',
        trackIndex: currentTrackIndex,
        isPlaying: true,
        currentTime: currentTime,
      });
    }
  };

  const pause = () => {
    shouldBePlayingRef.current = false;
    backgroundAudio.setPlaybackState(false);

    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
      } catch (e) {
        console.error('Pause error:', e);
      }
    }

    if (!isSyncingFromRemoteRef.current && currentPlaylist && currentPlaylist.type !== 'playlist') {
      broadcastPlaybackUpdate({
        action: 'PAUSE',
        trackIndex: currentTrackIndex,
        isPlaying: false,
        currentTime: currentTime,
      });
    }
  };

  const togglePlay = () => {
    if (!canControlPlayback()) return;
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const seekTo = (seconds) => {
    setCurrentTime(seconds);
    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.seekTo(seconds, true);
      } catch (e) {
        console.error('Seek error:', e);
      }
    }

    if (!isSyncingFromRemoteRef.current && currentPlaylist && currentPlaylist.type !== 'playlist') {
      broadcastPlaybackUpdate({
        action: 'SEEK',
        trackIndex: currentTrackIndex,
        isPlaying: isPlaying,
        currentTime: seconds,
      });
    }
  };

  const toggleLoop = () => {
    setLoopMode(prev => {
      if (prev === 'off') return 'playlist';
      if (prev === 'playlist') return 'track';
      return 'off';
    });
  };

  const toggleShuffle = () => {
    setIsShuffle(prev => !prev);
  };

  const toggleAutoplay = () => {
    setAutoplay(prev => !prev);
  };

  const broadcastPlaybackUpdate = (payload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'playback_sync',
      payload: {
        ...payload,
        senderId: user?.id,
        timestamp: Date.now(),
      },
    });

    if (currentPlaylist) {
      playlistService.updatePlaybackState(currentPlaylist.id, {
        current_track_index: payload.trackIndex,
        is_playing: payload.isPlaying,
        current_time: payload.currentTime,
        loop_mode: loopMode,
        shuffle: isShuffle,
        autoplay: autoplay,
      });
    }
  };

  useEffect(() => {
    if (!currentPlaylist) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channelName = `playlist_room:${currentPlaylist.id}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'playback_sync' }, ({ payload }) => {
      const L = latestRef.current;
      if (!payload || payload.senderId === user?.id) return;
      if (currentPlaylist.type === 'playlist') return;

      isSyncingFromRemoteRef.current = true;

      if (payload.action === 'CHANGE_TRACK') {
        if (payload.trackIndex !== L.currentTrackIndex) {
          L.selectTrack(payload.trackIndex, payload.isPlaying);
        }
      } else if (payload.action === 'PLAY') {
        if (!L.isPlaying) L.play();
        if (Math.abs(L.currentTime - payload.currentTime) > 2) {
          L.seekTo(payload.currentTime);
        }
      } else if (payload.action === 'PAUSE') {
        if (L.isPlaying) L.pause();
        if (Math.abs(L.currentTime - payload.currentTime) > 2) {
          L.seekTo(payload.currentTime);
        }
      } else if (payload.action === 'SEEK') {
        L.seekTo(payload.currentTime);
      }

      setTimeout(() => {
        isSyncingFromRemoteRef.current = false;
      }, 300);
    });

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playlist_tracks', filter: `playlist_id=eq.${currentPlaylist.id}` },
      () => {
        latestRef.current.refreshTracks(currentPlaylist.id);
      }
    );

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'playlists', filter: `id=eq.${currentPlaylist.id}` },
      (payload) => {
        if (payload.new) {
          setCurrentPlaylist(prev => ({ ...prev, ...payload.new }));
        }
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playlist_members', filter: `playlist_id=eq.${currentPlaylist.id}` },
      () => {
        latestRef.current.refreshMembers(currentPlaylist.id);
      }
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Connected to room channel ${channelName}`);
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentPlaylist?.id, currentPlaylist?.type]);

  const refreshTracks = async (playlistId) => {
    try {
      const data = await playlistService.getTracks(playlistId);
      if (currentPlaylist?.type === 'playlist') {
        const storageKey = `playlist_order_${playlistId}_${user?.id || 'guest'}`;
        const savedOrderRaw = localStorage.getItem(storageKey);
        if (savedOrderRaw) {
          try {
            const orderIds = JSON.parse(savedOrderRaw);
            const idMap = new Map(data.map(t => [t.id, t]));
            const sorted = [];
            for (const id of orderIds) {
              if (idMap.has(id)) {
                sorted.push(idMap.get(id));
                idMap.delete(id);
              }
            }
            idMap.forEach(t => sorted.push(t));
            setTracks(sorted);
            return;
          } catch (_) { }
        }
      }
      setTracks(data);
    } catch (e) {
      console.error('Error fetching tracks:', e);
    }
  };

  const reorderTracks = async (newOrderedTracks) => {
    if (!canReorderTracks()) return;

    // Maintain currently playing track index accurately
    const playingTrack = tracks[currentTrackIndex];
    if (playingTrack) {
      const newIdx = newOrderedTracks.findIndex(t => t.id === playingTrack.id);
      if (newIdx !== -1) {
        setCurrentTrackIndex(newIdx);
      }
    }

    setTracks(newOrderedTracks);

    if (currentPlaylist.type === 'playlist') {
      // Local only for playlist mode
      try {
        const storageKey = `playlist_order_${currentPlaylist.id}_${user?.id || 'guest'}`;
        localStorage.setItem(storageKey, JSON.stringify(newOrderedTracks.map(t => t.id)));
      } catch (e) {
        console.error('Error saving local playlist track order:', e);
      }
    } else {
      // Party & Jam modes: persist to Supabase to sync with all participants
      try {
        await playlistService.reorderTracks(currentPlaylist.id, newOrderedTracks);
      } catch (e) {
        console.error('Error reordering tracks:', e);
        // Revert on failure
        await refreshTracks(currentPlaylist.id);
      }
    }
  };

  const refreshMembers = async (playlistId) => {
    try {
      const data = await playlistService.getMembers(playlistId);
      setMembers(data);
    } catch (e) {
      console.error('Error fetching members:', e);
    }
  };

  const joinRoom = async (playlist, overrideUser) => {
    setCurrentPlaylist(playlist);
    await refreshTracks(playlist.id);
    await refreshMembers(playlist.id);

    // Use overrideUser first (for fresh guest login), then fall back to context user
    const activeUser = overrideUser || user;
    if (activeUser) {
      await playlistService.joinMember(playlist.id, activeUser);
    }

    saveToJoinedHistory(playlist);

    if (playlist.playback_state && playlist.type !== 'playlist') {
      const st = playlist.playback_state;
      if (typeof st.current_track_index === 'number' && st.current_track_index >= 0) {
        setCurrentTrackIndex(st.current_track_index);
      }
      if (st.loop_mode) setLoopMode(st.loop_mode);
      if (typeof st.shuffle === 'boolean') setIsShuffle(st.shuffle);
      if (typeof st.autoplay === 'boolean') setAutoplay(st.autoplay);
    }
  };

  const leaveRoom = async () => {
    if (currentPlaylist && user) {
      await playlistService.leaveMember(currentPlaylist.id, user.id);
    }
    pause();
    autoStartRef.current = null;
    loadedVideoIdRef.current = null;
    setCurrentPlaylist(null);
    setTracks([]);
    setMembers([]);
    setCurrentTrackIndex(-1);
  };

  // Ask the context to start the NEXT track that appears in the queue
  // (used right after adding a song). requestAutoStart(false) cancels.
  // The new track is found by comparing track ids, not by position.
  const requestAutoStart = (shouldStart = true) => {
    autoStartRef.current = shouldStart
      ? { knownIds: new Set(tracks.map(t => t.id)), createdAt: Date.now() }
      : null;
  };

  // Fires after `tracks` updates; starts the newly added track using fresh state
  useEffect(() => {
    const req = autoStartRef.current;
    if (!req) return;
    if (Date.now() - req.createdAt > 30000) {
      autoStartRef.current = null; // expired
      return;
    }
    const newIndex = tracks.findIndex(t => !req.knownIds.has(t.id));
    if (newIndex === -1) return; // new track hasn't arrived yet
    autoStartRef.current = null;
    if (!canControlPlayback()) {
      console.log('[SyncBeats] Auto-start skipped: this user cannot control playback in this room.');
      return;
    }
    console.log('[SyncBeats] Auto-starting newly added track:', tracks[newIndex].title);
    selectTrack(newIndex, true);
  }, [tracks]);

  const HISTORY_KEY = 'syncbeats_playlist_history';
  const getJoinedHistory = () => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const removeFromJoinedHistory = (playlistId) => {
    try {
      const history = getJoinedHistory();
      const filtered = history.filter(p => p.id !== playlistId);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
      return filtered;
    } catch (e) {
      console.error('Error removing from history:', e);
      return [];
    }
  };

  const cleanJoinedHistory = (validIds) => {
    try {
      const validSet = new Set(validIds);
      const history = getJoinedHistory();
      const filtered = history.filter(p => validSet.has(p.id));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
      return filtered;
    } catch (e) {
      console.error('Error cleaning history:', e);
      return [];
    }
  };

  const saveToJoinedHistory = (playlist) => {
    try {
      const history = getJoinedHistory();
      const filtered = history.filter(p => p.id !== playlist.id);
      filtered.unshift({
        id: playlist.id,
        name: playlist.name,
        type: playlist.type,
        room_code: playlist.room_code,
        is_public: playlist.is_public,
        host_name: playlist.host_name,
        lastJoined: Date.now(),
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 20)));
    } catch (e) {
      console.error('Error saving history:', e);
    }
  };

  // Keep the latest functions/state available to long-lived callbacks
  latestRef.current = {
    selectTrack,
    play,
    pause,
    seekTo,
    handleTrackEnded,
    handleYtStateChange,
    refreshTracks,
    refreshMembers,
    currentTrackIndex,
    isPlaying,
    currentTime,
  };

  return (
    <PlayerContext.Provider
      value={{
        currentPlaylist,
        tracks,
        members,
        currentTrackIndex,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        loopMode,
        isShuffle,
        autoplay,
        volume,
        isMuted,
        isHost,
        canControlPlayback,
        canModifyTracks,
        joinRoom,
        leaveRoom,
        selectTrack,
        togglePlay,
        play,
        pause,
        seekTo,
        playNextTrack,
        playPreviousTrack,
        toggleLoop,
        toggleShuffle,
        toggleAutoplay,
        refreshTracks,
        reorderTracks,
        refreshMembers,
        getJoinedHistory,
        removeFromJoinedHistory,
        cleanJoinedHistory,
        canReorderTracks,
        requestAutoStart,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}