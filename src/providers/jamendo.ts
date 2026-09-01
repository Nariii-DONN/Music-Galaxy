import type { Track, MusicProvider } from '../lib/types'

const API = 'https://api.jamendo.com/v3.0'

const clientId =
  import.meta.env.VITE_JAMENDO_CLIENT_ID as string | undefined

function durationLabel(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)

  return `${m}:${String(s).padStart(2, '0')}`
}

function firstString(
  ...values: unknown[]
): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

function mapTrack(t: any): Track {
  const duration = Number(t?.duration || 0)

  const artwork = firstString(
    t?.image,
    t?.album_image,
  )

  return {
    id: `jamendo:${t.id}`,
    provider: 'jamendo',
    providerId: String(t.id),
    title: t.name || 'Unknown track',
    artist: t.artist_name || 'Unknown artist',
    album: t.album_name || 'Single',
    genre:
      t.musicinfo?.tags?.genres?.[0] ||
      'Unknown',
    mood:
      t.musicinfo?.tags?.instruments?.[0] ||
      'Music',
    color: '#8b5cf6',
    duration,
    durationLabel: durationLabel(duration),
    bpm:
      Number(t.musicinfo?.tempo || 0) ||
      undefined,
    artworkUrl: artwork,
    streamUrl: firstString(t.audio),
    permalink: firstString(t.shareurl),
    license: firstString(t.license_ccurl),
    downloadable: Boolean(
      t.audiodownload_allowed,
    ),
    tags: Array.isArray(
      t.musicinfo?.tags?.genres,
    )
      ? t.musicinfo.tags.genres
      : [],
  }
}

async function request(
  params: Record<string, string>,
): Promise<any[]> {
  if (!clientId) {
    throw new Error(
      'VITE_JAMENDO_CLIENT_ID is missing',
    )
  }

  const url = new URL(
    `${API}/tracks/`,
  )

  url.searchParams.set(
    'client_id',
    clientId,
  )

  url.searchParams.set(
    'format',
    'json',
  )

  url.searchParams.set(
    'include',
    'musicinfo',
  )

  url.searchParams.set(
    'imagesize',
    '500',
  )

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Jamendo API ${response.status}`,
    )
  }

  const data = await response.json()

  return Array.isArray(data?.results)
    ? data.results
    : []
}

export const jamendoProvider: MusicProvider = {
  id: 'jamendo',
  name: 'Jamendo',

  async search(query: string): Promise<Track[]> {
    const results = await request({
      search: query,
      limit: '30',
      order: 'relevance',
    })

    return results.map(mapTrack)
  },

  async trending(): Promise<Track[]> {
    const results = await request({
      order: 'popularity_week_desc',
      limit: '30',
    })

    return results.map(mapTrack)
  },

  async stream(track: Track): Promise<string | null> {
    if (!clientId) {
      console.warn(
        'Jamendo client ID is missing',
      )

      return null
    }

    if (track.streamUrl) {
      return track.streamUrl
    }

    const url = new URL(
      `${API}/tracks/file/`,
    )

    url.searchParams.set(
      'client_id',
      clientId,
    )

    url.searchParams.set(
      'id',
      track.providerId,
    )

    url.searchParams.set(
      'action',
      'stream',
    )

    url.searchParams.set(
      'audioformat',
      'mp32',
    )

    return url.toString()
  },
}
