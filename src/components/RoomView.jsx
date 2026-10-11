
import React, { useState } from 'react';
import {
  Plus, Trash2, Users, Copy, Check,
  Crown, Play, Pause, LogOut, Music2, Shield, Info,
  GripVertical
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLanguage } from '../context/LanguageContext';
import { playlistService } from '../services/supabase';
import { formatTime } from '../services/youtube';

export default function RoomView({ onOpenSearch, onOpenMembers }) {
  const {
    currentPlaylist,
    tracks,
    members,
    currentTrackIndex,
    isPlaying,
    isHost,
    canControlPlayback,
    canModifyTracks,
    canReorderTracks,
    reorderTracks,
    selectTrack,
    togglePlay,
    leaveRoom,
    refreshTracks,
  } = usePlayer();
  const { t } = useLanguage();

  const [copiedCode, setCopiedCode] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  if (!currentPlaylist) return null;

  const handleCopyCode = () => {
    if (!currentPlaylist.room_code) return;
    navigator.clipboard.writeText(currentPlaylist.room_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRemoveTrack = async (e, trackId) => {
    e.stopPropagation();
    if (!canModifyTracks()) return;

    const confirmDelete = window.confirm(t('confirm_remove_track'));
    if (!confirmDelete) return;

    setDeletingId(trackId);
    try {
      await playlistService.removeTrack(trackId);
      await refreshTracks(currentPlaylist.id);
    } catch (err) {
      console.error('Failed to remove track:', err);
      alert('Error: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-32">

      {/* Room Header Card */}
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden glass-panel border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-violet-600/20 via-pink-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${currentPlaylist.type === 'party'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                : currentPlaylist.type === 'jam'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                {t(`${currentPlaylist.type}_mode`)}
              </span>

              {currentPlaylist.room_code && (
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold hover:bg-cyan-900/60 transition-all"
                  title={t('copy_code')}
                >
                  <span>Code: #{currentPlaylist.room_code}</span>
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}

              {currentPlaylist.password && (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Shield className="w-3 h-3" /> {t('password_protected')}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {currentPlaylist.name}
            </h2>

            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1.5">
              <span className="flex items-center gap-1 text-amber-300 font-semibold">
                <Crown className="w-3.5 h-3.5" /> {t('host_prefix')}: {currentPlaylist.host_name}
              </span>
              <span>•</span>
              <span>{tracks.length} {t('track_queue')}</span>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={onOpenMembers}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-button text-xs font-semibold text-zinc-200 hover:text-white"
            >
              <Users className="w-4 h-4 text-violet-400" />
              <span>{t('members')} ({members.length})</span>
            </button>

            <button
              onClick={leaveRoom}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-button text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
              title={t('leave_room')}
            >
              <LogOut className="w-4 h-4" />
              <span>{t('leave_room')}</span>
            </button>
          </div>
        </div>

        {/* Mode Info Bar */}
        <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-zinc-500 shrink-0" />
            <span>{t(`${currentPlaylist.type}_info`)}</span>
          </div>

          {canModifyTracks() && (
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-md transition-all shrink-0 ml-4"
            >
              <Plus className="w-4 h-4" />
              <span>{t('add_songs')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Track List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            {t('track_queue')}
          </h3>
          <span className="text-xs text-zinc-500">
            {tracks.length}
          </span>
        </div>

        {tracks.length === 0 ? (
          <div className="p-12 rounded-3xl glass-card text-center border-dashed border-white/10 space-y-3">
            <Music2 className="w-12 h-12 text-zinc-600 mx-auto" />
            <div>
              <p className="text-base font-bold text-white">{t('empty_playlist')}</p>
              <p className="text-xs text-zinc-400 mt-1">
                {canModifyTracks() ? t('search_youtube_empty') : t('wait_host_empty')}
              </p>
            </div>
            {canModifyTracks() && (
              <button
                onClick={onOpenSearch}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>{t('add_songs')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {tracks.map((track, idx) => {
              const isCurrent = idx === currentTrackIndex;
              const hasControl = canControlPlayback();
              const isDragging = draggedIndex === idx;
              const isOver = dragOverIndex === idx && draggedIndex !== idx;
              const canReorder = canReorderTracks();

              return (
                <div
                  key={track.id}
                  draggable={canReorder}
                  onDragStart={(e) => {
                    if (!canReorder) return;
                    setDraggedIndex(idx);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                  }}
                  onDragOver={(e) => {
                    if (draggedIndex === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverIndex !== idx) {
                      setDragOverIndex(idx);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex === null || draggedIndex === idx) {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                      return;
                    }
                    const newTracks = [...tracks];
                    const [moved] = newTracks.splice(draggedIndex, 1);
                    newTracks.splice(idx, 0, moved);
                    reorderTracks(newTracks);
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onClick={() => {
                    if (draggedIndex !== null) return;
                    if (isCurrent) {
                      if (hasControl) togglePlay();
                    } else {
                      if (hasControl) selectTrack(idx, true);
                    }
                  }}
                  className={`p-3 rounded-2xl flex items-center justify-between gap-3 group transition-all cursor-pointer ${
                    isDragging
                      ? 'opacity-30 border-2 border-dashed border-violet-500 bg-violet-500/10'
                      : isOver
                      ? 'bg-violet-600/30 border-2 border-violet-400 shadow-lg scale-[1.01]'
                      : isCurrent
                      ? 'bg-violet-600/20 border border-violet-500/40 shadow-md ring-1 ring-violet-500/30'
                      : 'glass-card hover:bg-white/5'
                  }`}
                >
                  {/* Left: Grip Handle & Index & Thumbnail & Title */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {canReorder && (
                      <div
                        className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-violet-400 p-1 -ml-1 rounded transition-colors shrink-0"
                        title={t('drag_to_reorder')}
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}

                    <div className="w-5 text-center text-xs font-mono font-bold text-zinc-500 shrink-0">
                      {isCurrent && isPlaying ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="w-0.5 bg-cyan-400 rounded-full wave-bar-1" />
                          <span className="w-0.5 bg-violet-400 rounded-full wave-bar-2" />
                          <span className="w-0.5 bg-pink-400 rounded-full wave-bar-3" />
                        </div>
                      ) : (
                        idx + 1
                      )}
                    </div>

                    <div className="relative w-12 h-10 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-white/10">
                      <img
                        src={track.thumbnail || '/icon-192.png'}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        {isCurrent && isPlaying ? (
                          <Pause className="w-4 h-4 text-white fill-current" />
                        ) : (
                          <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className={`text-sm font-bold truncate transition-colors ${isCurrent ? 'text-violet-300' : 'text-white group-hover:text-violet-300'
                          }`}>
                          {track.title}
                        </h4>
                        {track.youtube_id?.startsWith('__pending__') && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            ⌛
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span className="truncate">{track.artist || 'Unknown'}</span>
                        <span>•</span>
                        <span className="text-zinc-500">{t('added_by')} {track.added_by_name}</span>
                      </div>
                    </div>

                  </div>

                  {/* Right: Duration & Remove action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-zinc-400">
                      {formatTime(track.duration)}
                    </span>

                    {canModifyTracks() && (
                      <button
                        onClick={(e) => handleRemoveTrack(e, track.id)}
                        disabled={deletingId === track.id}
                        className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Remove track"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
