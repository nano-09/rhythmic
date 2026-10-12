import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, authService, createGuestUser, clearGuestUser, getStoredGuestUser } from '../services/supabase';
import { Capacitor } from '@capacitor/core';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const initAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
          isGuest: false,
        });
      } else {
        // Restore THIS tab's existing guest identity if present — never auto-create
        const guest = getStoredGuestUser();
        if (guest) {
          setUser(guest);
        }
        // If no guest is stored, user stays null → they must explicitly choose login/guest
      }
    } catch (e) {
      console.error('Error during initAuth:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
          isGuest: false,
        });
      } else if (event === 'SIGNED_OUT') {
        setUser(getStoredGuestUser());
      }
    });

    // Native-only: handle the Google OAuth deep-link callback
    let appListener = null;
    if (Capacitor.isNativePlatform()) {
      (async () => {
        const { App: CapApp } = await import('@capacitor/app');
        const { Browser } = await import('@capacitor/browser');

        appListener = await CapApp.addListener('appUrlOpen', async ({ url }) => {
          if (!url.startsWith('com.syncbeats.app://auth-callback')) return;
          await Browser.close().catch(() => { });

          const u = new URL(url.replace('#', '?'));
          const code = u.searchParams.get('code');
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          } else {
            const access_token = u.searchParams.get('access_token');
            const refresh_token = u.searchParams.get('refresh_token');
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        });
      })();
    }

    return () => {
      subscription?.unsubscribe();
      appListener?.remove();
    };
  }, []);

  const loginWithEmail = async (email, password) => {
    const res = await authService.signIn(email, password);
    if (res.user) {
      setUser({
        id: res.user.id,
        email: res.user.email,
        username: res.user.user_metadata?.username || res.user.email?.split('@')[0] || 'User',
        isGuest: false,
      });
    }
    return res;
  };

  const signupWithEmail = async (email, password, username) => {
    const res = await authService.signUp(email, password, username);
    if (res.user) {
      setUser({
        id: res.user.id,
        email: res.user.email,
        username: username || res.user.email?.split('@')[0] || 'User',
        isGuest: false,
      });
    }
    return res;
  };

  const loginWithGoogle = async () => {
    return await authService.signInWithGoogle();
  };

  const loginAsGuest = (nickname) => {
    const guest = createGuestUser(nickname);
    setUser(guest);
    return guest;
  };

  const logout = async () => {
    await authService.signOut();
    clearGuestUser();
    // Don't auto-create a new guest — let the user explicitly choose what to do next
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        loginAsGuest,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
