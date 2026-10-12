import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ydlipcddluppspokcpvq.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_L5-CFrPnH6WJLkJUv1jBKg_QpyK0ghl';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

const GUEST_STORAGE_KEY = 'syncbeats_guest_profile';

// Generate a per-tab session key so each browser tab has its own identity slot.
// This prevents one tab's "Continue as Guest" from overwriting another tab's host identity.
const getTabSessionKey = () => {
  if (!sessionStorage.getItem('syncbeats_tab_id')) {
    sessionStorage.setItem('syncbeats_tab_id', `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  }
  return `${GUEST_STORAGE_KEY}_${sessionStorage.getItem('syncbeats_tab_id')}`;
};

export const getStoredGuestUser = () => {
  try {
    // First try the tab-scoped key, fall back to the legacy shared key
    const tabKey = getTabSessionKey();
    const tabRaw = localStorage.getItem(tabKey);
    if (tabRaw) return JSON.parse(tabRaw);

    // Legacy fallback: if there's a shared key, migrate it to the tab-scoped key
    const legacyRaw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (legacyRaw) {
      const legacyUser = JSON.parse(legacyRaw);
      localStorage.setItem(tabKey, legacyRaw);
      // Don't delete the legacy key, other tabs may be using it
      return legacyUser;
    }
  } catch (e) {
    console.error('Error reading guest profile:', e);
  }
  return null;
};

export const createGuestUser = (nickname = 'Guest') => {
  // Use crypto.randomUUID() for a truly unique, collision-proof guest ID
  const uid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? `guest_${crypto.randomUUID()}`
    : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  const guestUser = {
    id: uid,
    email: null,
    username: nickname.trim() || `Guest_${uid.slice(-6)}`,
    isGuest: true,
  };

  // Store under the tab-scoped key so other tabs are unaffected
  const tabKey = getTabSessionKey();
  localStorage.setItem(tabKey, JSON.stringify(guestUser));
  return guestUser;
};

export const clearGuestUser = () => {
  try {
    // Clear only THIS tab's guest profile
    localStorage.removeItem(getTabSessionKey());
  } catch (e) {}
};

// ================= AUTH HELPERS =================
export const authService = {
  async signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username || email.split('@')[0] },
      },
    });
    if (error) throw error;
    clearGuestUser();
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    clearGuestUser();
    return data;
  },

  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    clearGuestUser();
    const { error } = await supabase.auth.signOut();
    if (error) console.error('SignOut error:', error);
  },

  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email,
        username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
        isGuest: false,
      };
    }
    return getStoredGuestUser();
  },
};

// ================= PLAYLIST API =================
export const playlistService = {
  // Generate random 4-digit numeric code
  generate4DigitCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  },

  async createPlaylist({ name, type, isPublic, password, currentUser }) {
    const user = currentUser || getStoredGuestUser() || createGuestUser();
    let roomCode = null;
    if (isPublic) {
      roomCode = this.generate4DigitCode();
    }

    const newPlaylist = {
      name: name.trim(),
      type, // 'party', 'jam', 'playlist'
      is_public: isPublic,
      room_code: roomCode,
      password: password?.trim() || null,
      host_user_id: user.id,
      host_name: user.username,
      playback_state: {
        current_track_id: null,
        current_track_index: 0,
        is_playing: false,
        current_time: 0,
        loop_mode: 'off',
        shuffle: false,
        autoplay: true,
        updated_at: Date.now(),
      },
    };

    const { data, error } = await supabase
      .from('playlists')
      .insert(newPlaylist)
      .select()
      .single();

    if (error) throw error;

    // Add creator as host member
    await supabase.from('playlist_members').insert({
      playlist_id: data.id,
      user_id: user.id,
      username: user.username,
      role: 'host',
      is_online: true,
    });

    return data;
  },

  async getPlaylistById(id) {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async findByRoomCode(code) {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('room_code', code.trim())
      .single();
    if (error) throw new Error('Playlist with code ' + code + ' not found.');
    return data;
  },

  async updatePlaybackState(playlistId, playbackState) {
    const { error } = await supabase
      .from('playlists')
      .update({
        playback_state: {
          ...playbackState,
          updated_at: Date.now(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', playlistId);
    if (error) console.error('Error updating playback state:', error);
  },

  async transferHost(playlistId, newHostId, newHostName) {
    // 1. Update playlist record
    const { error: plError } = await supabase
      .from('playlists')
      .update({
        host_user_id: newHostId,
        host_name: newHostName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', playlistId);
    if (plError) throw plError;

    // 2. Update members table
    await supabase
      .from('playlist_members')
      .update({ role: 'member' })
      .eq('playlist_id', playlistId)
      .eq('role', 'host');

    await supabase
      .from('playlist_members')
      .update({ role: 'host' })
      .eq('playlist_id', playlistId)
      .eq('user_id', newHostId);
  },

  async deletePlaylist(playlistId) {
    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId);
    if (error) throw error;
  },

  // Tracks
  async getTracks(playlistId) {
    const { data, error } = await supabase
      .from('playlist_tracks')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addTrack({ playlistId, track, currentUser, position }) {
    const user = currentUser || getStoredGuestUser() || createGuestUser();
    const newTrack = {
      playlist_id: playlistId,
      title: track.title,
      artist: track.artist || '',
      youtube_id: track.youtubeId,
      duration: track.duration || 0,
      thumbnail: track.thumbnail || '',
      position: position ?? 0,
      added_by_id: user.id,
      added_by_name: user.username,
    };

    const { data, error } = await supabase
      .from('playlist_tracks')
      .insert(newTrack)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeTrack(trackId) {
    const { error } = await supabase
      .from('playlist_tracks')
      .delete()
      .eq('id', trackId);
    if (error) throw error;
  },

  async reorderTracks(playlistId, orderedTracks) {
    const promises = orderedTracks.map((tr, index) =>
      supabase
        .from('playlist_tracks')
        .update({ position: index })
        .eq('id', tr.id)
    );
    await Promise.all(promises);
  },

  // Members
  async joinMember(playlistId, user) {
    const { data, error } = await supabase
      .from('playlist_members')
      .upsert({
        playlist_id: playlistId,
        user_id: user.id,
        username: user.username,
        is_online: true,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'playlist_id,user_id' })
      .select()
      .single();
    if (error) console.error('Error joining member:', error);
    return data;
  },

  async leaveMember(playlistId, userId) {
    await supabase
      .from('playlist_members')
      .update({ is_online: false, last_seen: new Date().toISOString() })
      .eq('playlist_id', playlistId)
      .eq('user_id', userId);
  },

  async getMembers(playlistId) {
    const { data, error } = await supabase
      .from('playlist_members')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },
};
