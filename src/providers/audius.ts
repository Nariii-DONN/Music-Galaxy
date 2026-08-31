import type { MusicProvider, Track } from '../lib/types'

const API = 'https://api.audius.co/v1'
const key = import.meta.env.VITE_AUDIUS_API_KEY as string | undefined

function headers(): HeadersInit {
  if (!key) return {}
  return { 'X-API-Key': key }
}

function map(t: any): Track {
  const seconds = Number(t.duration || 0)
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return {
    id: `audius:${t.id}`,
    provider: 'audius', providerId: t.id,
    title: t.title || 'Untitled', artist: t.user?.name || 'Unknown artist',
    album: t.album?.albumTitle || 'Single', genre: t.genre || 'Unknown',
    mood: t.mood || 'Open', color: '#7c3aed', duration: seconds,
    durationLabel: `${m}:${s}`, artworkUrl: t.artwork?._480x480 || t.artwork?._150x150,
    permalink: t.permalink, license: t.license, downloadable: t.downloadable,
    tags: t.tags || [], bpm: t.bpm,
  }
}

async function get(path: string) {
  const r = await fetch(`${API}${path}`, { headers: headers() })
  if (!r.ok) throw new Error(`Audius ${r.status}`)
  return r.json()
}

export const audiusProvider: MusicProvider = {
  id: 'audius', name: 'Audius',
  async search(q) {
    const data = await get(`/tracks/search?query=${encodeURIComponent(q)}&limit=30`)
    return (data.data || []).filter((x:any) => x.isStreamable !== false).map(map)
  },
  async trending() {
    const data = await get('/tracks/trending?limit=30&time=week')
    return (data.data || []).filter((x:any) => x.isStreamable !== false).map(map)
  },
  async stream(track) {
    return `${API}/tracks/${encodeURIComponent(track.providerId)}/stream`
  },
}
