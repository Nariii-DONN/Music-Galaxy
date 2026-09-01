import type {
  MusicProvider,
  Track,
} from '../lib/types'

const API =
  'https://api.audius.co/v1'

const key =
  import.meta.env
    .VITE_AUDIUS_API_KEY as
    | string
    | undefined


function headers(): HeadersInit {
  if (!key) {
    return {}
  }

  return {
    'X-API-Key': key,
  }
}


/* ==========================================================================
   ARTWORK
   ========================================================================== */

function getArtwork(
  track: any,
): string | undefined {
  const artwork =
    track?.artwork

  if (
    !artwork
  ) {
    return undefined
  }

  /*
   * Audius currently returns keys such as:
   *
   * 150x150
   * 480x480
   * 1000x1000
   *
   * NOT:
   *
   * _150x150
   * _480x480
   */

  if (
    typeof artwork ===
    'string'
  ) {
    return artwork
  }

  return (
    artwork['1000x1000'] ||
    artwork['480x480'] ||
    artwork['150x150'] ||
    artwork._1000x1000 ||
    artwork._480x480 ||
    artwork._150x150 ||
    undefined
  )
}


/* ==========================================================================
   TAGS
   ========================================================================== */

function getTags(
  value: unknown,
): string[] {
  if (
    Array.isArray(value)
  ) {
    return value
      .map(String)
      .map(
        (tag) =>
          tag.trim(),
      )
      .filter(Boolean)
  }

  if (
    typeof value ===
    'string'
  ) {
    return value
      .split(',')
      .map(
        (tag) =>
          tag.trim(),
      )
      .filter(Boolean)
  }

  return []
}


/* ==========================================================================
   TRACK MAPPER
   ========================================================================== */

function map(
  track: any,
): Track {
  const seconds =
    Number(
      track?.duration ||
        0,
    )

  const minutes =
    Math.floor(
      seconds / 60,
    )

  const remaining =
    Math.floor(
      seconds % 60,
    )

  const artwork =
    getArtwork(track)

  const tags =
    getTags(
      track?.tags,
    )

  return {
    id:
      `audius:${track.id}`,

    provider:
      'audius',

    providerId:
      String(
        track.id,
      ),

    title:
      track.title ||
      'Untitled',

    artist:
      track.user?.name ||
      'Unknown artist',

    album:
      track.album?.albumTitle ||
      'Single',

    genre:
      track.genre ||
      'Unknown',

    mood:
      track.mood ||
      'Open',

    color:
      '#7c3aed',

    duration:
      seconds,

    durationLabel:
      `${minutes}:${String(
        remaining,
      ).padStart(
        2,
        '0',
      )}`,

    /*
     * THIS IS THE IMPORTANT FIX.
     */
    artworkUrl:
      artwork,

    permalink:
      track.permalink,

    license:
      track.license,

    downloadable:
      Boolean(
        track.is_downloadable ??
        track.downloadable,
      ),

    tags,

    bpm:
      Number(
        track.bpm || 0,
      ) ||
      undefined,

    streamUrl:
      undefined,
  }
}


/* ==========================================================================
   REQUEST
   ========================================================================== */

async function get(
  path: string,
): Promise<any> {
  const response =
    await fetch(
      `${API}${path}`,
      {
        headers:
          headers(),
      },
    )

  if (
    !response.ok
  ) {
    throw new Error(
      `Audius ${response.status}`,
    )
  }

  return response.json()
}


/* ==========================================================================
   PROVIDER
   ========================================================================== */

export const audiusProvider:
  MusicProvider = {
    id: 'audius',

    name: 'Audius',

    async search(
      query: string,
    ): Promise<Track[]> {
      const data =
        await get(
          `/tracks/search?query=${encodeURIComponent(
            query,
          )}&limit=30`,
        )

      return (
        data.data || []
      )
        .filter(
          (
            track: any,
          ) =>
            track.is_streamable !==
              false &&
            track.is_available !==
              false,
        )
        .map(map)
    },

    async trending(): Promise<Track[]> {
      const data =
        await get(
          '/tracks/trending?limit=30&time=week',
        )

      return (
        data.data || []
      )
        .filter(
          (
            track: any,
          ) =>
            track.is_streamable !==
              false &&
            track.is_available !==
              false,
        )
        .map(map)
    },

    async stream(
      track: Track,
    ): Promise<string | null> {
      if (
        track.streamUrl
      ) {
        return track.streamUrl
      }

      return `${API}/tracks/${encodeURIComponent(
        track.providerId,
      )}/stream`
    },
  }