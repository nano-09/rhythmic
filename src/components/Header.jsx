import React, { useState } from 'react';
import { Music2, LogIn, LogOut, Globe, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { useLanguage } from '../context/LanguageContext';

const LANGUAGES = [
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export default function Header({ onOpenAuth, onOpenCreate, onOpenJoin }) {
  const { user, logout } = useAuth();
  const { currentPlaylist, leaveRoom } = usePlayer();
  const { language, setLanguage, t } = useLanguage();
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 transition-all">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2">
        
        {/* Brand */}
        <div 
          onClick={() => { if (currentPlaylist) leaveRoom(); }}
          className="flex items-center gap-2 cursor-pointer group shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform shrink-0">
            <Music2 className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm sm:text-base font-black tracking-wide bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent leading-none">
              {t('brand_title')}
            </h1>
          </div>
        </div>

        {/* Center: Room Status badge (desktop only) */}
        {currentPlaylist && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/40 border border-violet-500/30 text-xs shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-zinc-200 max-w-[120px] truncate">{currentPlaylist.name}</span>
            <span className="text-zinc-500">·</span>
            <span className="uppercase text-[9px] tracking-wider font-bold text-violet-400 px-1.5 py-0.5 rounded bg-violet-500/10">
              {t(`${currentPlaylist.type}_mode`)}
            </span>
            {currentPlaylist.room_code && (
              <span className="text-[10px] font-mono text-cyan-300 font-bold">
                #{currentPlaylist.room_code}
              </span>
            )}
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl glass-button text-xs font-semibold text-zinc-300 hover:text-white"
              title={t('language')}
            >
              <span className="text-sm">{LANGUAGES.find(l => l.code === language)?.flag || '🌐'}</span>
              <span className="hidden sm:inline uppercase text-[10px] text-zinc-400">{language}</span>
            </button>

            {langMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-36 rounded-2xl glass-panel p-1.5 shadow-2xl border border-white/10 z-50 animate-fade-in"
                onClick={() => setLangMenuOpen(false)}
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      language === lang.code
                        ? 'bg-violet-600 text-white font-bold'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                    {language === lang.code && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User / Login */}
          {user ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl glass-button text-xs text-zinc-200 hover:text-white"
                title="Account"
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${user.isGuest ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className="font-medium max-w-[60px] sm:max-w-[90px] truncate">{user.username}</span>
              </button>
              <button
                onClick={logout}
                className="p-1.5 rounded-xl glass-button text-zinc-500 hover:text-red-400 shrink-0"
                title={t('logout')}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition-all shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('login')}</span>
            </button>
          )}

        </div>
      </div>

      {/* Mobile Room Status bar (shows below main header when in a room) */}
      {currentPlaylist && (
        <div className="md:hidden px-3 pb-1.5 flex items-center gap-2 text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="font-semibold text-zinc-300 truncate max-w-[120px]">{currentPlaylist.name}</span>
          <span className="text-zinc-600">·</span>
          <span className="uppercase tracking-wider font-bold text-violet-400 px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
            {t(`${currentPlaylist.type}_mode`)}
          </span>
          {currentPlaylist.room_code && (
            <span className="font-mono text-cyan-400 font-bold ml-auto">#{currentPlaylist.room_code}</span>
          )}
        </div>
      )}
    </header>
  );
}
