import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, playlistService } from '../services/supabase';
import { backgroundAudio } from '../services/backgroundAudio';
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
  const progressTimerRef = useRef(null);
  const channelRef = useRef(null);
  const isSyncingFromRemoteRef = useRef(false);
  const shouldBePlayingRef = useRef(false);

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
          } catch (e) {}
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

  // Load YouTube IFrame API script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      initPlayer();
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
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
          },
          onStateChange: handleYtStateChange,
          onError: (e) => {
            console.warn('[YouTube Player Error]', e.data);
            handleTrackEnded();
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
          } catch (e) {}
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
            } catch (e) {}
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

  const selectTrack = (index, autoPlay = true) => {
    if (index < 0 || index >= tracks.length) return;
    const track = tracks[index];
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
      try {
        if (autoPlay) {
          ytPlayerRef.current.loadVideoById(track.youtube_id, 0);
          setIsPlaying(true);
        } else {
          ytPlayerRef.current.cueVideoById(track.youtube_id, 0);
          setIsPlaying(false);
        }
      } catch (e) {
        console.error('Error loading video:', e);
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
      if (!payload || payload.senderId === user?.id) return;
      if (currentPlaylist.type === 'playlist') return;

      isSyncingFromRemoteRef.current = true;

      if (payload.action === 'CHANGE_TRACK') {
        if (payload.trackIndex !== currentTrackIndex) {
          selectTrack(payload.trackIndex, payload.isPlaying);
        }
      } else if (payload.action === 'PLAY') {
        if (!isPlaying) play();
        if (Math.abs(currentTime - payload.currentTime) > 2) {
          seekTo(payload.currentTime);
        }
      } else if (payload.action === 'PAUSE') {
        if (isPlaying) pause();
        if (Math.abs(currentTime - payload.currentTime) > 2) {
          seekTo(payload.currentTime);
        }
      } else if (payload.action === 'SEEK') {
        seekTo(payload.currentTime);
      }

      setTimeout(() => {
        isSyncingFromRemoteRef.current = false;
      }, 300);
    });

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playlist_tracks', filter: `playlist_id=eq.${currentPlaylist.id}` },
      () => {
        refreshTracks(currentPlaylist.id);
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
        refreshMembers(currentPlaylist.id);
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
      setTracks(data);
    } catch (e) {
      console.error('Error fetching tracks:', e);
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

  const joinRoom = async (playlist) => {
    setCurrentPlaylist(playlist);
    await refreshTracks(playlist.id);
    await refreshMembers(playlist.id);

    if (user) {
      await playlistService.joinMember(playlist.id, user);
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
    setCurrentPlaylist(null);
    setTracks([]);
    setMembers([]);
    setCurrentTrackIndex(-1);
  };

  const HISTORY_KEY = 'syncbeats_playlist_history';
  const getJoinedHistory = () => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
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
        refreshMembers,
        getJoinedHistory,
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
