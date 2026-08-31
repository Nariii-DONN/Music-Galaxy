import type { MusicProvider, Track } from './types'
import { audiusProvider } from '../providers/audius'
import { jamendoProvider } from '../providers/jamendo'

export const providers: MusicProvider[] = [
  audiusProvider,
  jamendoProvider,
]

export async function searchAll(
  query: string,
): Promise<Track[]> {
  const results = await Promise.allSettled(
    providers.map((provider) => provider.search(query)),
  )

  const tracks: Track[] = []

  results.forEach((result, index) => {
    const provider = providers[index]

    if (result.status === 'fulfilled') {
      tracks.push(...result.value)
    } else {
      console.warn(
        `${provider.name} search failed:`,
        result.reason,
      )
    }
  })

  return tracks
}

export async function trendingAll(): Promise<Track[]> {
  const results = await Promise.allSettled(
    providers.map((provider) => provider.trending()),
  )

  const tracks: Track[] = []

  results.forEach((result, index) => {
    const provider = providers[index]

    if (result.status === 'fulfilled') {
      tracks.push(...result.value)
    } else {
      console.warn(
        `${provider.name} trending failed:`,
        result.reason,
      )
    }
  })

  return tracks
}

export async function getStreamUrl(
  track: Track,
): Promise<string | null> {
  if (track.streamUrl) {
    return track.streamUrl
  }

  const provider = providers.find(
    (p) => p.id === track.provider,
  )

  if (!provider) {
    return null
  }

  return provider.stream(track)
}

export function aiDj(
  seed: Track,
  pool: Track[],
): Track[] {
  const tokens = new Set([
    seed.genre.toLowerCase(),
    seed.mood.toLowerCase(),
    ...(seed.tags || []).map((x) =>
      x.toLowerCase(),
    ),
  ])

  return pool
    .filter((x) => x.id !== seed.id)
    .map((x) => ({
      x,
      score:
        (tokens.has(x.genre.toLowerCase()) ? 4 : 0) +
        (tokens.has(x.mood.toLowerCase()) ? 3 : 0) +
        (Math.abs(
          (x.bpm || 100) - (seed.bpm || 100),
        ) < 15
          ? 2
          : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.x)
    .slice(0, 12)
}