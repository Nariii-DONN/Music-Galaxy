create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  cover_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_key text not null,
  provider text not null,
  provider_track_id text not null,
  position integer not null default 0,
  title text,
  artist text,
  artwork_url text,
  stream_url text,
  created_at timestamptz not null default now(),
  primary key (playlist_id, track_key)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.track_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_key text not null,
  provider text not null,
  provider_track_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, track_key)
);

create index if not exists playlists_owner_idx on public.playlists(owner_id);
create index if not exists playlists_public_idx on public.playlists(is_public, updated_at desc);
create index if not exists playlist_tracks_playlist_idx on public.playlist_tracks(playlist_id, position);
create index if not exists follows_following_idx on public.follows(following_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), 'user_' || substr(replace(new.id::text,'-',''),1,10)), coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.follows enable row level security;
alter table public.track_likes enable row level security;

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles for select using (true);
drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists playlists_public_read on public.playlists;
create policy playlists_public_read on public.playlists for select using (is_public or owner_id=auth.uid());
drop policy if exists playlists_owner_insert on public.playlists;
create policy playlists_owner_insert on public.playlists for insert with check (owner_id=auth.uid());
drop policy if exists playlists_owner_update on public.playlists;
create policy playlists_owner_update on public.playlists for update using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists playlists_owner_delete on public.playlists;
create policy playlists_owner_delete on public.playlists for delete using (owner_id=auth.uid());

drop policy if exists playlist_tracks_read on public.playlist_tracks;
create policy playlist_tracks_read on public.playlist_tracks for select using (exists(select 1 from public.playlists p where p.id=playlist_id and (p.is_public or p.owner_id=auth.uid())));
drop policy if exists playlist_tracks_owner_write on public.playlist_tracks;
create policy playlist_tracks_owner_write on public.playlist_tracks for all using (exists(select 1 from public.playlists p where p.id=playlist_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.playlists p where p.id=playlist_id and p.owner_id=auth.uid()));

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select using (true);
drop policy if exists follows_self_write on public.follows;
create policy follows_self_write on public.follows for all using (follower_id=auth.uid()) with check (follower_id=auth.uid());

drop policy if exists likes_read on public.track_likes;
create policy likes_read on public.track_likes for select using (true);
drop policy if exists likes_self_write on public.track_likes;
create policy likes_self_write on public.track_likes for all using (user_id=auth.uid()) with check (user_id=auth.uid());
