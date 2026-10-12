import React, { useState } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, 
  Sparkles, Mic2, Minimize2, ChevronUp 
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTime } from '../services/youtube';

export default function PlayerBar({ onOpenLyrics }) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    loopMode,
    isShuffle,
    autoplay,
    canControlPlayback,
    togglePlay,
    playNextTrack,
    playPreviousTrack,
    seekTo,
    toggleLoop,
    toggleShuffle,
    toggleAutoplay,
    currentPlaylist,
    isHost,
  } = usePlayer();
  const { t } = useLanguage();

  const [isExpanded, setIsExpanded] = useState(false);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSliderChange = (e) => {
    if (!canControlPlayback()) return;
    const val = parseFloat(e.target.value);
    seekTo(val);
  };

  const hasControl = canControlPlayback();

  return (
    <>
      {/* Mini Player Bar at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-white/10 px-3 sm:px-4 py-2 sm:py-2.5 transition-all">
        {/* Progress Bar Top Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 group cursor-pointer">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-pink-500 relative transition-all"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          
          {/* Left: Track Info */}
          <div 
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 sm:gap-3 min-w-0 max-w-[42%] sm:max-w-[30%] cursor-pointer group"
          >
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-white/10 shadow-md">
              <img
                src={currentTrack.thumbnail || '/icon-192.png'}
                alt={currentTrack.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
                  <span className="w-1 bg-cyan-400 rounded-full wave-bar-1" />
                  <span className="w-1 bg-violet-400 rounded-full wave-bar-2" />
                  <span className="w-1 bg-pink-400 rounded-full wave-bar-3" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                {currentTrack.title}
              </h4>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
                {currentTrack.artist || 'Unknown'}
              </p>
            </div>
          </div>

          {/* Center: Controls & Scrubber */}
          <div className="flex-1 max-w-xl flex flex-col items-center">
            <div className="flex items-center gap-2 sm:gap-5">
              {/* Shuffle (desktop/expanded) */}
              <button
                onClick={toggleShuffle}
                title={`${t('shuffle')}: ${isShuffle ? 'On' : 'Off'}`}
                className={`hidden sm:block p-1.5 rounded-lg transition-all ${
                  isShuffle ? 'text-pink-400 bg-pink-500/10' : 'text-zinc-500 hover:text-white'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Prev */}
              <button
                onClick={playPreviousTrack}
                disabled={!hasControl}
                className="p-1 sm:p-1.5 text-zinc-300 hover:text-white disabled:opacity-30 transition-colors"
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                disabled={!hasControl}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 disabled:opacity-40 transition-all shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
                )}
              </button>

              {/* Next */}
              <button
                onClick={playNextTrack}
                disabled={!hasControl}
                className="p-1 sm:p-1.5 text-zinc-300 hover:text-white disabled:opacity-30 transition-colors"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>

              {/* Loop (desktop/expanded) */}
              <button
                onClick={toggleLoop}
                title={`${t('loop')}: ${loopMode}`}
                className={`hidden sm:block p-1.5 rounded-lg transition-all ${
                  loopMode !== 'off' ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-500 hover:text-white'
                }`}
              >
                {loopMode === 'track' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Time Scrubber */}
            <div className="hidden sm:flex items-center gap-2 w-full text-[10px] text-zinc-400 font-mono mt-1">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="1"
                value={currentTime}
                disabled={!hasControl}
                onChange={handleSliderChange}
                className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Aux controls (Lyrics, Autoplay, Expand) */}
          <div className="flex items-center gap-2">
            {/* Autoplay toggle */}
            <button
              onClick={toggleAutoplay}
              title={`${t('auto')}: ${autoplay ? 'On' : 'Off'}`}
              className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                autoplay ? 'text-violet-300 bg-violet-600/20 border border-violet-500/30' : 'text-zinc-500 glass-button'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[11px]">{t('auto')}</span>
            </button>

            {/* Lyrics Button */}
            <button
              onClick={onOpenLyrics}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-button text-xs text-zinc-300 hover:text-white"
              title={t('lyrics')}
            >
              <Mic2 className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline text-[11px]">{t('lyrics')}</span>
            </button>

            {/* Fullscreen Expand */}
            <button
              onClick={() => setIsExpanded(true)}
              className="p-1.5 rounded-xl glass-button text-zinc-400 hover:text-white"
              title={t('expand_player')}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Notice if in party mode and user is guest */}
        {currentPlaylist?.type === 'party' && !isHost && (
          <div className="text-center text-[10px] text-zinc-500 -mb-1 mt-1">
            {t('host_controlling')}
          </div>
        )}
      </div>

      {/* Expanded Full-Screen Mobile Sheet */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 glass-panel bg-black/90 backdrop-blur-2xl flex flex-col p-6 animate-fade-in overflow-y-auto">
          {/* Top header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-xl glass-button text-zinc-400 hover:text-white"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                {t('playing_from')}
              </span>
              <p className="text-xs font-bold text-white truncate max-w-[200px]">
                {currentPlaylist?.name || 'Sync Beats'}
              </p>
            </div>
            <button
              onClick={onOpenLyrics}
              className="p-2 rounded-xl glass-button text-cyan-400 hover:text-white"
            >
              <Mic2 className="w-5 h-5" />
            </button>
          </div>

          {/* Large Album Art */}
          <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full my-auto">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-8 glow-primary">
              <img
                src={currentTrack.thumbnail || '/icon-512.png'}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="w-full text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-black text-white truncate px-4">
                {currentTrack.title}
              </h2>
              <p className="text-sm font-medium text-zinc-400 mt-1">
                {currentTrack.artist || 'Unknown'}
              </p>
            </div>

            {/* Scrubber */}
            <div className="w-full space-y-2 mb-6">
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="1"
                value={currentTime}
                disabled={!hasControl}
                onChange={handleSliderChange}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
              <div className="flex justify-between text-xs font-mono text-zinc-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="w-full flex items-center justify-between px-4 mb-6">
              <button
                onClick={toggleShuffle}
                className={`p-2 rounded-xl ${isShuffle ? 'text-pink-400 bg-pink-500/20' : 'text-zinc-500'}`}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                onClick={playPreviousTrack}
                disabled={!hasControl}
                className="p-2 text-zinc-200 hover:text-white"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              <button
                onClick={togglePlay}
                disabled={!hasControl}
                className="w-16 h-16 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              <button
                onClick={playNextTrack}
                disabled={!hasControl}
                className="p-2 text-zinc-200 hover:text-white"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              <button
                onClick={toggleLoop}
                className={`p-2 rounded-xl ${loopMode !== 'off' ? 'text-cyan-400 bg-cyan-500/20' : 'text-zinc-500'}`}
              >
                {loopMode === 'track' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>
            </div>

            {/* Autoplay & Lyrics Pills */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAutoplay}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  autoplay ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40' : 'glass-button text-zinc-400'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>{t('auto')} {autoplay ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={onOpenLyrics}
                className="px-4 py-2 rounded-xl glass-button text-xs font-semibold text-cyan-300 flex items-center gap-2"
              >
                <Mic2 className="w-4 h-4" />
                <span>{t('lyrics')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
