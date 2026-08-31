import './App.css'

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  motion,
  AnimatePresence,
} from 'framer-motion'

import {
  Activity,
  Compass,
  Disc3,
  Heart,
  Home,
  Library,
  ListMusic,
  Menu,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Settings,
  Share2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles as SparkleIcon,
  Volume2,
  VolumeX,
  X,
  Upload,
  Globe2,
  UserRound,
  ChevronDown,
  Maximize2,
  Shuffle,
  Repeat2,
  MoreHorizontal,
  Trash2,
  Pencil,
  Check,
} from 'lucide-react'

import type { Track } from './lib/types'

import {
  searchAll,
  trendingAll,
} from './lib/music'

import {
  audioEngine,
} from './lib/audioEngine'

import {
  addRecent,
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  loadLibrary,
  removeTrackFromPlaylist,
  saveLocalTracks,
  setFavorite,
  updatePlaylist,
  type Playlist,
} from './lib/libraryStore'

import {
  importLocalAudio,
} from './providers/local'


const GalaxyScene =
  lazy(
    () =>
      import(
        './components/GalaxyScene'
      ),
  )


const demoTrack: Track = {
  id: 'demo',
  provider: 'demo',
  providerId: 'demo',
  title: 'MusicGalaxy',
  artist: 'Your Universe',
  album: 'Explore',
  genre: 'Galaxy',
  mood: 'Dream',
  color: '#7c3aed',
  duration: 0,
  durationLabel: '0:00',
}


const nav = [
  ['Galaxy', Home],
  ['Explore', Compass],
  ['Library', Library],
  ['Playlists', ListMusic],
] as const


/*
 * --------------------------------------------------------------------------
 * REAL-TIME VISUALIZER
 * --------------------------------------------------------------------------
 */

function Visualizer({
  playing,
  color,
}: {
  playing: boolean
  color: string
}) {
  const [
    frame,
    setFrame,
  ] = useState(0)

  useEffect(() => {
    let animationFrame = 0

    const update =
      () => {
        if (playing) {
          setFrame(
            (value) =>
              value + 1,
          )
        }

        animationFrame =
          requestAnimationFrame(
            update,
          )
      }

    animationFrame =
      requestAnimationFrame(
        update,
      )

    return () => {
      cancelAnimationFrame(
        animationFrame,
      )
    }
  }, [playing])

  const data =
    useMemo(
      () =>
        audioEngine.getFrequencyData(),
      [frame],
    )

  const bars =
    Array.from({
      length: 42,
    })

  return (
    <div
      className={
        playing
          ? 'visualizer is-playing'
          : 'visualizer'
      }
      aria-hidden
    >
      {bars.map(
        (_, index) => {
          let height = 5

          if (
            playing &&
            data.length
          ) {
            const position =
              Math.floor(
                (
                  index /
                  bars.length
                ) *
                data.length,
              )

            const value =
              data[
                Math.min(
                  position,
                  data.length -
                    1,
                )
              ] / 255

            height =
              5 +
              value *
                20
          }

          return (
            <span
              key={index}
              style={
                {
                  height: `${height}px`,
                  '--i':
                    index,
                  '--c':
                    color,
                } as React.CSSProperties
              }
            />
          )
        },
      )}
    </div>
  )
}


/*
 * --------------------------------------------------------------------------
 * MAIN APP
 * --------------------------------------------------------------------------
 */

export default function App() {
  const [
    tracks,
    setTracks,
  ] = useState<Track[]>([])

  const [
    active,
    setActive,
  ] = useState<Track>(
    demoTrack,
  )

  const [
    tab,
    setTab,
  ] = useState('Galaxy')

  const [
    query,
    setQuery,
  ] = useState('')

  const [
    liked,
    setLiked,
  ] = useState(false)

  const [
    menu,
    setMenu,
  ] = useState(false)

  const [
    showPlayer,
    setShowPlayer,
  ] = useState(false)

  const [
    pulse,
    setPulse,
  ] = useState(0)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    libraryTracks,
    setLibraryTracks,
  ] = useState<Track[]>([])

  const [
    playlists,
    setPlaylists,
  ] = useState<Playlist[]>([])

  const [
    selectedPlaylistId,
    setSelectedPlaylistId,
  ] = useState<string | null>(
    null,
  )

  const [
    playlistName,
    setPlaylistName,
  ] = useState('')

  const [
    playlistDialog,
    setPlaylistDialog,
  ] = useState(false)

  const [
    addMenuTrack,
    setAddMenuTrack,
  ] = useState<Track | null>(
    null,
  )

  const [
    editingPlaylistId,
    setEditingPlaylistId,
  ] = useState<string | null>(
    null,
  )

  const [
    editingPlaylistName,
    setEditingPlaylistName,
  ] = useState('')

  /*
   * Audio state remains owned by AudioEngine.
   */

  const [
    audioState,
    setAudioState,
  ] = useState(
    () =>
      audioEngine.getState(),
  )

  useEffect(() => {
    const unsubscribe =
      audioEngine.subscribe(
        (state) => {
          setAudioState(
            state,
          )

          if (
            state.track &&
            state.track.id !==
              active.id
          ) {
            setActive(
              state.track,
            )
          }
        },
      )

    return () => {
      unsubscribe()
    }
  }, [active.id])

  const playing =
    audioState.playing

  const currentTime =
    audioState.currentTime

  const duration =
    audioState.duration

  const volume =
    Math.round(
      audioState.volume *
        100,
    )

  const muted =
    audioState.muted

  const shuffle =
    audioState.shuffle

  const repeat =
    audioState.repeat

  const audioLoading =
    audioState.loading

  const audioError =
    audioState.error


  /*
   * Restore persistent library.
   */

  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        const snapshot =
          await loadLibrary()

        if (cancelled) {
          return
        }

        setLibraryTracks(
          snapshot.tracks,
        )

        setPlaylists(
          snapshot.playlists,
        )

        if (
          snapshot.tracks.length
        ) {
          setTracks(
            (previous) => {
              const localIds =
                new Set(
                  snapshot.tracks.map(
                    (
                      track,
                    ) =>
                      track.id,
                  ),
                )

              return [
                ...snapshot.tracks,
                ...previous.filter(
                  (track) =>
                    !localIds.has(
                      track.id,
                    ),
                ),
              ]
            },
          )
        }
      } catch (error) {
        console.error(
          'Library restore failed:',
          error,
        )
      }
    }

    void restore()

    return () => {
      cancelled = true
    }
  }, [])


  /*
   * Keep playback queue synchronized.
   */

  useEffect(() => {
    audioEngine.setQueue(
      tracks,
    )
  }, [tracks])


  /*
   * Load trending music.
   */

  useEffect(() => {
    let cancelled = false

    async function loadTrending() {
      setLoading(true)

      try {
        const results =
          await trendingAll()

        if (cancelled) {
          return
        }

        setTracks(
          (previous) => {
            const map =
              new Map<
                string,
                Track
              >()

            previous.forEach(
              (track) =>
                map.set(
                  track.id,
                  track,
                ),
            )

            results.forEach(
              (track) =>
                map.set(
                  track.id,
                  track,
                ),
            )

            return Array.from(
              map.values(),
            )
          },
        )

        const current =
          audioEngine.getState()
            .track

        if (
          !current &&
          results.length
        ) {
          setActive(
            results[0],
          )
        }
      } catch (error) {
        console.error(
          'Failed to load music:',
          error,
        )

        if (!cancelled) {
          setMessage(
            'Music providers are temporarily unavailable.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTrending()

    return () => {
      cancelled = true
    }
  }, [])


  /*
   * Search.
   */

  useEffect(() => {
    const search =
      query.trim()

    if (!search) {
      return
    }

    let cancelled = false

    const timer =
      window.setTimeout(
        async () => {
          setLoading(true)
          setMessage('')

          try {
            const results =
              await searchAll(
                search,
              )

            if (cancelled) {
              return
            }

            if (
              results.length
            ) {
              setTracks(
                results,
              )

              setActive(
                results[0],
              )
            } else {
              setMessage(
                `No music found for "${search}".`,
              )
            }
          } catch (error) {
            console.error(
              'Search failed:',
              error,
            )

            if (!cancelled) {
              setMessage(
                'Music providers are temporarily unavailable.',
              )
            }
          } finally {
            if (!cancelled) {
              setLoading(
                false,
              )
            }
          }
        },
        450,
      )

    return () => {
      cancelled = true
      clearTimeout(
        timer,
      )
    }
  }, [query])


  /*
   * Galaxy pulse is now derived from
   * the real analyser.
   */

  useEffect(() => {
    let animationFrame =
      0

    const animate =
      () => {
        const snapshot =
          audioEngine.getVisualizerSnapshot()

        const energy =
          snapshot.bass *
            0.55 +
          snapshot.mid *
            0.3 +
          snapshot.treble *
            0.15

        setPulse(
          playing
            ? 0.05 +
                energy *
                  0.95
            : 0.02,
        )

        animationFrame =
          requestAnimationFrame(
            animate,
          )
      }

    animationFrame =
      requestAnimationFrame(
        animate,
      )

    return () => {
      cancelAnimationFrame(
        animationFrame,
      )
    }
  }, [playing])


  /*
   * Show analyser errors.
   */

  useEffect(() => {
    if (audioError) {
      setMessage(
        audioError,
      )
    }
  }, [audioError])


  /*
   * Play track.
   */

  const choose = async (
    track: Track,
  ) => {
    setLiked(false)
    setMessage('')

    setActive(track)

    const success =
      await audioEngine.play(
        track,
      )

    if (!success) {
      setMessage(
        audioEngine.getState()
          .error ||
          'Unable to play this track.',
      )

      return
    }

    void addRecent(
      track.id,
    )
  }


  /*
   * Play / pause.
   */

  const togglePlayback =
    async () => {
      const current =
        audioEngine.getState()
          .track

      if (
        !current &&
        tracks.length
      ) {
        await choose(
          tracks[0],
        )

        return
      }

      await audioEngine.toggle(
        active,
      )
    }


  /*
   * Next.
   */

  const next =
    async () => {
      const success =
        await audioEngine.next()

      if (!success) {
        return
      }

      const track =
        audioEngine.getState()
          .track

      if (track) {
        setActive(track)
        void addRecent(
          track.id,
        )
      }
    }


  /*
   * Previous.
   */

  const previous =
    async () => {
      const success =
        await audioEngine.previous()

      if (!success) {
        return
      }

      const track =
        audioEngine.getState()
          .track

      if (track) {
        setActive(track)
        void addRecent(
          track.id,
        )
      }
    }


  /*
   * Seek.
   */

  const handleSeek = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    audioEngine.seek(
      Number(
        event.target.value,
      ),
    )
  }


  /*
   * Volume.
   */

  const handleVolume = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    audioEngine.setVolume(
      Number(
        event.target.value,
      ) / 100,
    )
  }


  /*
   * Mute.
   */

  const toggleMute = () => {
    audioEngine.toggleMute()
  }


  /*
   * Shuffle.
   */

  const toggleShuffle =
    () => {
      audioEngine.toggleShuffle()
    }


  /*
   * Repeat.
   */

  const cycleRepeat =
    () => {
      audioEngine.cycleRepeat()
    }


  /*
   * Favorite.
   */

  const toggleFavorite =
    async () => {
      const nextLiked =
        !liked

      setLiked(
        nextLiked,
      )

      await setFavorite(
        active.id,
        nextLiked,
      )
    }


  /*
   * Local import.
   */

  const handleLocalImport =
    async (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const files =
        Array.from(
          event.target.files ||
            [],
        )

      if (!files.length) {
        return
      }

      const audioFiles =
        files.filter(
          (file) =>
            file.type.startsWith(
              'audio/',
            ),
        )

      const localTracks =
        importLocalAudio(
          audioFiles,
        )

      if (
        !localTracks.length
      ) {
        setMessage(
          'No supported audio files were selected.',
        )

        event.target.value =
          ''

        return
      }

      const saved =
        await saveLocalTracks(
          localTracks,
          audioFiles,
        )

      if (
        !saved.length
      ) {
        setMessage(
          'Unable to save the imported tracks.',
        )

        event.target.value =
          ''

        return
      }

      setLibraryTracks(
        (previous) => {
          const map =
            new Map<
              string,
              Track
            >()

          previous.forEach(
            (track) =>
              map.set(
                track.id,
                track,
              ),
          )

          saved.forEach(
            (track) =>
              map.set(
                track.id,
                track,
              ),
          )

          return Array.from(
            map.values(),
          )
        },
      )

      setTracks(
        (previous) => {
          const ids =
            new Set(
              saved.map(
                (track) =>
                  track.id,
              ),
            )

          return [
            ...saved,
            ...previous.filter(
              (track) =>
                !ids.has(
                  track.id,
                ),
            ),
          ]
        },
      )

      setActive(
        saved[0],
      )

      setMessage(
        `${saved.length} local track${
          saved.length === 1
            ? ''
            : 's'
        } imported into your library.`,
      )

      event.target.value =
        ''
    }


  /*
   * Create playlist.
   */

  const openCreatePlaylist =
    () => {
      setPlaylistName('')
      setPlaylistDialog(
        true,
      )
    }

  const handleCreatePlaylist =
    async () => {
      const name =
        playlistName.trim()

      if (!name) {
        return
      }

      try {
        const playlist =
          await createPlaylist(
            name,
          )

        setPlaylists(
          (previous) => [
            playlist,
            ...previous,
          ],
        )

        setSelectedPlaylistId(
          playlist.id,
        )

        setPlaylistDialog(
          false,
        )

        setTab(
          'Playlists',
        )
      } catch (error) {
        console.error(
          'Create playlist failed:',
          error,
        )

        setMessage(
          'Unable to create playlist.',
        )
      }
    }


  /*
   * Delete playlist.
   */

  const handleDeletePlaylist =
    async (
      playlistId: string,
    ) => {
      const playlist =
        playlists.find(
          (item) =>
            item.id ===
            playlistId,
        )

      if (!playlist) {
        return
      }

      if (
        !window.confirm(
          `Delete "${playlist.name}"?`,
        )
      ) {
        return
      }

      try {
        await deletePlaylist(
          playlistId,
        )

        setPlaylists(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !==
                playlistId,
            ),
        )

        if (
          selectedPlaylistId ===
          playlistId
        ) {
          setSelectedPlaylistId(
            null,
          )
        }
      } catch (error) {
        console.error(
          'Delete playlist failed:',
          error,
        )
      }
    }


  /*
   * Rename playlist.
   */

  const startRename =
    (
      playlist: Playlist,
    ) => {
      setEditingPlaylistId(
        playlist.id,
      )

      setEditingPlaylistName(
        playlist.name,
      )
    }

  const saveRename =
    async () => {
      if (
        !editingPlaylistId
      ) {
        return
      }

      const name =
        editingPlaylistName.trim()

      if (!name) {
        return
      }

      const current =
        playlists.find(
          (item) =>
            item.id ===
            editingPlaylistId,
        )

      if (!current) {
        return
      }

      try {
        const updated =
          await updatePlaylist(
            current.id,
            {
              name,
            },
          )

        if (!updated) {
          return
        }

        setPlaylists(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                updated.id
                  ? updated
                  : item,
            ),
        )

        setEditingPlaylistId(
          null,
        )

        setEditingPlaylistName(
          '',
        )
      } catch (error) {
        console.error(
          'Rename playlist failed:',
          error,
        )
      }
    }


  /*
   * Add track.
   */

  const addToPlaylist =
    async (
      playlistId: string,
      track: Track,
    ) => {
      const updated =
        await addTrackToPlaylist(
          playlistId,
          track.id,
        )

      if (!updated) {
        return
      }

      setPlaylists(
        (previous) =>
          previous.map(
            (item) =>
              item.id ===
              updated.id
                ? updated
                : item,
          ),
      )

      setAddMenuTrack(
        null,
      )

      setMessage(
        `"${track.title}" added to "${updated.name}".`,
      )
    }


  /*
   * Remove track.
   */

  const removeFromPlaylist =
    async (
      playlistId: string,
      trackId: string,
    ) => {
      const updated =
        await removeTrackFromPlaylist(
          playlistId,
          trackId,
        )

      if (!updated) {
        return
      }

      setPlaylists(
        (previous) =>
          previous.map(
            (item) =>
              item.id ===
              updated.id
                ? updated
                : item,
          ),
      )
    }


  /*
   * Play playlist.
   */

  const playPlaylist =
    async (
      playlist: Playlist,
    ) => {
      const playlistTracks =
        playlist.trackIds
          .map(
            (id) =>
              tracks.find(
                (track) =>
                  track.id ===
                  id,
              ) ||
              libraryTracks.find(
                (track) =>
                  track.id ===
                  id,
              ),
          )
          .filter(
            (
              track,
            ): track is Track =>
              Boolean(track),
          )

      if (
        !playlistTracks.length
      ) {
        setMessage(
          'This playlist has no available tracks.',
        )

        return
      }

      audioEngine.setQueue(
        playlistTracks,
      )

      setActive(
        playlistTracks[0],
      )

      await audioEngine.play(
        playlistTracks[0],
      )
    }


  /*
   * Format time.
   */

  const formatTime = (
    seconds: number,
  ) => {
    if (
      !Number.isFinite(
        seconds,
      ) ||
      seconds < 0
    ) {
      return '0:00'
    }

    const minutes =
      Math.floor(
        seconds / 60,
      )

    const secs =
      Math.floor(
        seconds % 60,
      )

    return `${minutes}:${String(
      secs,
    ).padStart(
      2,
      '0',
    )}`
  }


  const filtered =
    tab === 'Library'
      ? libraryTracks
      : tracks

  const selectedPlaylist =
    playlists.find(
      (playlist) =>
        playlist.id ===
        selectedPlaylistId,
    )


  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside
        className={
          menu
            ? 'sidebar open'
            : 'sidebar'
        }
      >

        <div className="brand">

          <div className="brand-orb">
            <SparkleIcon
              size={18}
            />
          </div>

          <span>
            Music
            <span>
              Galaxy
            </span>
          </span>

        </div>


        <div className="profile-mini">

          <div className="avatar">
            N
          </div>

          <div>

            <b>
              Nariii
            </b>

            <small>
              Explorer
            </small>

          </div>

          <ChevronDown
            size={14}
          />

        </div>


        <nav>

          {nav.map(
            ([name, Icon]) => (

              <button
                key={name}
                className={
                  tab ===
                  name
                    ? 'nav-item active'
                    : 'nav-item'
                }
                onClick={() => {
                  setTab(
                    name,
                  )

                  setMenu(
                    false,
                  )
                }}
              >

                <Icon
                  size={18}
                />

                <span>
                  {name}
                </span>

              </button>

            ),
          )}

        </nav>


        <div className="side-title">
          DISCOVER
        </div>


        {[
          'Trending',
          'Night Drive',
          'Focus',
          'New Releases',
        ].map(
          (item) => (

            <button
              className="nav-item subtle"
              key={item}
              onClick={() => {

                setQuery(
                  item ===
                    'Trending'
                    ? ''
                    : item,
                )

                setTab(
                  'Explore',
                )

                setMenu(
                  false,
                )

              }}
            >

              <Radio
                size={16}
              />

              <span>
                {item}
              </span>

            </button>

          ),
        )}


        <div className="side-bottom">

          <button className="nav-item subtle">

            <Settings
              size={17}
            />

            <span>
              Settings
            </span>

          </button>


          <button className="nav-item subtle">

            <UserRound
              size={17}
            />

            <span>
              Profile
            </span>

          </button>

        </div>

      </aside>


      <main className="main">

        {/* TOP BAR */}

        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() =>
              setMenu(
                !menu,
              )
            }
          >
            <Menu />
          </button>


          <div className="search">

            <Search
              size={17}
            />

            <input
              value={query}
              onChange={(
                event,
              ) =>
                setQuery(
                  event.target
                    .value,
                )
              }
              placeholder="Search songs, artists, albums..."
            />

            {query && (

              <button
                onClick={() => {
                  setQuery('')
                  setMessage('')
                }}
              >
                <X
                  size={15}
                />
              </button>

            )}

          </div>


          <div className="top-actions">

            <button className="icon-btn">
              <Globe2
                size={18}
              />
            </button>


            <label className="publish">

              <Upload
                size={17}
              />

              Import

              <input
                type="file"
                accept="audio/*"
                multiple
                hidden
                onChange={
                  handleLocalImport
                }
              />

            </label>


            <button
              className="publish"
              onClick={
                openCreatePlaylist
              }
            >

              <Plus
                size={17}
              />

              Playlist

            </button>


            <div className="avatar">
              N
            </div>

          </div>

        </header>


        {/* HERO */}

        <section className="hero">

          <div className="hero-copy">

            <div className="eyebrow">

              <span className="live-dot" />

              YOUR PERSONAL
              UNIVERSE

            </div>


            <h1>

              Music should be

              <br />

              <em>
                experienced.
              </em>

            </h1>


            <p>

              Explore your music as a
              living galaxy. Fly between
              artists, albums and songs —
              every world moves with the
              sound.

            </p>


            <div className="hero-actions">

              <button
                className="primary"
                onClick={
                  togglePlayback
                }
              >

                {playing ? (
                  <Pause
                    size={17}
                  />
                ) : (
                  <Play
                    size={17}
                  />
                )}

                {playing
                  ? 'Pause journey'
                  : 'Enter your galaxy'}

              </button>


              <button className="ghost">

                <Share2
                  size={16}
                />

                Share galaxy

              </button>

            </div>

          </div>


          <div className="stats">

            <div>

              <b>
                {
                  tracks.length
                }
              </b>

              <span>
                SONGS
              </span>

            </div>


            <div>

              <b>
                {
                  new Set(
                    tracks.map(
                      (
                        track,
                      ) =>
                        track.artist,
                    ),
                  ).size
                }
              </b>

              <span>
                ARTISTS
              </span>

            </div>


            <div>

              <b>
                {
                  new Set(
                    tracks.map(
                      (
                        track,
                      ) =>
                        track.genre,
                    ),
                  ).size
                }
              </b>

              <span>
                GENRES
              </span>

            </div>

          </div>

        </section>


        {(message ||
          audioLoading) && (

          <motion.div
            className="provider-message"
            initial={{
              opacity: 0,
              y: -8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >

            {audioLoading
              ? 'Loading audio...'
              : message}

          </motion.div>

        )}


        {/* GALAXY */}

        <section className="galaxy-card">

          <div className="galaxy-toolbar">

            <div>

              <b>
                YOUR GALAXY
              </b>

              <span>
                Drag to explore ·
                click a planet to play
              </span>

            </div>


            <div className="toolbar-actions">

              <button>

                <SlidersHorizontal
                  size={16}
                />

                Visuals

              </button>


              <button>

                <Maximize2
                  size={16}
                />

              </button>

            </div>

          </div>


          <div className="canvas-wrap">

            {loading ? (

              <div className="galaxy-loading">

                <Activity
                  size={24}
                />

                <span>
                  Discovering your
                  universe...
                </span>

              </div>

            ) : tracks.length >
              0 ? (

              <Suspense
                fallback={
                  <div className="galaxy-loading">
                    <Activity
                      size={24}
                    />

                    <span>
                      Initializing your
                      universe...
                    </span>
                  </div>
                }
              >

                <GalaxyScene
                  tracks={
                    tracks
                  }
                  active={
                    active
                  }
                  pulse={
                    pulse
                  }
                  onSelect={
                    choose
                  }
                />

              </Suspense>

            ) : (

              <div className="galaxy-loading">

                <Globe2
                  size={28}
                />

                <span>
                  Search for music
                  to create your
                  galaxy.
                </span>

              </div>

            )}


            <div className="galaxy-label center">

              <span className="tiny-star" />

              {
                active.genre.toUpperCase()
              }{' '}

              SECTOR

            </div>


            <div className="planet-tooltip">

              <div
                className="cover"
                style={{
                  background:
                    active.color,
                }}
              >

                <Disc3 />

              </div>


              <div>

                <small>
                  {
                    playing
                      ? 'NOW PLAYING'
                      : 'SELECTED TRACK'
                  }
                </small>

                <b>
                  {
                    active.title
                  }
                </b>

                <span>
                  {
                    active.artist
                  }{' '}
                  ·{' '}
                  {
                    active.album
                  }
                </span>

              </div>


              <button
                onClick={
                  toggleFavorite
                }
                className={
                  liked
                    ? 'liked'
                    : ''
                }
              >

                <Heart
                  size={17}
                  fill={
                    liked
                      ? 'currentColor'
                      : 'none'
                  }
                />

              </button>

            </div>

          </div>

        </section>


        {/* CONTENT */}

        <AnimatePresence mode="wait">

          {tab ===
            'Galaxy' && (

            <motion.section
              key="galaxy"
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -8,
              }}
              className="content-grid"
            >

              <div className="panel">

                <div className="panel-head">

                  <div>

                    <h2>
                      Continue exploring
                    </h2>

                    <p>
                      Music from your
                      universe
                    </p>

                  </div>


                  <button
                    onClick={() =>
                      setTab(
                        'Explore',
                      )
                    }
                  >
                    View all
                  </button>

                </div>


                <div className="track-list">

                  {tracks
                    .slice(
                      0,
                      8,
                    )
                    .map(
                      (
                        track,
                        index,
                      ) => (

                        <div
                          className={
                            track.id ===
                            active.id
                              ? 'track active-track'
                              : 'track'
                          }
                          key={
                            track.id
                          }
                        >

                          <button
                            className="track-main"
                            onClick={() =>
                              choose(
                                track,
                              )
                            }
                          >

                            <span className="num">
                              {
                                index +
                                1
                              }
                            </span>


                            <span
                              className="mini-cover"
                              style={{
                                background:
                                  track.color,
                              }}
                            >
                              <Disc3
                                size={
                                  15
                                }
                              />
                            </span>


                            <span className="track-info">

                              <b>
                                {
                                  track.title
                                }
                              </b>

                              <small>
                                {
                                  track.artist
                                }{' '}
                                ·{' '}
                                {
                                  track.album
                                }
                              </small>

                            </span>


                            <span className="genre">
                              {
                                track.genre
                              }
                            </span>


                            <span className="track-time">
                              {
                                track.durationLabel ||
                                formatTime(
                                  track.duration,
                                )
                              }
                            </span>

                          </button>


                          <button
                            className="track-add"
                            onClick={(
                              event,
                            ) => {

                              event.stopPropagation()

                              setAddMenuTrack(
                                track,
                              )

                            }}
                            title="Add to playlist"
                          >

                            <Plus
                              size={15}
                            />

                          </button>

                        </div>

                      ),
                    )}


                  {!loading &&
                    filtered.length ===
                      0 && (

                    <div className="empty-state">
                      No tracks available.
                    </div>

                  )}

                </div>

              </div>


              <div className="panel recommendation">

                <div className="panel-head">

                  <div>

                    <h2>
                      Made for tonight
                    </h2>

                    <p>
                      AI-ready discovery
                      mix
                    </p>

                  </div>

                  <SparkleIcon
                    size={18}
                  />

                </div>


                <div className="mix-art">

                  <div className="orb one" />

                  <div className="orb two" />

                  <div className="orb three" />

                  <div className="mix-title">

                    NIGHT
                    <br />

                    <span>
                      DRIVE
                    </span>

                  </div>

                </div>


                <button
                  className="wide-primary"
                  onClick={() => {

                    if (
                      tracks[0]
                    ) {
                      void choose(
                        tracks[0],
                      )
                    }

                  }}
                  disabled={
                    !tracks.length
                  }
                >

                  <Play
                    size={16}
                  />

                  Play mix

                </button>

              </div>

            </motion.section>

          )}


          {/* LIBRARY */}

          {tab ===
            'Library' && (

            <motion.section
              key="library"
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="section-view"
            >

              <div className="section-heading">

                <div>

                  <span className="eyebrow">
                    LIBRARY
                  </span>

                  <h2>
                    Your collection
                  </h2>

                </div>


                <label className="ghost">

                  <Upload
                    size={16}
                  />

                  Import music

                  <input
                    type="file"
                    accept="audio/*"
                    multiple
                    hidden
                    onChange={
                      handleLocalImport
                    }
                  />

                </label>

              </div>


              {libraryTracks.length >
              0 ? (

                <div className="cards">

                  {libraryTracks.map(
                    (
                      track,
                    ) => (

                      <motion.button
                        whileHover={{
                          y: -6,
                        }}
                        className="music-card"
                        key={
                          track.id
                        }
                        onClick={() =>
                          choose(
                            track,
                          )
                        }
                      >

                        <div
                          className="card-art"
                          style={{
                            background:
                              `radial-gradient(circle at 30% 30%, ${track.color}, #080811 65%)`,
                          }}
                        >

                          <span>
                            ✦
                          </span>

                          <span className="card-play">

                            <Play
                              size={
                                16
                              }
                            />

                          </span>

                        </div>


                        <b>
                          {
                            track.title
                          }
                        </b>

                        <small>
                          {
                            track.artist
                          }
                        </small>

                        <span>
                          {
                            track.genre
                          }{' '}
                          · Local
                        </span>

                      </motion.button>

                    ),
                  )}

                </div>

              ) : (

                <div className="empty-state">

                  <Upload
                    size={28}
                  />

                  <p>
                    Your local library
                    is empty.
                  </p>


                  <label className="primary">

                    <Upload
                      size={16}
                    />

                    Import music

                    <input
                      type="file"
                      accept="audio/*"
                      multiple
                      hidden
                      onChange={
                        handleLocalImport
                      }
                    />

                  </label>

                </div>

              )}

            </motion.section>

          )}


          {/* PLAYLISTS */}

          {tab ===
            'Playlists' && (

            <motion.section
              key="playlists"
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="section-view"
            >

              <div className="section-heading">

                <div>

                  <span className="eyebrow">
                    PLAYLISTS
                  </span>

                  <h2>
                    Your constellations
                  </h2>

                </div>


                <button
                  className="primary"
                  onClick={
                    openCreatePlaylist
                  }
                >

                  <Plus
                    size={16}
                  />

                  Create playlist

                </button>

              </div>


              {playlists.length ===
              0 ? (

                <div className="empty-state">

                  <ListMusic
                    size={32}
                  />

                  <p>
                    No playlists yet.
                  </p>


                  <button
                    className="primary"
                    onClick={
                      openCreatePlaylist
                    }
                  >

                    <Plus
                      size={16}
                    />

                    Create your first
                    playlist

                  </button>

                </div>

              ) : (

                <div className="playlist-layout">

                  <div className="playlist-sidebar">

                    {playlists.map(
                      (
                        playlist,
                      ) => (

                        <div
                          className={
                            selectedPlaylistId ===
                            playlist.id
                              ? 'playlist-item active'
                              : 'playlist-item'
                          }
                          key={
                            playlist.id
                          }
                        >

                          {editingPlaylistId ===
                          playlist.id ? (

                            <input
                              autoFocus
                              value={
                                editingPlaylistName
                              }
                              onChange={(
                                event,
                              ) =>
                                setEditingPlaylistName(
                                  event
                                    .target
                                    .value,
                                )
                              }
                              onKeyDown={(
                                event,
                              ) => {

                                if (
                                  event.key ===
                                  'Enter'
                                ) {
                                  void saveRename()
                                }

                                if (
                                  event.key ===
                                  'Escape'
                                ) {
                                  setEditingPlaylistId(
                                    null,
                                  )
                                }

                              }}
                            />

                          ) : (

                            <button
                              className="playlist-select"
                              onClick={() =>
                                setSelectedPlaylistId(
                                  playlist.id,
                                )
                              }
                            >

                              <ListMusic
                                size={
                                  18
                                }
                              />

                              <span>

                                <b>
                                  {
                                    playlist.name
                                  }
                                </b>

                                <small>
                                  {
                                    playlist
                                      .trackIds
                                      .length
                                  }{' '}
                                  tracks
                                </small>

                              </span>

                            </button>

                          )}


                          <div className="playlist-actions">

                            {editingPlaylistId ===
                            playlist.id ? (

                              <button
                                onClick={
                                  saveRename
                                }
                                title="Save"
                              >

                                <Check
                                  size={
                                    14
                                  }
                                />

                              </button>

                            ) : (

                              <button
                                onClick={() =>
                                  startRename(
                                    playlist,
                                  )
                                }
                                title="Rename"
                              >

                                <Pencil
                                  size={
                                    14
                                  }
                                />

                              </button>

                            )}


                            <button
                              onClick={() =>
                                void handleDeletePlaylist(
                                  playlist.id,
                                )
                              }
                              title="Delete"
                            >

                              <Trash2
                                size={
                                  14
                                }
                              />

                            </button>

                          </div>

                        </div>

                      ),
                    )}

                  </div>


                  <div className="playlist-detail">

                    {selectedPlaylist ? (

                      <>

                        <div className="panel-head">

                          <div>

                            <span className="eyebrow">
                              PLAYLIST
                            </span>

                            <h2>
                              {
                                selectedPlaylist.name
                              }
                            </h2>

                            <p>
                              {
                                selectedPlaylist
                                  .trackIds
                                  .length
                              }{' '}
                              tracks
                            </p>

                          </div>


                          <button
                            className="primary"
                            onClick={() =>
                              void playPlaylist(
                                selectedPlaylist,
                              )
                            }
                            disabled={
                              !selectedPlaylist
                                .trackIds
                                .length
                            }
                          >

                            <Play
                              size={
                                16
                              }
                            />

                            Play playlist

                          </button>

                        </div>


                        <div className="track-list">

                          {selectedPlaylist.trackIds.map(
                            (
                              trackId,
                              index,
                            ) => {

                              const track =
                                tracks.find(
                                  (
                                    item,
                                  ) =>
                                    item.id ===
                                    trackId,
                                ) ||
                                libraryTracks.find(
                                  (
                                    item,
                                  ) =>
                                    item.id ===
                                    trackId,
                                )

                              if (!track) {
                                return null
                              }

                              return (

                                <div
                                  className="track"
                                  key={
                                    trackId
                                  }
                                >

                                  <span className="num">
                                    {
                                      index +
                                      1
                                    }
                                  </span>


                                  <span
                                    className="mini-cover"
                                    style={{
                                      background:
                                        track.color,
                                    }}
                                  >

                                    <Disc3
                                      size={
                                        15
                                      }
                                    />

                                  </span>


                                  <button
                                    className="track-main"
                                    onClick={() =>
                                      void choose(
                                        track,
                                      )
                                    }
                                  >

                                    <span className="track-info">

                                      <b>
                                        {
                                          track.title
                                        }
                                      </b>

                                      <small>
                                        {
                                          track.artist
                                        }
                                      </small>

                                    </span>

                                  </button>


                                  <span className="track-time">
                                    {
                                      track.durationLabel
                                    }
                                  </span>


                                  <button
                                    onClick={() =>
                                      void removeFromPlaylist(
                                        selectedPlaylist.id,
                                        track.id,
                                      )
                                    }
                                  >

                                    <X
                                      size={
                                        16
                                      }
                                    />

                                  </button>

                                </div>

                              )
                            },
                          )}


                          {!selectedPlaylist
                            .trackIds
                            .length && (

                            <div className="empty-state">
                              This playlist is
                              empty.
                            </div>

                          )}

                        </div>

                      </>

                    ) : (

                      <div className="empty-state">

                        <ListMusic
                          size={30}
                        />

                        <p>
                          Select a playlist
                          to view it.
                        </p>

                      </div>

                    )}

                  </div>

                </div>

              )}

            </motion.section>

          )}


          {/* EXPLORE */}

          {tab ===
            'Explore' && (

            <motion.section
              key="explore"
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="section-view"
            >

              <div className="section-heading">

                <div>

                  <span className="eyebrow">
                    EXPLORE
                  </span>

                  <h2>
                    Discover new worlds
                  </h2>

                </div>

              </div>


              <div className="cards">

                {tracks.map(
                  (
                    track,
                  ) => (

                    <motion.button
                      whileHover={{
                        y: -6,
                      }}
                      className="music-card"
                      key={
                        track.id
                      }
                      onClick={() =>
                        choose(
                          track,
                        )
                      }
                    >

                      <div
                        className="card-art"
                        style={{
                          background:
                            `radial-gradient(circle at 30% 30%, ${track.color}, #080811 65%)`,
                        }}
                      >

                        <span>
                          ✦
                        </span>

                        <span className="card-play">

                          <Play
                            size={
                              16
                            }
                          />

                        </span>

                      </div>


                      <b>
                        {
                          track.title
                        }
                      </b>

                      <small>
                        {
                          track.artist
                        }
                      </small>

                      <span>
                        {
                          track.genre
                        }{' '}
                        ·{' '}
                        {
                          track.mood
                        }
                      </span>

                    </motion.button>

                  ),
                )}

              </div>


              {!loading &&
                !tracks.length && (

                <div className="empty-state">
                  No music found.
                </div>

              )}

            </motion.section>

          )}

        </AnimatePresence>

      </main>


      {/* EXPANDED PLAYER */}

      <AnimatePresence>

        {showPlayer && (

          <motion.div
            className="player-expanded"
            initial={{
              y: '100%',
            }}
            animate={{
              y: 0,
            }}
            exit={{
              y: '100%',
            }}
          >

            <button
              className="close-player"
              onClick={() =>
                setShowPlayer(
                  false,
                )
              }
            >
              <X />
            </button>


            <div
              className="big-art"
              style={{
                background:
                  `radial-gradient(circle at 30% 20%, ${active.color}, #080811 62%)`,
              }}
            >

              <Disc3
                size={90}
              />

            </div>


            <div className="now-title">

              <span>
                {
                  playing
                    ? 'NOW PLAYING'
                    : 'PAUSED'
                }
              </span>

              <h2>
                {
                  active.title
                }
              </h2>

              <p>
                {
                  active.artist
                }{' '}
                ·{' '}
                {
                  active.album
                }
              </p>

            </div>


            <Visualizer
              playing={
                playing
              }
              color={
                active.color
              }
            />


            <div className="progress">

              <span>
                {
                  formatTime(
                    currentTime,
                  )
                }
              </span>


              <input
                type="range"
                min="0"
                max={
                  duration ||
                  active.duration ||
                  1
                }
                value={Math.min(
                  currentTime,
                  duration ||
                    active.duration ||
                    1,
                )}
                onChange={
                  handleSeek
                }
              />


              <span>
                {
                  formatTime(
                    duration ||
                      active.duration ||
                      0,
                  )
                }
              </span>

            </div>


            <div className="big-controls">

              <button
                className={
                  shuffle
                    ? 'control-active'
                    : ''
                }
                onClick={
                  toggleShuffle
                }
              >
                <Shuffle />
              </button>


              <button
                onClick={
                  previous
                }
              >
                <SkipBack />
              </button>


              <button
                className="play-big"
                onClick={
                  togglePlayback
                }
              >
                {playing ? (
                  <Pause />
                ) : (
                  <Play />
                )}
              </button>


              <button
                onClick={
                  next
                }
              >
                <SkipForward />
              </button>


              <button
                className={
                  repeat !==
                  'off'
                    ? 'control-active'
                    : ''
                }
                onClick={
                  cycleRepeat
                }
              >
                <Repeat2 />
              </button>

            </div>

          </motion.div>

        )}

      </AnimatePresence>


      {/* BOTTOM PLAYER */}

      <footer
        className="player"
        onClick={(
          event,
        ) => {

          if (
            (
              event.target as HTMLElement
            ).closest(
              'button,input',
            )
          ) {
            return
          }

          setShowPlayer(
            true,
          )

        }}
      >

        <div className="current">

          <div
            className="mini-cover"
            style={{
              background:
                active.color,
            }}
          >

            <Disc3
              size={15}
            />

          </div>


          <div>

            <b>
              {
                active.title
              }
            </b>

            <small>
              {
                active.artist
              }
            </small>

          </div>

        </div>


        <div className="player-controls">

          <button
            onClick={
              previous
            }
          >
            <SkipBack />
          </button>


          <button
            className="play"
            onClick={
              togglePlayback
            }
          >

            {playing ? (
              <Pause />
            ) : (
              <Play />
            )}

          </button>


          <button
            onClick={
              next
            }
          >
            <SkipForward />
          </button>

        </div>


        <div className="player-right">

          <Visualizer
            playing={
              playing
            }
            color={
              active.color
            }
          />


          <button
            onClick={
              toggleFavorite
            }
            className={
              liked
                ? 'liked'
                : ''
            }
          >

            <Heart
              size={18}
              fill={
                liked
                  ? 'currentColor'
                  : 'none'
              }
            />

          </button>


          <button
            onClick={
              toggleMute
            }
          >

            {muted ||
            volume ===
              0 ? (
              <VolumeX
                size={18}
              />
            ) : (
              <Volume2
                size={18}
              />
            )}

          </button>


          <input
            className="volume"
            type="range"
            min="0"
            max="100"
            value={
              muted
                ? 0
                : volume
            }
            onChange={
              handleVolume
            }
          />

        </div>

      </footer>


      {/* SEARCH */}

      {query && (

        <div className="search-pop">

          <div className="search-pop-head">

            <b>
              Results
            </b>

            <span>
              {loading
                ? 'Searching...'
                : `${filtered.length} found`}
            </span>

          </div>


          {filtered.map(
            (
              track,
            ) => (

              <button
                key={
                  track.id
                }
                onClick={() =>
                  choose(
                    track,
                  )
                }
              >

                <span
                  className="mini-cover"
                  style={{
                    background:
                      track.color,
                  }}
                >

                  <Disc3
                    size={14}
                  />

                </span>


                <span>

                  <b>
                    {
                      track.title
                    }
                  </b>

                  <small>
                    {
                      track.artist
                    }{' '}
                    ·{' '}
                    {
                      track.album
                    }
                  </small>

                </span>


                <Play
                  size={15}
                />

              </button>

            ),
          )}


          {!loading &&
            filtered.length ===
              0 && (

            <p>
              No worlds found.
            </p>

          )}

        </div>

      )}


      {/* CREATE PLAYLIST */}

      <AnimatePresence>

        {playlistDialog && (

          <motion.div
            className="modal-backdrop"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
          >

            <motion.div
              className="modal"
              initial={{
                opacity: 0,
                scale: 0.96,
                y: 12,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: 12,
              }}
            >

              <div className="modal-head">

                <div>

                  <span className="eyebrow">
                    NEW CONSTELLATION
                  </span>

                  <h2>
                    Create playlist
                  </h2>

                </div>


                <button
                  className="icon-btn"
                  onClick={() =>
                    setPlaylistDialog(
                      false,
                    )
                  }
                >
                  <X />
                </button>

              </div>


              <input
                autoFocus
                value={
                  playlistName
                }
                onChange={(
                  event,
                ) =>
                  setPlaylistName(
                    event.target
                      .value,
                  )
                }
                onKeyDown={(
                  event,
                ) => {

                  if (
                    event.key ===
                    'Enter'
                  ) {
                    void handleCreatePlaylist()
                  }

                  if (
                    event.key ===
                    'Escape'
                  ) {
                    setPlaylistDialog(
                      false,
                    )
                  }

                }}
                placeholder="Playlist name"
              />


              <div className="modal-actions">

                <button
                  className="ghost"
                  onClick={() =>
                    setPlaylistDialog(
                      false,
                    )
                  }
                >
                  Cancel
                </button>


                <button
                  className="primary"
                  onClick={
                    handleCreatePlaylist
                  }
                  disabled={
                    !playlistName.trim()
                  }
                >

                  <Plus
                    size={16}
                  />

                  Create

                </button>

              </div>

            </motion.div>

          </motion.div>

        )}

      </AnimatePresence>


      {/* ADD TO PLAYLIST */}

      <AnimatePresence>

        {addMenuTrack && (

          <motion.div
            className="modal-backdrop"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onClick={() =>
              setAddMenuTrack(
                null,
              )
            }
          >

            <motion.div
              className="modal playlist-picker"
              initial={{
                opacity: 0,
                scale: 0.96,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
              }}
              onClick={(
                event,
              ) =>
                event.stopPropagation()
              }
            >

              <div className="modal-head">

                <div>

                  <span className="eyebrow">
                    ADD TRACK
                  </span>

                  <h2>
                    {
                      addMenuTrack.title
                    }
                  </h2>

                </div>


                <button
                  className="icon-btn"
                  onClick={() =>
                    setAddMenuTrack(
                      null,
                    )
                  }
                >

                  <X />

                </button>

              </div>


              {playlists.length ? (

                <div className="playlist-picker-list">

                  {playlists.map(
                    (
                      playlist,
                    ) => (

                      <button
                        key={
                          playlist.id
                        }
                        onClick={() =>
                          void addToPlaylist(
                            playlist.id,
                            addMenuTrack,
                          )
                        }
                      >

                        <ListMusic
                          size={18}
                        />

                        <span>

                          <b>
                            {
                              playlist.name
                            }
                          </b>

                          <small>
                            {
                              playlist
                                .trackIds
                                .length
                            }{' '}
                            tracks
                          </small>

                        </span>

                      </button>

                    ),
                  )}

                </div>

              ) : (

                <div className="empty-state">

                  <p>
                    Create a playlist
                    first.
                  </p>

                  <button
                    className="primary"
                    onClick={() => {

                      setAddMenuTrack(
                        null,
                      )

                      openCreatePlaylist()

                    }}
                  >

                    <Plus
                      size={16}
                    />

                    Create playlist

                  </button>

                </div>

              )}

            </motion.div>

          </motion.div>

        )}

      </AnimatePresence>

    </div>
  )
}