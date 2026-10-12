import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Search, Plus, Check, Clock, Music, AlertCircle, 
  Flame, Play, Pause, Globe, Sparkles, ChevronDown
} from 'lucide-react';
import { searchMusic, getTopTrendingSongs, resolveYouTubeId } from '../services/musicSearch';
import { formatTime } from '../services/youtube';
import { playlistService } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { useLanguage } from '../context/LanguageContext';

const GENRE_TAGS = ['Pop', 'Hip-Hop', 'R&B', 'Rock', 'Electronic', 'K-Pop', 'J-Pop', 'Lo-Fi'];

const SONG_LANGUAGES = [
  { code: 'all', label: 'all_languages', icon: '🌐', short: 'ALL' },
  { code: 'ja', label: 'lang_japanese', icon: '🇯🇵', short: 'JA' },
  { code: 'ko', label: 'lang_korean', icon: '🇰🇷', short: 'KO' },
  { code: 'en', label: 'lang_english', icon: '🇺🇸', short: 'EN' },
];

export default function YouTubeSearchModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { currentPlaylist, tracks, refreshTracks } = usePlayer();
  const { language: appLang, t } = useLanguage();

  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'trending'
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
      setActiveTab('search');
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
      let ytId = item.youtubeId || null;

      if (!ytId && !item.isDirectYouTube) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 6000)
          );
          ytId = await Promise.race([
            resolveYouTubeId(item),
            timeoutPromise,
          ]);
        } catch (resolveErr) {
          ytId = '__pending__' + encodeURIComponent(`${item.title} ${item.artist}`);
          console.warn('YouTube resolution fallback to pending:', resolveErr.message);
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full sm:max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl glass-panel shadow-2xl border border-white/10 border-b-0 sm:border-b flex flex-col overflow-hidden">
        
        {/* Glow ambient */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Drag Handle (mobile) */}
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30 shrink-0">
              <Music className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold text-white">{t('search_title')}</h2>
          </div>

          <button
            onClick={() => { stopPreview(); onClose(); }}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white glass-button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Filter Bar: Tabs + Language in one row */}
        <div className="flex items-center gap-2 px-4 py-2 shrink-0">
          {/* Tab Toggle */}
          <div className="flex p-0.5 bg-white/5 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                activeTab === 'search'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Search className="w-3 h-3" />
              <span>{t('search_title')}</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('trending'); loadTrending(songLang); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                activeTab === 'trending'
                  ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-300" />
              <span>{t('top_hits')}</span>
            </button>
          </div>

          {/* Language Pills */}
          <div className="flex items-center gap-1 p-0.5 bg-white/5 rounded-xl border border-white/10 flex-1 justify-around">
            {SONG_LANGUAGES.map((sl) => (
              <button
                key={sl.code}
                type="button"
                onClick={() => handleLanguageChange(sl.code)}
                title={t(sl.label)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                  songLang === sl.code
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>{sl.icon}</span>
                <span className="hidden sm:inline">{sl.short}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Input (Search tab only) */}
        {activeTab === 'search' && (
          <div className="px-4 pb-2 shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  placeholder={t('search_placeholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full glass-input rounded-xl pl-8 pr-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50 shrink-0"
              >
                {loading ? '...' : t('search_btn')}
              </button>
            </form>
          </div>
        )}

        {/* Genre Chips (Trending tab) */}
        {activeTab === 'trending' && (
          <div className="px-4 pb-2 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {GENRE_TAGS.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => handleGenreClick(genre)}
                  className="px-2.5 py-1 rounded-lg glass-button text-zinc-400 hover:text-white text-[11px] font-medium shrink-0 whitespace-nowrap transition-all"
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="mx-4 mb-2 p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-1.5 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center">
              <span className="animate-spin inline-block w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full" />
              <p className="text-xs text-zinc-500 mt-2">{t('searching')}</p>
            </div>
          ) : currentDisplayList.length === 0 ? (
            <div className="py-12 text-center">
              <Music className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">
                {activeTab === 'trending' ? t('searching') : t('search_desc')}
              </p>
            </div>
          ) : (
            currentDisplayList.map((item) => {
              const isAdded = addedIds.has(item.id);
              const isResolving = resolvingId === item.id;
              const isPreviewing = previewTrackId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-2xl glass-card flex items-center gap-2.5 group transition-all"
                >
                  {/* Thumbnail */}
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-white/10 shadow-sm">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    {item.previewUrl && (
                      <button
                        type="button"
                        onClick={() => handlePreviewToggle(item)}
                        className={`absolute inset-0 flex items-center justify-center transition-all ${
                          isPreviewing
                            ? 'bg-violet-600/80 text-white'
                            : 'bg-black/40 opacity-0 group-hover:opacity-100 text-white'
                        }`}
                        title={isPreviewing ? 'Stop Preview' : t('preview_30s')}
                      >
                        {isPreviewing ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Song Info */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
                      <span className="truncate">{item.artist}</span>
                      {item.duration > 0 && (
                        <>
                          <span>·</span>
                          <span className="font-mono shrink-0">{formatTime(item.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Add Button */}
                  <button
                    onClick={() => handleAddTrack(item)}
                    disabled={isAdded || isResolving}
                    className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 transition-all ${
                      isAdded
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isResolving
                        ? 'bg-violet-600/40 text-violet-200'
                        : 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm'
                    }`}
                  >
                    {isResolving ? (
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    ) : isAdded ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
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
