# MusicGalaxy QA Checklist

This build is intended to preserve the existing MusicGalaxy runtime behavior and visual system while improving packaging, resilience, and client-side performance.

## Before release

- Run `npm ci`.
- Run `npm run build` and confirm the production build succeeds.
- Run `npm run dev` and verify the Galaxy, Explore, Library, and Playlists views.
- Verify local audio import, playback, seek, volume, mute, shuffle, repeat, favorites, playlists, and recently played behavior.
- Verify search and provider failures do not prevent the rest of the application from rendering.
- Test mouse, touch, and coarse-pointer interactions in the Galaxy view.
- Test desktop and mobile breakpoints.
- Test a hard refresh after importing local tracks and after creating a playlist.
- Keep `.env.local` out of source control and deployment artifacts; use `.env.example` as the template.

## Performance safeguards included

- Paused player waveform animation no longer runs a requestAnimationFrame loop; it updates only when playback position or duration changes.
- Artwork success/error logging was removed from the normal render path to avoid console noise and unnecessary work.
- Frequently recomputed derived App data is memoized without changing its values or ordering.
- Vendor chunking keeps React, Motion, icons, Three.js/R3F, Supabase, and Zustand dependencies separated for better browser caching.
- The delivery archive excludes `node_modules`, `.git`, `dist`, and local environment secrets.
