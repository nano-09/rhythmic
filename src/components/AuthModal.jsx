import React, { useState } from 'react';
import { X, Mail, Lock, User, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { user, loginWithEmail, signupWithEmail, loginWithGoogle, loginAsGuest } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'signup' | 'guest'
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [guestName, setGuestName] = useState(user?.isGuest ? user.username : '');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
        onClose();
      } else if (tab === 'signup') {
        await signupWithEmail(email, password, username);
        setSuccessMsg('Account created successfully! You are now logged in.');
        setTimeout(() => onClose(), 1200);
      } else if (tab === 'guest') {
        loginAsGuest(guestName || 'Guest');
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      await loginWithGoogle();
    } catch (err) {
      setErrorMsg(
        err.message?.includes('provider')
          ? 'Google OAuth provider is not configured in Supabase console yet. You can sign in with Email or use Guest Mode.'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 overflow-hidden">
        
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-violet-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white glass-button"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            {tab === 'login' ? 'Welcome Back' : tab === 'signup' ? 'Create Account' : 'Guest Session'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {tab === 'login'
              ? 'Login to sync playlists and jam with friends'
              : tab === 'signup'
              ? 'Join Sync Beats with your email'
              : 'Jump straight into the music without registration'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 mb-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMsg(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              tab === 'login' ? 'bg-violet-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setErrorMsg(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              tab === 'signup' ? 'bg-violet-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => { setTab('guest'); setErrorMsg(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              tab === 'guest' ? 'bg-violet-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Guest
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
            {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Username / Nickname</label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. BeatMaster"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm"
                />
              </div>
            </div>
          )}

          {tab === 'guest' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Display Nickname</label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Guest DJ"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm"
                />
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                Guest sessions allow you to create rooms, join parties, and play songs without signing in.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>{tab === 'login' ? 'Sign In' : tab === 'signup' ? 'Create Account' : 'Continue as Guest'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Google OAuth Option */}
        {tab !== 'guest' && (
          <div className="mt-5 pt-5 border-t border-white/10">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 rounded-xl glass-button text-xs font-medium text-zinc-200 flex items-center justify-center gap-2 hover:bg-white/10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
