# MusicGalaxy — social 3D music universe

MusicGalaxy is a Vite + React + Three.js experience with a provider-agnostic music layer, local owned-music playback, Supabase accounts/playlists, public playlist publishing, social tables, and an AI-DJ recommendation baseline.

## 1. Install

```bash
npm install
npm run dev
```

## 2. Supabase

Create a Supabase project and run `supabase/migrations/001_musicgalaxy.sql` in the SQL editor. Add these browser-safe variables to `.env.local`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never expose a Supabase service-role key in the browser or in a `VITE_*` variable.

The migration creates profiles, playlists, playlist tracks, follows, likes, an auth trigger, and RLS policies.

## 3. Free/open music

### Audius

Create a free Audius API key and set:

```env
VITE_AUDIUS_API_KEY=
```

The adapter uses read/search/trending/stream endpoints and can be replaced without changing the UI. The Audius free plan currently documents 10 requests/sec and 500,000 requests/month.

### Jamendo (optional)

Create a Jamendo developer client ID and set:

```env
VITE_JAMENDO_CLIENT_ID=
```

Jamendo's API provides a large catalog and read methods, but commercial use of some Jamendo music/services can require a commercial license. Verify the license for the exact use case before publishing.

## 4. Local / owned music

Use **Import device music**. Files are played locally with browser object URLs; MusicGalaxy does not upload them automatically.

## 5. Publish playlists

Sign up/sign in, then use **Publish**. The app writes playlist metadata and track metadata to Supabase. Public playlists are readable through RLS while only the owner can modify their playlist.

## 6. AI DJ

The first AI-DJ layer is deterministic and local: genre, mood, tags and BPM similarity generate recommendations without requiring a paid AI API. A future model adapter can replace this function without changing music providers.

## 7. Render

Create a **Static Site** in Render:

- Branch: `main`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

The included `render.yaml` adds the SPA rewrite.

## Architecture

`src/providers/*` contains replaceable provider adapters. `src/lib/music.ts` is the provider registry and AI-DJ layer. `src/lib/supabase.ts` is the browser Supabase client. `supabase/migrations` contains the database/RLS schema.
