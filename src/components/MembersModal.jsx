import React, { useState } from 'react';
import { X, Users, Crown, Shield, ArrowRightLeft, UserCheck } from 'lucide-react';
import { playlistService } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';

export default function MembersModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { currentPlaylist, members, isHost, refreshMembers } = usePlayer();
  const [transferringId, setTransferringId] = useState(null);

  if (!isOpen || !currentPlaylist) return null;

  const handleTransferHost = async (targetMember) => {
    const confirmTransfer = window.confirm(
      `Are you sure you want to transfer host permissions to ${targetMember.username}?`
    );
    if (!confirmTransfer) return;

    setTransferringId(targetMember.user_id);
    try {
      await playlistService.transferHost(
        currentPlaylist.id,
        targetMember.user_id,
        targetMember.username
      );
      await refreshMembers(currentPlaylist.id);
      alert(`Host successfully transferred to ${targetMember.username}!`);
    } catch (err) {
      console.error('Failed to transfer host:', err);
      alert('Transfer failed: ' + err.message);
    } finally {
      setTransferringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 overflow-hidden">
        
        {/* Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white glass-button"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            Room Members ({members.length})
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            People currently in <span className="text-zinc-200 font-semibold">{currentPlaylist.name}</span>
          </p>
        </div>

        {/* Members List */}
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
          {members.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No members found.
            </div>
          ) : (
            members.map((member) => {
              const isMemberHost = member.role === 'host' || member.user_id === currentPlaylist.host_user_id;
              const isMe = user?.id === member.user_id;

              return (
                <div
                  key={member.id || member.user_id}
                  className="p-3 rounded-xl glass-card flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xs shrink-0">
                      {member.username?.slice(0, 2).toUpperCase() || 'U'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">
                          {member.username}
                        </span>
                        {isMe && (
                          <span className="text-[10px] bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded font-medium">
                            You
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        {isMemberHost ? (
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            <Crown className="w-3 h-3" /> Host
                          </span>
                        ) : (
                          <span className="text-zinc-400">Participant</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Transfer Host Button (Visible if I am host and target is not host) */}
                  {isHost && !isMemberHost && (
                    <button
                      onClick={() => handleTransferHost(member)}
                      disabled={transferringId === member.user_id}
                      className="px-2.5 py-1.5 rounded-lg glass-button text-xs font-semibold text-amber-300 hover:bg-amber-500/20 flex items-center gap-1.5 transition-all"
                      title="Transfer Host to this user"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Make Host</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
