-- ==============================================================================
-- SYNC BEATS - SUPABASE DATABASE SCHEMA
-- Execute this entire script in your Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Drop existing tables if re-initializing (Optional, uncomment if needed)
-- drop table if exists public.playlist_members cascade;
-- drop table if exists public.playlist_tracks cascade;
-- drop table if exists public.playlists cascade;

-- 3. Create Playlists Table
create table if not exists public.playlists (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    type text not null check (type in ('party', 'jam', 'playlist')),
    is_public boolean not null default true,
    room_code text, -- 4-digit code for public playlists (e.g. '5921')
    password text,  -- optional plain/hash password
    host_user_id text not null,
    host_name text not null default 'Host',
    playback_state jsonb not null default '{
        "current_track_id": null,
        "current_track_index": 0,
        "is_playing": false,
        "current_time": 0,
        "loop_mode": "off",
        "shuffle": false,
        "autoplay": true,
        "updated_at": 0
    }'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Index room code for rapid lookup when joining
create index if not exists idx_playlists_room_code on public.playlists(room_code);
create index if not exists idx_playlists_host_user_id on public.playlists(host_user_id);

-- 4. Create Playlist Tracks Table
create table if not exists public.playlist_tracks (
    id uuid primary key default uuid_generate_v4(),
    playlist_id uuid not null references public.playlists(id) on delete cascade,
    title text not null,
    artist text default '',
    youtube_id text not null,
    duration integer default 0, -- duration in seconds
    thumbnail text default '',
    position integer not null default 0,
    added_by_id text not null,
    added_by_name text not null default 'User',
    created_at timestamptz not null default now()
);

create index if not exists idx_tracks_playlist_id on public.playlist_tracks(playlist_id);
create index if not exists idx_tracks_position on public.playlist_tracks(playlist_id, position);

-- 5. Create Playlist Members Table
create table if not exists public.playlist_members (
    id uuid primary key default uuid_generate_v4(),
    playlist_id uuid not null references public.playlists(id) on delete cascade,
    user_id text not null,
    username text not null,
    role text not null default 'member' check (role in ('host', 'member')),
    is_online boolean default true,
    last_seen timestamptz not null default now(),
    joined_at timestamptz not null default now(),
    unique (playlist_id, user_id)
);

create index if not exists idx_members_playlist_id on public.playlist_members(playlist_id);
create index if not exists idx_members_user_id on public.playlist_members(user_id);

-- 6. Enable Row Level Security (RLS)
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.playlist_members enable row level security;

-- 7. RLS Policies: Allow public read & write access for anon & authenticated users
-- (Ensures guests and authenticated users can seamlessly interact with party/jam/playlist rooms)
drop policy if exists "Enable read access for all users on playlists" on public.playlists;
create policy "Enable read access for all users on playlists"
    on public.playlists for select
    using (true);

drop policy if exists "Enable insert access for all users on playlists" on public.playlists;
create policy "Enable insert access for all users on playlists"
    on public.playlists for insert
    with check (true);

drop policy if exists "Enable update access for all users on playlists" on public.playlists;
create policy "Enable update access for all users on playlists"
    on public.playlists for update
    using (true);

drop policy if exists "Enable delete access for all users on playlists" on public.playlists;
create policy "Enable delete access for all users on playlists"
    on public.playlists for delete
    using (true);

-- Tracks Policies
drop policy if exists "Enable read access for all users on playlist_tracks" on public.playlist_tracks;
create policy "Enable read access for all users on playlist_tracks"
    on public.playlist_tracks for select
    using (true);

drop policy if exists "Enable insert access for all users on playlist_tracks" on public.playlist_tracks;
create policy "Enable insert access for all users on playlist_tracks"
    on public.playlist_tracks for insert
    with check (true);

drop policy if exists "Enable update access for all users on playlist_tracks" on public.playlist_tracks;
create policy "Enable update access for all users on playlist_tracks"
    on public.playlist_tracks for update
    using (true);

drop policy if exists "Enable delete access for all users on playlist_tracks" on public.playlist_tracks;
create policy "Enable delete access for all users on playlist_tracks"
    on public.playlist_tracks for delete
    using (true);

-- Members Policies
drop policy if exists "Enable read access for all users on playlist_members" on public.playlist_members;
create policy "Enable read access for all users on playlist_members"
    on public.playlist_members for select
    using (true);

drop policy if exists "Enable insert access for all users on playlist_members" on public.playlist_members;
create policy "Enable insert access for all users on playlist_members"
    on public.playlist_members for insert
    with check (true);

drop policy if exists "Enable update access for all users on playlist_members" on public.playlist_members;
create policy "Enable update access for all users on playlist_members"
    on public.playlist_members for update
    using (true);

drop policy if exists "Enable delete access for all users on playlist_members" on public.playlist_members;
create policy "Enable delete access for all users on playlist_members"
    on public.playlist_members for delete
    using (true);

-- 8. Enable Supabase Realtime for table updates
-- This publishes table events over WebSockets so all connected clients stay in sync
do $$
begin
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'playlists'
    ) then
        alter publication supabase_realtime add table public.playlists;
    end if;

    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'playlist_tracks'
    ) then
        alter publication supabase_realtime add table public.playlist_tracks;
    end if;

    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'playlist_members'
    ) then
        alter publication supabase_realtime add table public.playlist_members;
    end if;
end $$;

-- 9. Helper Function to generate unique 4-digit numeric room code
create or replace function public.generate_unique_room_code()
returns text as $$
declare
    new_code text;
    code_exists boolean;
begin
    loop
        -- Generate random 4-digit code between 1000 and 9999
        new_code := floor(1000 + random() * 9000)::text;
        
        -- Check if currently active in public playlists
        select exists(
            select 1 from public.playlists 
            where room_code = new_code 
            and is_public = true
        ) into code_exists;
        
        if not code_exists then
            return new_code;
        end if;
    end loop;
end;
$$ language plpgsql volatile;
