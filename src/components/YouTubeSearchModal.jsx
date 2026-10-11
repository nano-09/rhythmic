import React, { useState } from 'react';
import { X, Search, Plus, Check, Clock, Music, AlertCircle } from 'lucide-react';
import { searchYouTube, formatTime } from '../services/youtube';
import { playlistService } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';

export default function YouTubeSearchModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { currentPlaylist, tracks, refreshTracks } = usePlayer();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const items = await searchYouTube(query.trim());
      setResults(items);
      if (items.length === 0) {
        setErrorMsg('No results found. Try a different search term or paste a YouTube URL.');
      }
    } catch (err) {
      console.error('Search failed:', err);
      setErrorMsg(err.message || 'YouTube search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrack = async (item) => {
    if (!currentPlaylist || !user) return;
    try {
      await playlistService.addTrack({
        playlistId: currentPlaylist.id,
        track: item,
        currentUser: user,
        position: tracks.length,
      });

      setAddedIds(prev => new Set(prev).add(item.youtubeId));
      await refreshTracks(currentPlaylist.id);
    } catch (err) {
      console.error('Error adding track:', err);
      alert('Failed to add track: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[85vh] rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 flex flex-col overflow-hidden">
        
        {/* Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-pink-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white glass-button"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-pink-400" />
            Add Songs to Playlist
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Search YouTube tracks or paste a video link directly.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              autoFocus
              placeholder="Search song title, artist, or YouTube URL..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm shadow-md transition-all disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {errorMsg && (
          <div className="mb-3 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[260px]">
          {loading ? (
            <div className="py-16 text-center">
              <span className="animate-spin inline-block w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
              <p className="text-xs text-zinc-400 mt-2">Searching YouTube...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-500">
              Type a song name above to search and add tracks.
            </div>
          ) : (
            results.map((item) => {
              const isAdded = addedIds.has(item.youtubeId);
              return (
                <div
                  key={item.youtubeId}
                  className="p-2.5 rounded-xl glass-card flex items-center justify-between gap-3 group transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-14 h-10 object-cover rounded-lg bg-zinc-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span className="truncate">{item.artist}</span>
                        {item.duration > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-zinc-500" />
                              {formatTime(item.duration)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddTrack(item)}
                    disabled={isAdded}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all ${
                      isAdded
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
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
