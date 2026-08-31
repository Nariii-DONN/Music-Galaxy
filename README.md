# MusicGalaxy

A cinematic 3D music discovery experience built with React, Vite, Three.js, React Three Fiber and Framer Motion.

## Local development

```bash
npm ci
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Render

This repository is configured for Render Static Site deployment through `render.yaml`.

- Build: `npm ci && npm run build`
- Publish directory: `dist`
- SPA fallback: `/*` → `/index.html`

Add required `VITE_*` variables in Render. Never commit Supabase service-role keys or other private credentials. Vite `VITE_*` variables are public in the browser.
