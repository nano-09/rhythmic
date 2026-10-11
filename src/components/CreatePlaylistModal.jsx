import React, { useState } from 'react';
import { X, Radio, Disc3, ListMusic, Lock, Globe, Shield, Sparkles } from 'lucide-react';
import { playlistService } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';

export default function CreatePlaylistModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { joinRoom } = usePlayer();

  const [name, setName] = useState('');
  const [type, setType] = useState('party'); // 'party' | 'jam' | 'playlist'
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleTypeSelect = (selectedType) => {
    setType(selectedType);
    if (selectedType === 'party') {
      setIsPublic(true); // party is always public
    } else if (selectedType === 'jam') {
      setIsPublic(true); // jam is public by default
    } else if (selectedType === 'playlist') {
      setIsPublic(false); // playlist is private by default
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const newPlaylist = await playlistService.createPlaylist({
        name: name.trim(),
        type,
        isPublic: type === 'party' ? true : isPublic,
        password: isPublic && password.trim() ? password.trim() : null,
        currentUser: user,
      });

      await joinRoom(newPlaylist);
      onClose();
    } catch (err) {
      console.error('Failed to create playlist:', err);
      setErrorMsg(err.message || 'Failed to create playlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 overflow-hidden">
        
        {/* Glow ambient */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-violet-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white glass-button"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-violet-400 animate-spin-slow" />
            Create Playlist Room
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Choose your room style and invite others to sync or listen along.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-5">
          {/* Playlist Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
              Playlist Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Midnight Beats, Road Trip Vibes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full glass-input rounded-xl px-4 py-2.5 text-sm"
            />
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
              Playlist Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              {/* Party Card */}
              <div
                onClick={() => handleTypeSelect('party')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  type === 'party'
                    ? 'bg-violet-600/25 border-violet-500 shadow-md ring-1 ring-violet-500'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-pink-400" />
                    Party
                  </span>
                  <span className="text-[9px] bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded font-bold uppercase">
                    Host DJ
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  Always public. Only host controls playback & queue. All listeners sync in real-time.
                </p>
              </div>

              {/* Jam Card */}
              <div
                onClick={() => handleTypeSelect('jam')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  type === 'jam'
                    ? 'bg-violet-600/25 border-violet-500 shadow-md ring-1 ring-violet-500'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Jam
                  </span>
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-bold uppercase">
                    Collab
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  Public by default. Everyone can play, pause, and add tracks. Synced playback.
                </p>
              </div>

              {/* Playlist Card */}
              <div
                onClick={() => handleTypeSelect('playlist')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  type === 'playlist'
                    ? 'bg-violet-600/25 border-violet-500 shadow-md ring-1 ring-violet-500'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ListMusic className="w-3.5 h-3.5 text-emerald-400" />
                    Playlist
                  </span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold uppercase">
                    Solo / Share
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  Private by default. Shared tracklist, but members listen independently.
                </p>
              </div>

            </div>
          </div>

          {/* Visibility: Public / Private */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-400" />
                )}
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {isPublic ? 'Public Playlist (4-Digit Room Code)' : 'Private Playlist'}
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    {isPublic
                      ? 'Generates a 4-digit code so others can join this playlist.'
                      : 'Only you can view and access this playlist.'}
                  </p>
                </div>
              </div>

              {type !== 'party' && (
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPublic ? 'bg-violet-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              )}
            </div>

            {/* Optional Password for Public */}
            {isPublic && (
              <div className="pt-2 border-t border-white/10">
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-400" />
                  Optional Room Password
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for open access"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full glass-input rounded-xl px-3.5 py-2 text-xs"
                />
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <span>Create & Launch Room</span>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
