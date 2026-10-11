import React, { useState, useEffect } from 'react';
import { Plus, KeyRound, Radio, Disc3, ListMusic, History, ArrowRight, Shield, Globe, Users, Play } from 'lucide-react';
import { supabase, playlistService } from '../services/supabase';
import { usePlayer } from '../context/PlayerContext';

export default function PlaylistList({ onOpenCreate, onOpenJoin }) {
  const { joinRoom, getJoinedHistory } = usePlayer();
  const [historyPlaylists, setHistoryPlaylists] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    loadHistory();
    loadPublicRooms();
  }, []);

  const loadHistory = () => {
    const list = getJoinedHistory();
    setHistoryPlaylists(list);
  };

  const loadPublicRooms = async () => {
    setLoadingRooms(true);
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!error && data) {
        setPublicRooms(data);
      }
    } catch (e) {
      console.warn('Error loading public rooms:', e);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleRejoin = async (playlistSummary) => {
    try {
      const full = await playlistService.getPlaylistById(playlistSummary.id);
      if (full) {
        await joinRoom(full);
      }
    } catch (e) {
      alert('This playlist is no longer available.');
      loadHistory();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10 animate-fade-in">
      
      {/* Hero Header */}
      <div className="relative rounded-3xl p-8 sm:p-10 overflow-hidden glass-panel border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-pink-500/20 via-violet-600/20 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs font-semibold mb-4 border border-violet-500/30">
            <Radio className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
            <span>Synchronized Music Playback</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Listen Together, <br />
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              In Perfect Sync.
            </span>
          </h2>
          <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
            Create Party rooms with DJ host controls, Jam together collaboratively, or share personal playlists with independent listening.
          </p>

          {/* Call to Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenCreate}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-sm font-bold shadow-lg shadow-violet-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Playlist</span>
            </button>

            <button
              onClick={onOpenJoin}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl glass-button text-white text-sm font-semibold hover:border-cyan-500/40 hover:bg-white/10 transition-all"
            >
              <KeyRound className="w-4 h-4 text-cyan-400" />
              <span>Join with 4-Digit Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* Previous / Joined Playlists History */}
      {historyPlaylists.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-violet-400" />
              Your Previous Playlists
            </h3>
            <span className="text-xs text-zinc-400">
              {historyPlaylists.length} playlist{historyPlaylists.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {historyPlaylists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => handleRejoin(pl)}
                className="group p-4 rounded-2xl glass-card flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors shrink-0">
                    {pl.type === 'party' ? (
                      <Radio className="w-5 h-5" />
                    ) : pl.type === 'jam' ? (
                      <Disc3 className="w-5 h-5" />
                    ) : (
                      <ListMusic className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                      {pl.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                      <span className="capitalize font-medium text-zinc-300">{pl.type}</span>
                      <span>•</span>
                      <span>Host: {pl.host_name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {pl.room_code && (
                    <span className="font-mono text-xs bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-lg font-bold">
                      #{pl.room_code}
                    </span>
                  )}
                  <div className="p-2 rounded-xl bg-white/5 text-zinc-400 group-hover:text-white group-hover:bg-violet-600 transition-all">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live Public Playlists */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            Live Public Rooms
          </h3>
          <button
            onClick={loadPublicRooms}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Refresh
          </button>
        </div>

        {loadingRooms ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            Loading live rooms...
          </div>
        ) : publicRooms.length === 0 ? (
          <div className="p-8 rounded-2xl glass-card text-center border-dashed border-white/10">
            <Disc3 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400 font-medium">No active public rooms right now.</p>
            <p className="text-xs text-zinc-500 mt-1">Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {publicRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => joinRoom(room)}
                className="group p-4 rounded-2xl glass-card flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                      room.type === 'party'
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                        : room.type === 'jam'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {room.type}
                    </span>

                    {room.password && (
                      <span title="Password Protected" className="text-amber-400">
                        <Shield className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                    {room.name}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Host: <span className="text-zinc-200 font-medium">{room.host_name}</span>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  {room.room_code ? (
                    <span className="font-mono text-xs text-cyan-300 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/20">
                      Code: {room.room_code}
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500">Private link</span>
                  )}

                  <span className="text-xs font-semibold text-violet-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Join <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
