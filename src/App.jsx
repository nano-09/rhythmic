import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { usePlayer } from './context/PlayerContext';
import Header from './components/Header';
import PlaylistList from './components/PlaylistList';
import RoomView from './components/RoomView';
import PlayerBar from './components/PlayerBar';
import AuthModal from './components/AuthModal';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import JoinPlaylistModal from './components/JoinPlaylistModal';
import YouTubeSearchModal from './components/YouTubeSearchModal';
import LyricsModal from './components/LyricsModal';
import MembersModal from './components/MembersModal';

export default function App() {
  const { currentPlaylist } = usePlayer();

  // Modal visibility states
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0b10] text-zinc-100 flex flex-col selection:bg-violet-500 selection:text-white">
      {/* Hidden YouTube IFrame Player */}
      <div
        id="youtube-hidden-player"
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Navigation Header */}
      <Header
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenJoin={() => setIsJoinOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentPlaylist ? (
          <RoomView
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenMembers={() => setIsMembersOpen(true)}
          />
        ) : (
          <PlaylistList
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenJoin={() => setIsJoinOpen(true)}
          />
        )}
      </main>

      {/* Persistent Bottom Player Bar */}
      <PlayerBar onOpenLyrics={() => setIsLyricsOpen(true)} />

      {/* Modals & Dialogs */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <CreatePlaylistModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <JoinPlaylistModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
      />

      <YouTubeSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      <LyricsModal
        isOpen={isLyricsOpen}
        onClose={() => setIsLyricsOpen(false)}
      />

      <MembersModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
      />
    </div>
  );
}
