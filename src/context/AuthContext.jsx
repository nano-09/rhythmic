import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, authService, createGuestUser, clearGuestUser, getStoredGuestUser } from '../services/supabase';

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
        const guest = getStoredGuestUser();
        if (guest) {
          setUser(guest);
        } else {
          // Auto create guest so user can immediately experience the app if desired
          const newGuest = createGuestUser('Guest');
          setUser(newGuest);
        }
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
        const guest = getStoredGuestUser();
        setUser(guest);
      }
    });

    return () => {
      subscription?.unsubscribe();
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
    const guest = createGuestUser('Guest');
    setUser(guest);
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
