import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AnimatePresence,
  motion,
} from 'framer-motion'
import {
  Album,
  Disc3,
  Heart,
  Home,
  Library,
  ListMusic,
  Menu,
  Pause,
  Play,
  Plus,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Upload,
  User,
  Volume2,
  VolumeX,
  X,
  LogOut,
  Globe2,
  Music2,
} from 'lucide-react'


import { useAuth } from './lib/AuthContext'
import {
  aiDj,
  getStreamUrl,
  searchAll,
  trendingAll,
} from './lib/music'

import type { Track } from './lib/types'
import { importLocalAudio } from './providers/local'

type View =
  | 'home'
  | 'discover'
  | 'library'
  | 'ai-dj'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00'
  }

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins}:${String(secs).padStart(2, '0')}`
}

function Visualizer({
  playing,
  color,
}: {
  playing: boolean
  color: string
}) {
  return (
    <div
      className={`visualizer ${playing ? 'is-playing' : ''}`}
      style={
        {
          '--viz-color': color,
        } as React.CSSProperties
      }
    >
      {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
        <span key={bar} />
      ))}
    </div>
  )
}

function Cover({
  track,
  size = 'medium',
}: {
  track: Track
  size?: 'small' | 'medium' | 'large'
}) {
  return (
    <div
      className={`track-cover ${size}`}
      style={{
        background: track.artworkUrl
          ? undefined
          : `radial-gradient(circle at 30% 20%, ${track.color}, #090914 70%)`,
      }}
    >
      {track.artworkUrl ? (
        <img
          src={track.artworkUrl}
          alt=""
          loading="lazy"
        />
      ) : (
        <Disc3 size={size === 'large' ? 54 : 28} />
      )}
    </div>
  )
}

function App() {
  const { user, loading: authLoading, signOut } = useAuth()

  const [view, setView] = useState<View>('home')
  const [tracks, setTracks] = useState<Track[]>([])
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [query, setQuery] = useState('')

  const [active, setActive] = useState<Track | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loadingTrack, setLoadingTrack] = useState(false)

  const [liked, setLiked] = useState<string[]>([])
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)

  const [showPlayer, setShowPlayer] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const [aiQueue, setAiQueue] = useState<Track[]>([])
  const [localTracks, setLocalTracks] = useState<Track[]>([])

  const audioRef = useRef<HTMLAudioElement | null>(null)

  /*
   * ------------------------------------------------------------
   * LOAD MUSIC
   * ------------------------------------------------------------
   */

  const loadMusic = useCallback(async () => {
    try {
      const result = await trendingAll()

      setTracks(result)

      if (result.length > 0) {
        setActive((current) => current ?? result[0])
      }
    } catch (error) {
      console.error('Unable to load music:', error)
    }
  }, [])

  useEffect(() => {
    void loadMusic()
  }, [loadMusic])

  /*
   * ------------------------------------------------------------
   * SEARCH
   * ------------------------------------------------------------
   */

  useEffect(() => {
    const value = query.trim()

    if (!value) {
      setSearchResults([])
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        const results = await searchAll(value)
        setSearchResults(results)
      } catch (error) {
        console.error('Search failed:', error)
        setSearchResults([])
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [query])

  /*
   * ------------------------------------------------------------
   * AUDIO
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0)
    }

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0)
    }

    const onEnded = () => {
      void nextTrack()
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener(
        'loadedmetadata',
        onLoadedMetadata,
      )
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  useEffect(() => {
    if (!audioRef.current) return

    audioRef.current.volume = muted ? 0 : volume
  }, [volume, muted])

  /*
   * ------------------------------------------------------------
   * PLAY TRACK
   * ------------------------------------------------------------
   */

  const playTrack = useCallback(
    async (track: Track) => {
      try {
        setLoadingTrack(true)

        const url = await getStreamUrl(track)

        if (!url) {
          console.error(
            `No stream available for ${track.title}`,
          )
          setLoadingTrack(false)
          return
        }

        if (!audioRef.current) {
          audioRef.current = new Audio()
        }

        const audio = audioRef.current

        audio.pause()
        audio.src = url
        audio.volume = muted ? 0 : volume

        setActive(track)

        await audio.play()

        setPlaying(true)
        setCurrentTime(0)
      } catch (error) {
        console.error('Playback failed:', error)
        setPlaying(false)
      } finally {
        setLoadingTrack(false)
      }
    },
    [muted, volume],
  )

  const togglePlay = useCallback(async () => {
    if (!active) return

    if (!audioRef.current?.src) {
      await playTrack(active)
      return
    }

    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      try {
        await audioRef.current.play()
        setPlaying(true)
      } catch (error) {
        console.error(error)
      }
    }
  }, [active, playing, playTrack])

  /*
   * ------------------------------------------------------------
   * QUEUE
   * ------------------------------------------------------------
   */

  const currentQueue = useMemo(() => {
    if (view === 'ai-dj' && aiQueue.length) {
      return aiQueue
    }

    if (query.trim() && searchResults.length) {
      return searchResults
    }

    return [...localTracks, ...tracks]
  }, [
    aiQueue,
    localTracks,
    query,
    searchResults,
    tracks,
    view,
  ])

  const nextTrack = useCallback(async () => {
    if (!active || currentQueue.length === 0) return

    const index = currentQueue.findIndex(
      (track) => track.id === active.id,
    )

    const next =
      currentQueue[(index + 1) % currentQueue.length]

    if (next) {
      await playTrack(next)
    }
  }, [active, currentQueue, playTrack])

  const prevTrack = useCallback(async () => {
    if (!active || currentQueue.length === 0) return

    const index = currentQueue.findIndex(
      (track) => track.id === active.id,
    )

    const previous =
      currentQueue[
        (index - 1 + currentQueue.length) %
          currentQueue.length
      ]

    if (previous) {
      await playTrack(previous)
    }
  }, [active, currentQueue, playTrack])

  /*
   * ------------------------------------------------------------
   * LIKE
   * ------------------------------------------------------------
   */

  const toggleLike = (track: Track) => {
    setLiked((current) =>
      current.includes(track.id)
        ? current.filter((id) => id !== track.id)
        : [...current, track.id],
    )
  }

  /*
   * ------------------------------------------------------------
   * AI DJ
   * ------------------------------------------------------------
   */

  const startAiDj = () => {
    if (!active) return

    const pool = [
      ...tracks,
      ...searchResults,
      ...localTracks,
    ]

    const queue = aiDj(active, pool)

    setAiQueue(queue)
    setView('ai-dj')

    if (queue.length > 0) {
      void playTrack(queue[0])
    }
  }

  /*
   * ------------------------------------------------------------
   * LOCAL MUSIC
   * ------------------------------------------------------------
   */

  const handleImport = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(
      event.target.files ?? [],
    )

    const imported = importLocalAudio(files)

    if (!imported.length) return

    setLocalTracks((current) => [
      ...current,
      ...imported,
    ])

    setView('library')

    if (!active) {
      setActive(imported[0])
    }

    event.target.value = ''
  }

  /*
   * ------------------------------------------------------------
   * SEEK
   * ------------------------------------------------------------
   */

  const seek = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = Number(event.target.value)

    if (!audioRef.current) return

    audioRef.current.currentTime = value
    setCurrentTime(value)
  }

  /*
   * ------------------------------------------------------------
   * AUTH
   * ------------------------------------------------------------
   */

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-orb">
          <Sparkles />
        </div>

        <h2>Entering MusicGalaxy...</h2>

        <p>
          Preparing your musical universe
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-required">
        <Sparkles size={42} />
        <h1>MusicGalaxy</h1>
        <p>
          Sign in to enter your musical universe.
        </p>
      </div>
    )
  }

  /*
   * ------------------------------------------------------------
   * DATA
   * ------------------------------------------------------------
   */

  const displayTracks =
    view === 'library'
      ? localTracks
      : view === 'ai-dj'
        ? aiQueue
        : query.trim()
          ? searchResults
          : tracks

  const pageTitle =
    view === 'home'
      ? 'Your musical universe'
      : view === 'discover'
        ? 'Discover new worlds'
        : view === 'library'
          ? 'Your library'
          : 'AI DJ'

  return (
    <div className="app-shell">
      {/* BACKGROUND */}
      <div className="space-background">
        <div className="nebula nebula-one" />
        <div className="nebula nebula-two" />
        <div className="stars" />
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <button
              onClick={() => {
                setView('home')
                setShowMenu(false)
              }}
            >
              <Home size={18} />
              Home
            </button>

            <button
              onClick={() => {
                setView('discover')
                setShowMenu(false)
              }}
            >
              <Globe2 size={18} />
              Discover
            </button>

            <button
              onClick={() => {
                setView('library')
                setShowMenu(false)
              }}
            >
              <Library size={18} />
              Library
            </button>

            <button
              onClick={() => {
                setView('ai-dj')
                setShowMenu(false)
              }}
            >
              <Sparkles size={18} />
              AI DJ
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="topbar">
        <button
          className="mobile-menu-button"
          onClick={() =>
            setShowMenu((current) => !current)
          }
        >
          <Menu size={21} />
        </button>

        <button
          className="brand"
          onClick={() => setView('home')}
        >
          <span className="brand-icon">
            <Sparkles size={19} />
          </span>

          <span>
            Music<span>Galaxy</span>
          </span>
        </button>

        <nav className="desktop-nav">
          <button
            className={view === 'home' ? 'active' : ''}
            onClick={() => setView('home')}
          >
            Home
          </button>

          <button
            className={
              view === 'discover' ? 'active' : ''
            }
            onClick={() => setView('discover')}
          >
            Discover
          </button>

          <button
            className={
              view === 'library' ? 'active' : ''
            }
            onClick={() => setView('library')}
          >
            Library
          </button>

          <button
            className={
              view === 'ai-dj' ? 'active' : ''
            }
            onClick={() => setView('ai-dj')}
          >
            AI DJ
          </button>
        </nav>

        <div className="top-actions">
          <div className="search-box">
            <Search size={17} />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search the galaxy..."
            />

            {query && (
              <button
                onClick={() => setQuery('')}
                className="clear-search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            className="profile-button"
            onClick={() =>
              setShowProfile((current) => !current)
            }
          >
            <User size={18} />
          </button>
        </div>

        <AnimatePresence>
          {showProfile && (
            <motion.div
              className="profile-popover"
              initial={{
                opacity: 0,
                y: -8,
                scale: 0.97,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: -8,
                scale: 0.97,
              }}
            >
              <div className="profile-avatar">
                <User />
              </div>

              <strong>
                {user.email}
              </strong>

              <span>
                MusicGalaxy explorer
              </span>

              <button
                onClick={() => void signOut()}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* MAIN */}
      <main className="main-content">
        {/* HERO */}
        {view === 'home' && !query && (
          <motion.section
            className="hero"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="hero-copy">
              <span className="eyebrow">
                <Sparkles size={14} />
                YOUR MUSIC UNIVERSE
              </span>

              <h1>
                Music lives
                <br />
                <span>between the stars.</span>
              </h1>

              <p>
                Discover open music, create playlists,
                import your own collection and let AI
                DJ your next journey.
              </p>

              <div className="hero-actions">
                <button
                  className="primary-button"
                  onClick={() =>
                    setView('discover')
                  }
                >
                  <Globe2 size={17} />
                  Explore music
                </button>

                <button
                  className="secondary-button"
                  onClick={() =>
                    document
                      .getElementById(
                        'music-upload',
                      )
                      ?.click()
                  }
                >
                  <Upload size={17} />
                  Import music
                </button>
              </div>
            </div>

            <motion.div
              className="hero-orbit"
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 35,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <div className="orbit-ring ring-one" />
              <div className="orbit-ring ring-two" />
              <div className="orbit-ring ring-three" />

              <div className="planet">
                <Music2 size={45} />
              </div>
            </motion.div>
          </motion.section>
        )}

        {/* SEARCH */}
        {query && (
          <section className="search-results-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  SEARCH
                </span>

                <h1>
                  Results for "{query}"
                </h1>
              </div>

              <span>
                {searchResults.length} tracks
              </span>
            </div>
          </section>
        )}

        {/* PAGE HEADER */}
        {!query && (
          <motion.div
            className="page-heading"
            initial={{
              opacity: 0,
              y: 15,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <div>
              <span className="eyebrow">
                {view === 'ai-dj'
                  ? 'INTELLIGENT MIX'
                  : 'EXPLORE'}
              </span>

              <h2>{pageTitle}</h2>
            </div>

            <div className="heading-actions">
              <label
                className="icon-action"
                title="Import local music"
              >
                <Upload size={17} />

                <input
                  id="music-upload"
                  type="file"
                  accept="audio/*"
                  multiple
                  hidden
                  onChange={handleImport}
                />
              </label>

              {active && (
                <button
                  className="ai-button"
                  onClick={startAiDj}
                >
                  <Sparkles size={16} />
                  AI DJ
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* AI DJ */}
        {view === 'ai-dj' && !query && (
          <motion.section
            className="ai-panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="ai-icon">
              <Sparkles />
            </div>

            <div>
              <h3>
                AI DJ is shaping your journey
              </h3>

              <p>
                Matching genre, mood, tags and BPM
                for a smoother transition between
                tracks.
              </p>
            </div>

            {active && (
              <button
                className="primary-button"
                onClick={startAiDj}
              >
                Generate again
              </button>
            )}
          </motion.section>
        )}

        {/* TRACK GRID */}
        <section className="music-section">
          <div className="section-title-row">
            <h3>
              {query
                ? 'Search results'
                : view === 'library'
                  ? 'Local collection'
                  : view === 'ai-dj'
                    ? 'AI queue'
                    : 'Trending across the galaxy'}
            </h3>

            <span>
              {displayTracks.length}
            </span>
          </div>

          {displayTracks.length === 0 ? (
            <div className="empty-state">
              <div>
                <Disc3 size={42} />
              </div>

              <h3>
                {view === 'library'
                  ? 'Your library is empty'
                  : 'No tracks found'}
              </h3>

              <p>
                {view === 'library'
                  ? 'Import audio files from your device to start your personal universe.'
                  : 'Try another search or explore a different part of the galaxy.'}
              </p>

              {view === 'library' && (
                <button
                  className="primary-button"
                  onClick={() =>
                    document
                      .getElementById(
                        'music-upload',
                      )
                      ?.click()
                  }
                >
                  <Upload size={16} />
                  Import music
                </button>
              )}
            </div>
          ) : (
            <div className="track-grid">
              {displayTracks.map(
                (track, index) => (
                  <motion.article
                    className={`track-card ${
                      active?.id === track.id
                        ? 'selected'
                        : ''
                    }`}
                    key={track.id}
                    initial={{
                      opacity: 0,
                      y: 20,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay:
                        Math.min(
                          index,
                          8,
                        ) * 0.035,
                    }}
                    whileHover={{
                      y: -5,
                    }}
                  >
                    <div
                      className="card-art"
                      onClick={() =>
                        void playTrack(track)
                      }
                    >
                      <Cover
                        track={track}
                        size="medium"
                      />

                      <button className="card-play">
                        {active?.id ===
                          track.id &&
                        playing ? (
                          <Pause
                            size={20}
                            fill="currentColor"
                          />
                        ) : (
                          <Play
                            size={20}
                            fill="currentColor"
                          />
                        )}
                      </button>

                      {active?.id ===
                        track.id &&
                        playing && (
                          <div className="playing-indicator">
                            <Visualizer
                              playing
                              color={
                                track.color
                              }
                            />
                          </div>
                        )}
                    </div>

                    <div className="card-info">
                      <div className="card-title-row">
                        <div>
                          <h4>
                            {track.title}
                          </h4>

                          <p>
                            {track.artist}
                          </p>
                        </div>

                        <button
                          className={
                            liked.includes(
                              track.id,
                            )
                              ? 'liked'
                              : ''
                          }
                          onClick={() =>
                            toggleLike(
                              track,
                            )
                          }
                        >
                          <Heart
                            size={17}
                            fill={
                              liked.includes(
                                track.id,
                              )
                                ? 'currentColor'
                                : 'none'
                            }
                          />
                        </button>
                      </div>

                      <div className="card-meta">
                        <span>
                          {track.genre}
                        </span>

                        <span>
                          {track.durationLabel}
                        </span>
                      </div>
                    </div>
                  </motion.article>
                ),
              )}
            </div>
          )}
        </section>
      </main>

      {/* EXPANDED PLAYER */}
      <AnimatePresence>
        {showPlayer && active && (
          <motion.div
            className="player-overlay"
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
              className="expanded-player"
              initial={{
                y: '100%',
              }}
              animate={{
                y: 0,
              }}
              exit={{
                y: '100%',
              }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 220,
              }}
            >
              <button
                className="close-player"
                onClick={() =>
                  setShowPlayer(false)
                }
              >
                <X />
              </button>

              <div
                className="expanded-art"
                style={{
                  background: active.artworkUrl
                    ? undefined
                    : `radial-gradient(circle at 30% 20%, ${active.color}, #080811 68%)`,
                }}
              >
                {active.artworkUrl ? (
                  <img
                    src={active.artworkUrl}
                    alt=""
                  />
                ) : (
                  <Disc3 size={100} />
                )}
              </div>

              <div className="expanded-info">
                <span>NOW PLAYING</span>

                <h2>{active.title}</h2>

                <p>
                  {active.artist}
                  {' · '}
                  {active.album}
                </p>
              </div>

              <Visualizer
                playing={playing}
                color={active.color}
              />

              <div className="expanded-progress">
                <span>
                  {formatTime(currentTime)}
                </span>

                <input
                  type="range"
                  min="0"
                  max={
                    duration ||
                    active.duration ||
                    1
                  }
                  value={currentTime}
                  onChange={seek}
                />

                <span>
                  {formatTime(
                    duration ||
                      active.duration,
                  )}
                </span>
              </div>

              <div className="expanded-controls">
                <button>
                  <Shuffle size={20} />
                </button>

                <button
                  onClick={() =>
                    void prevTrack()
                  }
                >
                  <SkipBack size={25} />
                </button>

                <button
                  className="main-play-button"
                  onClick={() =>
                    void togglePlay()
                  }
                >
                  {loadingTrack ? (
                    <span className="spinner" />
                  ) : playing ? (
                    <Pause
                      size={27}
                      fill="currentColor"
                    />
                  ) : (
                    <Play
                      size={27}
                      fill="currentColor"
                    />
                  )}
                </button>

                <button
                  onClick={() =>
                    void nextTrack()
                  }
                >
                  <SkipForward
                    size={25}
                  />
                </button>

                <button
                  className={
                    liked.includes(
                      active.id,
                    )
                      ? 'liked'
                      : ''
                  }
                  onClick={() =>
                    toggleLike(active)
                  }
                >
                  <Heart
                    size={20}
                    fill={
                      liked.includes(
                        active.id,
                      )
                        ? 'currentColor'
                        : 'none'
                    }
                  />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM PLAYER */}
      {active && (
        <motion.footer
          className="bottom-player"
          initial={{
            y: 100,
          }}
          animate={{
            y: 0,
          }}
        >
          <div
            className="player-current"
            onClick={() =>
              setShowPlayer(true)
            }
          >
            <Cover
              track={active}
              size="small"
            />

            <div>
              <strong>
                {active.title}
              </strong>

              <span>
                {active.artist}
              </span>
            </div>
          </div>

          <div className="player-center">
            <div className="player-buttons">
              <button
                onClick={() =>
                  void prevTrack()
                }
              >
                <SkipBack size={17} />
              </button>

              <button
                className="player-play"
                onClick={() =>
                  void togglePlay()
                }
              >
                {playing ? (
                  <Pause
                    size={18}
                    fill="currentColor"
                  />
                ) : (
                  <Play
                    size={18}
                    fill="currentColor"
                  />
                )}
              </button>

              <button
                onClick={() =>
                  void nextTrack()
                }
              >
                <SkipForward size={17} />
              </button>
            </div>

            <div className="player-progress">
              <span>
                {formatTime(currentTime)}
              </span>

              <input
                type="range"
                min="0"
                max={
                  duration ||
                  active.duration ||
                  1
                }
                value={currentTime}
                onChange={seek}
              />

              <span>
                {formatTime(
                  duration ||
                    active.duration,
                )}
              </span>
            </div>
          </div>

          <div className="player-right">
            <Visualizer
              playing={playing}
              color={active.color}
            />

            <button
              className={
                liked.includes(
                  active.id,
                )
                  ? 'liked'
                  : ''
              }
              onClick={() =>
                toggleLike(active)
              }
            >
              <Heart
                size={17}
                fill={
                  liked.includes(
                    active.id,
                  )
                    ? 'currentColor'
                    : 'none'
                }
              />
            </button>

            <button
              onClick={() =>
                setMuted(
                  (current) => !current,
                )
              }
            >
              {muted ||
              volume === 0 ? (
                <VolumeX size={17} />
              ) : (
                <Volume2 size={17} />
              )}
            </button>

            <input
              className="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={
                muted ? 0 : volume
              }
              onChange={(event) => {
                setVolume(
                  Number(
                    event.target.value,
                  ),
                )
                setMuted(false)
              }}
            />
          </div>
        </motion.footer>
      )}

      {/* SEARCH POPUP */}
      <AnimatePresence>
        {query &&
          searchResults.length > 0 && (
            <motion.div
              className="search-popover"
              initial={{
                opacity: 0,
                y: -8,
                scale: 0.98,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: -8,
                scale: 0.98,
              }}
            >
              <div className="search-popover-header">
                <strong>
                  Results
                </strong>

                <span>
                  {searchResults.length}{' '}
                  found
                </span>
              </div>

              {searchResults
                .slice(0, 8)
                .map((track) => (
                  <button
                    className="search-result"
                    key={track.id}
                    onClick={() => {
                      void playTrack(
                        track,
                      )
                      setQuery('')
                    }}
                  >
                    <Cover
                      track={track}
                      size="small"
                    />

                    <span>
                      <strong>
                        {track.title}
                      </strong>

                      <small>
                        {track.artist}
                        {' · '}
                        {track.album}
                      </small>
                    </span>

                    <Play size={16} />
                  </button>
                ))}
            </motion.div>
          )}
      </AnimatePresence>

      {/* QUICK NAV */}
      <div className="quick-nav">
        <button
          className={
            view === 'home' ? 'active' : ''
          }
          onClick={() =>
            setView('home')
          }
        >
          <Home size={18} />
          <span>Home</span>
        </button>

        <button
          className={
            view === 'discover'
              ? 'active'
              : ''
          }
          onClick={() =>
            setView('discover')
          }
        >
          <Globe2 size={18} />
          <span>Discover</span>
        </button>

        <button
          className={
            view === 'library'
              ? 'active'
              : ''
          }
          onClick={() =>
            setView('library')
          }
        >
          <Library size={18} />
          <span>Library</span>
        </button>

        <button
          className={
            view === 'ai-dj'
              ? 'active'
              : ''
          }
          onClick={() =>
            setView('ai-dj')
          }
        >
          <Sparkles size={18} />
          <span>AI DJ</span>
        </button>
      </div>
    </div>
  )
}

export default App
