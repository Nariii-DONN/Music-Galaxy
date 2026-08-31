# MusicGalaxy

A futuristic 3D music discovery experience built with React, Vite, Three.js / React Three Fiber, Framer Motion and Zustand.

## Run locally

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm run preview
```

## Render

Use a Render Static Site:

- Build: `npm ci && npm run build`
- Publish directory: `dist`

The included `render.yaml` configures the Vite static build and SPA fallback.

## Music providers

The current build uses demo metadata and a provider-ready UI architecture. Add real music playback only through providers whose official APIs and licenses permit the intended use. Never expose private/service-role keys in `VITE_*` variables and never bypass DRM or provider restrictions.

## Next integrations

- Supabase Auth + database
- legal free/open music provider adapter
- premium provider adapters
- user uploads for owned music
- public playlist persistence
- social profiles/follows
- AI DJ/recommendations
- synchronized listening rooms
