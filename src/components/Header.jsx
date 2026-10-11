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
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 py-3 transition-all">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        
        {/* Brand */}
        <div 
          onClick={() => { if (currentPlaylist) leaveRoom(); }}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Music2 className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              {t('brand_title')}
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 -mt-1 font-semibold">
              {t('brand_subtitle')}
            </p>
          </div>
        </div>

        {/* Center Room Status (if in a room) */}
        {currentPlaylist && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-950/40 border border-violet-500/30 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-zinc-200">{currentPlaylist.name}</span>
            <span className="text-zinc-500">•</span>
            <span className="uppercase text-[10px] tracking-wider font-bold text-violet-400 px-1.5 py-0.5 rounded bg-violet-500/10">
              {t(`${currentPlaylist.type}_mode`)}
            </span>
            {currentPlaylist.room_code && (
              <span className="text-[11px] font-mono text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                #{currentPlaylist.room_code}
              </span>
            )}
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          
          {/* Language Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-button text-xs font-semibold text-zinc-300 hover:text-white"
              title={t('language')}
            >
              <span>{LANGUAGES.find(l => l.code === language)?.flag || '🌐'}</span>
              <span className="hidden sm:inline uppercase">{language}</span>
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
                    {language === lang.code && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User profile / Login */}
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-button text-xs text-zinc-200 hover:text-white"
                title="Account Settings"
              >
                <div className={`w-2 h-2 rounded-full ${user.isGuest ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className="font-medium max-w-[90px] truncate">{user.username}</span>
                {user.isGuest && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded uppercase font-bold">
                    {t('guest')}
                  </span>
                )}
              </button>

              <button
                onClick={logout}
                className="p-1.5 rounded-xl glass-button text-zinc-400 hover:text-red-400"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('login')}</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
}
