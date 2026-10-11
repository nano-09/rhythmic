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

export const getStoredGuestUser = () => {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading guest profile:', e);
  }
  return null;
};

export const createGuestUser = (nickname = 'Guest') => {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const guestUser = {
    id: `guest_${Date.now()}_${randomSuffix}`,
    email: null,
    username: nickname.trim() || `Guest_${randomSuffix}`,
    isGuest: true,
  };
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUser));
  return guestUser;
};

export const clearGuestUser = () => {
  localStorage.removeItem(GUEST_STORAGE_KEY);
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
      host_user_id: currentUser.id,
      host_name: currentUser.username,
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
      user_id: currentUser.id,
      username: currentUser.username,
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
    const newTrack = {
      playlist_id: playlistId,
      title: track.title,
      artist: track.artist || '',
      youtube_id: track.youtubeId,
      duration: track.duration || 0,
      thumbnail: track.thumbnail || '',
      position: position ?? 0,
      added_by_id: currentUser.id,
      added_by_name: currentUser.username,
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
