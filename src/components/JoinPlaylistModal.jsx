import React, { useState } from 'react';
import { X, KeyRound, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { playlistService } from '../services/supabase';
import { usePlayer } from '../context/PlayerContext';
import { useLanguage } from '../context/LanguageContext';

export default function JoinPlaylistModal({ isOpen, onClose }) {
  const { joinRoom } = usePlayer();
  const { t } = useLanguage();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [targetPlaylist, setTargetPlaylist] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setErrorMsg('');
    setLoading(true);

    try {
      let playlist = targetPlaylist;
      if (!playlist) {
        playlist = await playlistService.findByRoomCode(code.trim());
      }

      if (!playlist) {
        throw new Error('Room not found. Check the 4-digit code.');
      }

      // Check password requirement
      if (playlist.password && !needsPassword) {
        setTargetPlaylist(playlist);
        setNeedsPassword(true);
        setLoading(false);
        return;
      }

      if (playlist.password && needsPassword) {
        if (password.trim() !== playlist.password.trim()) {
          throw new Error('Incorrect room password.');
        }
      }

      await joinRoom(playlist);
      onClose();
    } catch (err) {
      console.error('Failed to join:', err);
      setErrorMsg(err.message || 'Unable to join playlist room.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCode(val);
    setErrorMsg('');
    setNeedsPassword(false);
    setTargetPlaylist(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 overflow-hidden">
        
        {/* Glow */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-cyan-600/30 rounded-full blur-3xl pointer-events-none" />

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
            <KeyRound className="w-5 h-5 text-cyan-400" />
            {t('join_title')}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {t('join_desc')}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider text-center">
              {t('room_code_label')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              required
              autoFocus
              placeholder="0000"
              value={code}
              onChange={handleCodeChange}
              className="w-full glass-input rounded-2xl px-4 py-3 text-center text-3xl font-mono font-bold tracking-widest text-cyan-300"
            />
          </div>

          {needsPassword && (
            <div className="animate-fade-in pt-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                {t('room_password_label')}
              </label>
              <input
                type="password"
                required
                autoFocus
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-2.5 text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>{needsPassword ? t('verify_and_enter') : t('join_action')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
