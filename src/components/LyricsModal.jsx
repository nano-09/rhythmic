import React, { useState, useEffect, useRef } from 'react';
import { X, Mic2, Music, Sparkles, RefreshCw } from 'lucide-react';
import { fetchLyrics } from '../services/lyrics';
import { usePlayer } from '../context/PlayerContext';

export default function LyricsModal({ isOpen, onClose }) {
  const { currentTrack, currentTime } = usePlayer();
  const [lyricsData, setLyricsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (isOpen && currentTrack) {
      loadLyrics();
    }
  }, [isOpen, currentTrack?.youtube_id]);

  const loadLyrics = async () => {
    if (!currentTrack) return;
    setLoading(true);
    setLyricsData(null);
    try {
      const data = await fetchLyrics({
        title: currentTrack.title,
        artist: currentTrack.artist,
        duration: currentTrack.duration,
      });
      setLyricsData(data);
    } catch (e) {
      console.warn('Lyrics fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Track active line in synced lyrics
  useEffect(() => {
    if (!lyricsData?.synced || lyricsData.synced.length === 0) return;

    let currentIndex = -1;
    for (let i = 0; i < lyricsData.synced.length; i++) {
      if (currentTime >= lyricsData.synced[i].time) {
        currentIndex = i;
      } else {
        break;
      }
    }

    setActiveLineIndex(currentIndex);
  }, [currentTime, lyricsData]);

  // Auto scroll to active line
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[85vh] rounded-3xl glass-panel p-6 shadow-2xl border border-white/10 flex flex-col overflow-hidden">
        
        {/* Glow ambient */}
        <div className="absolute -top-20 -left-20 w-44 h-44 bg-cyan-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white glass-button"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pr-10">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
            <Mic2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white truncate">
              {currentTrack?.title || 'No Track Playing'}
            </h3>
            <p className="text-xs text-zinc-400 truncate">
              {currentTrack?.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Lyrics Content */}
        <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-4 custom-scrollbar min-h-[300px]">
          {loading ? (
            <div className="py-24 text-center">
              <span className="animate-spin inline-block w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full" />
              <p className="text-xs text-zinc-400 mt-2">Searching live lyrics...</p>
            </div>
          ) : !lyricsData ? (
            <div className="py-24 text-center space-y-3">
              <Music className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-400 font-medium">Lyrics not available for this track.</p>
              <button
                onClick={loadLyrics}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-button text-xs text-zinc-300 hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : lyricsData.synced && lyricsData.synced.length > 0 ? (
            <div className="space-y-4 text-center">
              {lyricsData.synced.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                return (
                  <p
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    className={`transition-all duration-300 font-medium ${
                      isActive
                        ? 'text-lg sm:text-xl font-bold text-cyan-300 scale-105 shadow-sm'
                        : 'text-sm text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="whitespace-pre-line text-sm text-zinc-300 leading-relaxed text-center font-normal px-2">
              {lyricsData.plain}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Synced with playback</span>
          <span className="flex items-center gap-1 text-zinc-400">
            <Sparkles className="w-3 h-3 text-cyan-400" /> Powered by LRCLIB
          </span>
        </div>

      </div>
    </div>
  );
}
