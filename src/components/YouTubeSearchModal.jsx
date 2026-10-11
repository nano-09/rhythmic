import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Search, Plus, Check, Clock, Music, AlertCircle, 
  Flame, Play, Pause, Globe, Sparkles 
} from 'lucide-react';
import { searchMusic, getTopTrendingSongs, resolveYouTubeId } from '../services/musicSearch';
import { formatTime } from '../services/youtube';
import { playlistService } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { useLanguage } from '../context/LanguageContext';

const GENRE_TAGS = ['Pop', 'Hip-Hop', 'R&B', 'Rock', 'Electronic', 'K-Pop', 'J-Pop', 'Lo-Fi'];

const SONG_LANGUAGES = [
  { code: 'all', label: 'all_languages', icon: '🌐' },
  { code: 'ja', label: 'lang_japanese', icon: '🇯🇵' },
  { code: 'ko', label: 'lang_korean', icon: '🇰🇷' },
  { code: 'en', label: 'lang_english', icon: '🇺🇸' },
];

export default function YouTubeSearchModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { currentPlaylist, tracks, refreshTracks } = usePlayer();
  const { language: appLang, t } = useLanguage();

  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'trending'
  // Default search language to app language
  const [songLang, setSongLang] = useState('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());

  // In-modal audio preview player
  const [previewTrackId, setPreviewTrackId] = useState(null);
  const audioPreviewRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadTrending(songLang);
    } else {
      stopPreview();
    }
  }, [isOpen, songLang]);

  const loadTrending = async (lang = songLang) => {
    try {
      const hits = await getTopTrendingSongs(lang);
      setTrending(hits);
    } catch (e) {}
  };

  const handleSearch = async (searchTerm, lang = songLang) => {
    const term = searchTerm || query;
    if (!term || !term.trim()) return;
    setLoading(true);
    setErrorMsg('');
    stopPreview();

    try {
      const items = await searchMusic(term.trim(), lang);
      setResults(items);
      if (items.length === 0) {
        setErrorMsg(t('no_results'));
      }
    } catch (err) {
      console.error('Search failed:', err);
      setErrorMsg(err.message || 'Music search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (newLang) => {
    setSongLang(newLang);
    if (activeTab === 'trending') {
      loadTrending(newLang);
    } else if (query.trim()) {
      handleSearch(query, newLang);
    }
  };

  const handleGenreClick = (genre) => {
    setQuery(genre);
    setActiveTab('search');
    handleSearch(genre, songLang);
  };

  const handlePreviewToggle = (track) => {
    if (!track.previewUrl) return;

    if (previewTrackId === track.id) {
      stopPreview();
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      const audio = new Audio(track.previewUrl);
      audio.volume = 0.8;
      audio.onended = () => setPreviewTrackId(null);
      audio.onerror = () => setPreviewTrackId(null);
      audio.play().catch(() => {});
      audioPreviewRef.current = audio;
      setPreviewTrackId(track.id);
    }
  };

  const stopPreview = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }
    setPreviewTrackId(null);
  };

  const handleAddTrack = async (item) => {
    if (!currentPlaylist || !user) return;
    setResolvingId(item.id);
    stopPreview();

    try {
      // If it's a direct YouTube URL paste, youtube ID is already known
      let ytId = item.youtubeId || null;

      // For direct YouTube items, youtubeId is already set — add immediately
      // For iTunes items, add with a placeholder and resolve in background
      if (!ytId && !item.isDirectYouTube) {
        // Try to resolve quickly (2s timeout), but don't block the add
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          ytId = await Promise.race([
            resolveYouTubeId(item),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 3000)
            ),
          ]);
          clearTimeout(timeoutId);
        } catch (resolveErr) {
          // Use a search-query placeholder so the track still gets added
          // The player will attempt to resolve again when the user plays it
          ytId = '__pending__' + encodeURIComponent(`${item.title} ${item.artist}`);
          console.warn('YouTube resolution timed out, using pending placeholder:', resolveErr.message);
        }
      }

      await playlistService.addTrack({
        playlistId: currentPlaylist.id,
        track: {
          title: item.title,
          artist: item.artist,
          youtubeId: ytId,
          duration: item.duration,
          thumbnail: item.thumbnail,
        },
        currentUser: user,
        position: tracks.length,
      });

      setAddedIds(prev => new Set(prev).add(item.id));
      await refreshTracks(currentPlaylist.id);
    } catch (err) {
      console.error('Error adding track:', err);
      alert('Failed to add track: ' + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  if (!isOpen) return null;

  const currentDisplayList = activeTab === 'trending' ? trending : results;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] rounded-3xl glass-panel p-5 sm:p-6 shadow-2xl border border-white/10 flex flex-col overflow-hidden">
        
        {/* Glow ambient */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-pink-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => { stopPreview(); onClose(); }}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white glass-button"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
              iTunes & YouTube Engine
            </span>
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
            <Music className="w-5 h-5 text-pink-400" />
            {t('search_title')}
          </h2>
          <p className="text-xs text-zinc-400">
            {t('search_desc')}
          </p>
        </div>

        {/* Song Language Filter Selector */}
        <div className="flex items-center gap-1.5 mb-3 p-1 rounded-2xl bg-white/5 border border-white/10 overflow-x-auto scrollbar-none shrink-0 text-xs">
          {SONG_LANGUAGES.map((sl) => (
            <button
              key={sl.code}
              type="button"
              onClick={() => handleLanguageChange(sl.code)}
              className={`flex-1 min-w-[85px] py-2 px-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
                songLang === sl.code
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{sl.icon}</span>
              <span>{t(sl.label)}</span>
            </button>
          ))}
        </div>

        {/* Search Input Bar */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2 mb-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              autoFocus
              placeholder={t('search_placeholder')}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveTab('search'); }}
              className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm shadow-md transition-all disabled:opacity-50 shrink-0"
          >
            {loading ? t('searching') : t('search_btn')}
          </button>
        </form>

        {/* Tabs & Genre Filter Pills */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto py-1 scrollbar-none shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('trending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold shrink-0 whitespace-nowrap transition-all ${
              activeTab === 'trending'
                ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white shadow-md'
                : 'glass-button text-zinc-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{t('top_hits')}</span>
          </button>

          <span className="text-zinc-600 shrink-0 select-none">|</span>

          {GENRE_TAGS.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => handleGenreClick(genre)}
              className="px-3 py-1.5 rounded-xl glass-button text-zinc-400 hover:text-white text-xs font-medium shrink-0 whitespace-nowrap transition-all hover:border-violet-500/40"
            >
              {genre}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="mb-3 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {loading ? (
            <div className="py-20 text-center">
              <span className="animate-spin inline-block w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
              <p className="text-xs text-zinc-400 mt-2">{t('searching')}</p>
            </div>
          ) : currentDisplayList.length === 0 ? (
            <div className="py-20 text-center text-xs text-zinc-500">
              {activeTab === 'trending' ? t('searching') : t('search_desc')}
            </div>
          ) : (
            currentDisplayList.map((item) => {
              const isAdded = addedIds.has(item.id);
              const isResolving = resolvingId === item.id;
              const isPreviewing = previewTrackId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-2xl glass-card flex items-center justify-between gap-3 group transition-all"
                >
                  {/* Left: Thumbnail & Song Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-white/10 shadow-md">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />

                      {/* 30-sec Audio Preview Button Overlay */}
                      {item.previewUrl && (
                        <button
                          type="button"
                          onClick={() => handlePreviewToggle(item)}
                          className={`absolute inset-0 flex items-center justify-center transition-all ${
                            isPreviewing
                              ? 'bg-violet-600/70 text-white'
                              : 'bg-black/40 opacity-0 group-hover:opacity-100 text-white hover:bg-black/60'
                          }`}
                          title={isPreviewing ? 'Stop Preview' : t('preview_30s')}
                        >
                          {isPreviewing ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span className="truncate">{item.artist}</span>
                        {item.duration > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono text-zinc-500">
                              <Clock className="w-3 h-3" />
                              {formatTime(item.duration)}
                            </span>
                          </>
                        )}
                        {item.genre && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-zinc-500 font-medium">{item.genre}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Add to Playlist Action */}
                  <button
                    onClick={() => handleAddTrack(item)}
                    disabled={isAdded || isResolving}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all ${
                      isAdded
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isResolving
                        ? 'bg-violet-600/40 text-violet-200'
                        : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md'
                    }`}
                  >
                    {isResolving ? (
                      <>
                        <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                        <span>{t('syncing')}</span>
                      </>
                    ) : isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('added')}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('add')}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
