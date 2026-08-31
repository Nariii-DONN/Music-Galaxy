import type { Track } from './types'

const DB_NAME = 'music-galaxy-library'
const DB_VERSION = 2

const TRACKS_STORE = 'tracks'
const AUDIO_STORE = 'audio'
const META_STORE = 'meta'
const PLAYLISTS_STORE = 'playlists'

const FAVORITES_KEY = 'favorites'
const RECENT_KEY = 'recent'

export type Playlist = {
  id: string
  name: string
  description: string
  trackIds: string[]
  createdAt: number
  updatedAt: number
}

export type LibrarySnapshot = {
  tracks: Track[]
  favoriteIds: string[]
  recentIds: string[]
  playlists: Playlist[]
}

type StoredTrack = {
  id: string
  track: Track
}

type StoredAudio = {
  id: string
  blob: Blob
}

type MetaRecord<T> = {
  key: string
  value: T
}

let dbPromise: Promise<IDBDatabase> | null = null

const objectUrls = new Map<string, string>()

function openDb(): Promise<IDBDatabase> {
  if (
    typeof window === 'undefined' ||
    !('indexedDB' in window)
  ) {
    return Promise.reject(
      new Error('IndexedDB is unavailable.'),
    )
  }

  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(
      DB_NAME,
      DB_VERSION,
    )

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        db.createObjectStore(TRACKS_STORE, {
          keyPath: 'id',
        })
      }

      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, {
          keyPath: 'id',
        })
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, {
          keyPath: 'key',
        })
      }

      if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
        db.createObjectStore(PLAYLISTS_STORE, {
          keyPath: 'id',
        })
      }
    }

    request.onsuccess = () => {
      const db = request.result

      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }

      resolve(db)
    }

    request.onerror = () => {
      reject(
        request.error ??
          new Error(
            'Unable to open MusicGalaxy library.',
          ),
      )
    }
  })

  return dbPromise
}

function requestToPromise<T>(
  request: IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(
        request.error ??
          new Error(
            'IndexedDB request failed.',
          ),
      )
    }
  })
}

function transactionComplete(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()

    transaction.onerror = () => {
      reject(
        transaction.error ??
          new Error(
            'IndexedDB transaction failed.',
          ),
      )
    }

    transaction.onabort = () => {
      reject(
        transaction.error ??
          new Error(
            'IndexedDB transaction aborted.',
          ),
      )
    }
  })
}

async function readMeta<T>(
  key: string,
  fallback: T,
): Promise<T> {
  try {
    const db = await openDb()

    const transaction = db.transaction(
      META_STORE,
      'readonly',
    )

    const result = await requestToPromise(
      transaction
        .objectStore(META_STORE)
        .get(key),
    )

    const record =
      result as MetaRecord<T> | undefined

    return record?.value ?? fallback
  } catch {
    return fallback
  }
}

async function writeMeta<T>(
  key: string,
  value: T,
): Promise<void> {
  const db = await openDb()

  const transaction = db.transaction(
    META_STORE,
    'readwrite',
  )

  transaction
    .objectStore(META_STORE)
    .put({
      key,
      value,
    })

  await transactionComplete(transaction)
}

export async function loadLibrary(): Promise<LibrarySnapshot> {
  try {
    const db = await openDb()

    const transaction = db.transaction(
      [
        TRACKS_STORE,
        PLAYLISTS_STORE,
      ],
      'readonly',
    )

    const storedTracks =
      (await requestToPromise(
        transaction
          .objectStore(TRACKS_STORE)
          .getAll(),
      )) as StoredTrack[]

    const storedPlaylists =
      (await requestToPromise(
        transaction
          .objectStore(PLAYLISTS_STORE)
          .getAll(),
      )) as Playlist[]

    const [
      favoriteIds,
      recentIds,
    ] = await Promise.all([
      readMeta<string[]>(
        FAVORITES_KEY,
        [],
      ),
      readMeta<string[]>(
        RECENT_KEY,
        [],
      ),
    ])

    return {
      tracks: storedTracks
        .map((item) => item.track)
        .filter(Boolean),

      favoriteIds,

      recentIds,

      playlists: storedPlaylists
        .map((playlist) => ({
          ...playlist,
          trackIds:
            Array.isArray(
              playlist.trackIds,
            )
              ? playlist.trackIds
              : [],
        }))
        .sort(
          (a, b) =>
            b.updatedAt -
            a.updatedAt,
        ),
    }
  } catch (error) {
    console.warn(
      'Unable to load local library:',
      error,
    )

    return {
      tracks: [],
      favoriteIds: [],
      recentIds: [],
      playlists: [],
    }
  }
}

export async function saveLocalTracks(
  tracks: Track[],
  files: File[],
): Promise<Track[]> {
  if (
    !tracks.length ||
    !files.length
  ) {
    return []
  }

  try {
    const db = await openDb()

    const transaction = db.transaction(
      [
        TRACKS_STORE,
        AUDIO_STORE,
      ],
      'readwrite',
    )

    const trackStore =
      transaction.objectStore(
        TRACKS_STORE,
      )

    const audioStore =
      transaction.objectStore(
        AUDIO_STORE,
      )

    const count = Math.min(
      tracks.length,
      files.length,
    )

    const saved: Track[] = []

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      const track = tracks[index]
      const file = files[index]

      if (!track || !file) {
        continue
      }

      trackStore.put({
        id: track.id,
        track,
      } satisfies StoredTrack)

      audioStore.put({
        id: track.id,
        blob: file,
      } satisfies StoredAudio)

      saved.push(track)
    }

    await transactionComplete(
      transaction,
    )

    return saved
  } catch (error) {
    console.error(
      'Unable to persist local tracks:',
      error,
    )

    return []
  }
}

export async function getLocalAudioUrl(
  track: Track,
): Promise<string | null> {
  if (track.provider !== 'local') {
    return null
  }

  const cached = objectUrls.get(
    track.id,
  )

  if (cached) {
    return cached
  }

  try {
    const db = await openDb()

    const transaction = db.transaction(
      AUDIO_STORE,
      'readonly',
    )

    const result =
      await requestToPromise(
        transaction
          .objectStore(AUDIO_STORE)
          .get(track.id),
      )

    const record =
      result as StoredAudio | undefined

    if (!record?.blob) {
      return null
    }

    const url =
      URL.createObjectURL(
        record.blob,
      )

    objectUrls.set(
      track.id,
      url,
    )

    return url
  } catch (error) {
    console.error(
      'Unable to restore local audio:',
      error,
    )

    return null
  }
}

export async function removeLocalTrack(
  id: string,
): Promise<void> {
  try {
    const db = await openDb()

    const transaction = db.transaction(
      [
        TRACKS_STORE,
        AUDIO_STORE,
      ],
      'readwrite',
    )

    transaction
      .objectStore(TRACKS_STORE)
      .delete(id)

    transaction
      .objectStore(AUDIO_STORE)
      .delete(id)

    await transactionComplete(
      transaction,
    )

    const url =
      objectUrls.get(id)

    if (url) {
      URL.revokeObjectURL(url)
      objectUrls.delete(id)
    }

    const [
      favoriteIds,
      recentIds,
    ] = await Promise.all([
      readMeta<string[]>(
        FAVORITES_KEY,
        [],
      ),
      readMeta<string[]>(
        RECENT_KEY,
        [],
      ),
    ])

    await writeMeta(
      FAVORITES_KEY,
      favoriteIds.filter(
        (value) => value !== id,
      ),
    )

    await writeMeta(
      RECENT_KEY,
      recentIds.filter(
        (value) => value !== id,
      ),
    )

    const playlists =
      await getPlaylists()

    for (const playlist of playlists) {
      if (
        playlist.trackIds.includes(id)
      ) {
        await updatePlaylist(
          playlist.id,
          {
            trackIds:
              playlist.trackIds.filter(
                (trackId) =>
                  trackId !== id,
              ),
          },
        )
      }
    }
  } catch (error) {
    console.error(
      'Unable to remove local track:',
      error,
    )
  }
}

export async function setFavorite(
  id: string,
  liked: boolean,
): Promise<string[]> {
  const current =
    await readMeta<string[]>(
      FAVORITES_KEY,
      [],
    )

  const next = liked
    ? Array.from(
        new Set([
          ...current,
          id,
        ]),
      )
    : current.filter(
        (value) => value !== id,
      )

  await writeMeta(
    FAVORITES_KEY,
    next,
  )

  return next
}

export async function addRecent(
  id: string,
): Promise<string[]> {
  const current =
    await readMeta<string[]>(
      RECENT_KEY,
      [],
    )

  const next = [
    id,
    ...current.filter(
      (value) => value !== id,
    ),
  ].slice(0, 50)

  await writeMeta(
    RECENT_KEY,
    next,
  )

  return next
}

export async function getPlaylists(): Promise<Playlist[]> {
  try {
    const db = await openDb()

    const transaction = db.transaction(
      PLAYLISTS_STORE,
      'readonly',
    )

    const result =
      await requestToPromise(
        transaction
          .objectStore(
            PLAYLISTS_STORE,
          )
          .getAll(),
      )

    return (
      result as Playlist[]
    ).sort(
      (a, b) =>
        b.updatedAt -
        a.updatedAt,
    )
  } catch (error) {
    console.error(
      'Unable to load playlists:',
      error,
    )

    return []
  }
}

export async function createPlaylist(
  name: string,
  description = '',
): Promise<Playlist> {
  const now = Date.now()

  const playlist: Playlist = {
    id: `playlist:${crypto.randomUUID()}`,
    name:
      name.trim() ||
      'Untitled playlist',
    description:
      description.trim(),
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  }

  const db = await openDb()

  const transaction = db.transaction(
    PLAYLISTS_STORE,
    'readwrite',
  )

  transaction
    .objectStore(PLAYLISTS_STORE)
    .put(playlist)

  await transactionComplete(
    transaction,
  )

  return playlist
}

export async function updatePlaylist(
  id: string,
  changes: Partial<
    Pick<
      Playlist,
      | 'name'
      | 'description'
      | 'trackIds'
    >
  >,
): Promise<Playlist | null> {
  const playlists =
    await getPlaylists()

  const existing =
    playlists.find(
      (playlist) =>
        playlist.id === id,
    )

  if (!existing) {
    return null
  }

  const updated: Playlist = {
    ...existing,
    ...changes,
    name:
      changes.name !== undefined
        ? changes.name.trim() ||
          'Untitled playlist'
        : existing.name,
    description:
      changes.description !==
      undefined
        ? changes.description.trim()
        : existing.description,
    trackIds:
      changes.trackIds !==
      undefined
        ? Array.from(
            new Set(
              changes.trackIds,
            ),
          )
        : existing.trackIds,
    updatedAt: Date.now(),
  }

  const db = await openDb()

  const transaction = db.transaction(
    PLAYLISTS_STORE,
    'readwrite',
  )

  transaction
    .objectStore(PLAYLISTS_STORE)
    .put(updated)

  await transactionComplete(
    transaction,
  )

  return updated
}

export async function deletePlaylist(
  id: string,
): Promise<void> {
  const db = await openDb()

  const transaction = db.transaction(
    PLAYLISTS_STORE,
    'readwrite',
  )

  transaction
    .objectStore(PLAYLISTS_STORE)
    .delete(id)

  await transactionComplete(
    transaction,
  )
}

export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
): Promise<Playlist | null> {
  const playlists =
    await getPlaylists()

  const playlist =
    playlists.find(
      (item) =>
        item.id === playlistId,
    )

  if (!playlist) {
    return null
  }

  if (
    playlist.trackIds.includes(
      trackId,
    )
  ) {
    return playlist
  }

  return updatePlaylist(
    playlistId,
    {
      trackIds: [
        ...playlist.trackIds,
        trackId,
      ],
    },
  )
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<Playlist | null> {
  const playlists =
    await getPlaylists()

  const playlist =
    playlists.find(
      (item) =>
        item.id === playlistId,
    )

  if (!playlist) {
    return null
  }

  return updatePlaylist(
    playlistId,
    {
      trackIds:
        playlist.trackIds.filter(
          (id) => id !== trackId,
        ),
    },
  )
}

export async function clearLibrary(): Promise<void> {
  try {
    const db = await openDb()

    const transaction = db.transaction(
      [
        TRACKS_STORE,
        AUDIO_STORE,
        META_STORE,
        PLAYLISTS_STORE,
      ],
      'readwrite',
    )

    transaction
      .objectStore(TRACKS_STORE)
      .clear()

    transaction
      .objectStore(AUDIO_STORE)
      .clear()

    transaction
      .objectStore(PLAYLISTS_STORE)
      .clear()

    transaction
      .objectStore(META_STORE)
      .put({
        key: FAVORITES_KEY,
        value: [],
      })

    transaction
      .objectStore(META_STORE)
      .put({
        key: RECENT_KEY,
        value: [],
      })

    await transactionComplete(
      transaction,
    )

    objectUrls.forEach(
      (url) => {
        URL.revokeObjectURL(url)
      },
    )

    objectUrls.clear()
  } catch (error) {
    console.error(
      'Unable to clear library:',
      error,
    )
  }
}