import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Stars,
  Float,
  Sparkles,
} from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
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
} from 'lucide-react'
import * as THREE from 'three'

import type { Track } from './lib/types'
import {
  searchAll,
  trendingAll,
} from './lib/music'
import { audioEngine } from './lib/audioEngine'
import { importLocalAudio } from './providers/local'

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

function CameraRig({ pulse }: { pulse: number }) {
  const { camera } = useThree()

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    camera.position.x +=
      (Math.sin(t * 0.08) * 0.7 - camera.position.x) * 0.006

    camera.position.y +=
      (Math.cos(t * 0.07) * 0.4 + 1.5 - camera.position.y) *
      0.006

    camera.lookAt(0, 0, 0)

    if (pulse > 0) {
      camera.position.z =
        12 + Math.sin(t * 18) * pulse * 0.15
    }
  })

  return null
}

function Galaxy({
  tracks,
  active,
  pulse,
  onSelect,
}: {
  tracks: Track[]
  active: Track
  pulse: number
  onSelect: (track: Track) => void
}) {
  const group = useRef<THREE.Group>(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    if (group.current) {
      group.current.rotation.y = t * 0.025
    }
  })

  const positions = useMemo(
    () =>
      tracks.map((_, i) => {
        const a =
          (i / Math.max(tracks.length, 1)) *
          Math.PI *
          2

        const r = 2.2 + (i % 3) * 0.8

        return [
          Math.cos(a) * r,
          Math.sin(a * 2) * 0.65,
          Math.sin(a) * r,
        ] as [number, number, number]
      }),
    [tracks],
  )

  return (
    <>
      <ambientLight intensity={0.35} />

      <pointLight
        position={[0, 0, 0]}
        intensity={20}
        distance={20}
        color={active.color}
      />

      <Stars
        radius={70}
        depth={35}
        count={2600}
        factor={2.4}
        saturation={0}
        fade
        speed={0.35}
      />

      <Sparkles
        count={900}
        scale={[18, 10, 18]}
        size={1.6}
        speed={0.25}
        opacity={0.55}
        color={active.color}
      />

      <group ref={group}>
        <mesh>
          <sphereGeometry args={[0.65, 48, 48]} />

          <meshStandardMaterial
            emissive={active.color}
            emissiveIntensity={4}
            color="#080812"
            roughness={0.2}
          />
        </mesh>

        {tracks.map((track, i) => (
          <Float
            key={track.id}
            speed={1.1 + i * 0.04}
            rotationIntensity={0.12}
            floatIntensity={0.35}
          >
            <mesh
              position={positions[i]}
              onClick={() => onSelect(track)}
            >
              <sphereGeometry
                args={[
                  track.id === active.id
                    ? 0.46
                    : 0.31 + (i % 2) * 0.07,
                  28,
                  28,
                ]}
              />

              <meshStandardMaterial
                color={track.color}
                emissive={track.color}
                emissiveIntensity={
                  track.id === active.id ? 3.5 : 1.6
                }
                metalness={0.2}
                roughness={0.35}
              />
            </mesh>
          </Float>
        ))}

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.1, 2.13, 128]} />

          <meshBasicMaterial
            color={active.color}
            transparent
            opacity={0.22}
          />
        </mesh>

        <mesh rotation={[Math.PI / 2, 0.3, 0]}>
          <ringGeometry args={[3.0, 3.018, 128]} />

          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.08}
          />
        </mesh>
      </group>

      <CameraRig pulse={pulse} />

      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={18}
        autoRotate
        autoRotateSpeed={0.12}
      />
    </>
  )
}

function Visualizer({
  playing,
  color,
}: {
  playing: boolean
  color: string
}) {
  const bars = Array.from({ length: 42 })

  return (
    <div className="visualizer" aria-hidden>
      {bars.map((_, i) => (
        <span
          key={i}
          style={
            {
              '--i': i,
              '--c': color,
            } as React.CSSProperties
          }
          className={
            playing ? 'bar active' : 'bar'
          }
        />
      ))}
    </div>
  )
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [tab, setTab] =
    useState('Galaxy')

  const [query, setQuery] =
    useState('')

  const [liked, setLiked] =
    useState(false)

  const [menu, setMenu] =
    useState(false)

  const [showPlayer, setShowPlayer] =
    useState(false)

  const [pulse, setPulse] =
    useState(0)

  const [loading, setLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [audioState, setAudioState] =
    useState(() => audioEngine.getState())

  const active =
    audioState.track ?? demoTrack

  const playing = audioState.playing
  const currentTime = audioState.currentTime
  const duration = audioState.duration
  const volume = Math.round(audioState.volume * 100)
  const muted = audioState.muted

  useEffect(() => {
    return audioEngine.subscribe(setAudioState)
  }, [])

  useEffect(() => {
    audioEngine.setQueue(tracks)
  }, [tracks])

  /*
   * Load real music from all configured providers.
   */
  useEffect(() => {
    let cancelled = false

    async function loadTrending() {
      setLoading(true)
      setMessage('')

      try {
        const results = await trendingAll()

        if (cancelled) return

        if (results.length > 0) {
          setTracks(results)
          audioEngine.setTrack(results[0])
        } else {
          setTracks([])
          audioEngine.setTrack(demoTrack)
          setMessage(
            'No music is currently available.',
          )
        }
      } catch (error) {
        console.error(
          'Failed to load music:',
          error,
        )

        if (!cancelled) {
          setTracks([])
          audioEngine.setTrack(demoTrack)
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

    loadTrending()

    return () => {
      cancelled = true
    }
  }, [])

  /*
   * Real provider search.
   */
  useEffect(() => {
    const q = query.trim()

    if (!q) {
      return
    }

    let cancelled = false

    const timer = window.setTimeout(
      async () => {
        setLoading(true)
        setMessage('')

        try {
          const results = await searchAll(q)

          if (cancelled) return

          if (results.length > 0) {
            setTracks(results)
            audioEngine.setTrack(results[0])
          } else {
            setTracks([])
            audioEngine.setTrack(demoTrack)
            setMessage(
              `No music found for "${q}".`,
            )
          }
        } catch (error) {
          console.error(
            'Music provider search failed:',
            error,
          )

          if (!cancelled) {
            setTracks([])
            audioEngine.setTrack(demoTrack)
            setMessage(
              'Music providers are temporarily unavailable.',
            )
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      },
      450,
    )

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  /*
   * Galaxy pulse.
   */
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setPulse(
          playing ? 0.7 : 0.05,
        ),
      220,
    )

    return () =>
      clearInterval(timer)
  }, [playing])

  /*
   * Audio playback is owned entirely by AudioEngine.
   * App only subscribes to its state and renders the UI.
   */

  /*
   * Import local music.
   */
  const handleLocalImport = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(
      event.target.files || [],
    )

    if (!files.length) return

    const localTracks =
      importLocalAudio(files)

    if (!localTracks.length) {
      setMessage(
        'No supported audio files were selected.',
      )
      return
    }

    setTracks((previous) => [
      ...localTracks,
      ...previous,
    ])

    audioEngine.setQueue([...localTracks, ...tracks])
    audioEngine.setTrack(localTracks[0])
    setMessage(
      `${localTracks.length} local track${
        localTracks.length === 1 ? '' : 's'
      } imported.`,
    )

    event.target.value = ''
  }

  const choose = async (track: Track) => {
    setLiked(false)
    setShowPlayer(false)
    setMessage('')
    await audioEngine.play(track)
  }

  function next() {
    void audioEngine.next()
  }

  function prev() {
    void audioEngine.previous()
  }

  const formatTime = (
    seconds: number,
  ) => {
    if (!Number.isFinite(seconds)) {
      return '0:00'
    }

    const minutes =
      Math.floor(seconds / 60)

    const secs =
      Math.floor(seconds % 60)

    return `${minutes}:${String(
      secs,
    ).padStart(2, '0')}`
  }

  const progress =
    duration > 0
      ? (currentTime / duration) * 100
      : 0

  const filtered =
    tracks

  return (
    <div className="app">

      <aside
        className={
          menu
            ? 'sidebar open'
            : 'sidebar'
        }
      >
        <div className="brand">
          <div className="brand-orb">
            <SparkleIcon size={18} />
          </div>

          <span>
            Music<span>Galaxy</span>
          </span>
        </div>

        <div className="profile-mini">
          <div className="avatar">
            N
          </div>

          <div>
            <b>Nariii</b>
            <small>Explorer</small>
          </div>

          <ChevronDown size={14} />
        </div>

        <nav>
          {nav.map(
            ([name, Icon]) => (
              <button
                className={
                  tab === name
                    ? 'nav-item active'
                    : 'nav-item'
                }
                onClick={() => {
                  setTab(name)
                  setMenu(false)
                }}
                key={name}
              >
                <Icon size={18} />
                <span>{name}</span>
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
        ].map((item) => (
          <button
            className="nav-item subtle"
            key={item}
            onClick={() => {
              setQuery(
                item === 'Trending'
                  ? ''
                  : item,
              )
              setTab('Explore')
            }}
          >
            <Radio size={16} />
            <span>{item}</span>
          </button>
        ))}

        <div className="side-bottom">
          <button className="nav-item subtle">
            <Settings size={17} />
            <span>Settings</span>
          </button>

          <button className="nav-item subtle">
            <UserRound size={17} />
            <span>Profile</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() =>
              setMenu(!menu)
            }
          >
            <Menu />
          </button>

          <div className="search">
            <Search size={17} />

            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
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
                <X size={15} />
              </button>
            )}
          </div>

          <div className="top-actions">
            <button className="icon-btn">
              <Globe2 size={18} />
            </button>

            <label className="publish">
              <Upload size={17} />
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

            <button className="publish">
              <Plus size={17} />
              Publish
            </button>

            <div className="avatar">
              N
            </div>
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" />
              YOUR PERSONAL UNIVERSE
            </div>

            <h1>
              Music should be
              <br />
              <em>experienced.</em>
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
                onClick={() =>
                  void audioEngine.toggle()
                }
              >
                {playing ? (
                  <Pause size={17} />
                ) : (
                  <Play size={17} />
                )}

                {playing
                  ? 'Pause journey'
                  : 'Enter your galaxy'}
              </button>

              <button className="ghost">
                <Share2 size={16} />
                Share galaxy
              </button>
            </div>
          </div>

          <div className="stats">
            <div>
              <b>{tracks.length}</b>
              <span>SONGS</span>
            </div>

            <div>
              <b>
                {
                  new Set(
                    tracks.map(
                      (track) =>
                        track.artist,
                    ),
                  ).size
                }
              </b>
              <span>ARTISTS</span>
            </div>

            <div>
              <b>
                {
                  new Set(
                    tracks.map(
                      (track) =>
                        track.genre,
                    ),
                  ).size
                }
              </b>
              <span>GENRES</span>
            </div>
          </div>
        </section>

        {message && (
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
            {message}
          </motion.div>
        )}

        <section className="galaxy-card">
          <div className="galaxy-toolbar">
            <div>
              <b>YOUR GALAXY</b>

              <span>
                Drag to explore · click a
                planet to play
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
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          <div className="canvas-wrap">
            {loading ? (
              <div className="galaxy-loading">
                <Activity size={24} />
                <span>
                  Discovering your universe...
                </span>
              </div>
            ) : tracks.length > 0 ? (
              <Canvas
                camera={{
                  position: [0, 1.5, 12],
                  fov: 52,
                }}
                dpr={[1, 1.7]}
              >
                <color
                  attach="background"
                  args={['#03040d']}
                />

                <fog
                  attach="fog"
                  args={[
                    '#03040d',
                    8,
                    24,
                  ]}
                />

                <Galaxy
                  tracks={tracks}
                  active={active}
                  pulse={pulse}
                  onSelect={choose}
                />
              </Canvas>
            ) : (
              <div className="galaxy-loading">
                <Globe2 size={28} />
                <span>
                  Search for music to
                  create your galaxy.
                </span>
              </div>
            )}

            <div className="galaxy-label center">
              <span className="tiny-star" />
              {active.genre.toUpperCase()}{' '}
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
                  NOW PLAYING
                </small>

                <b>
                  {active.title}
                </b>

                <span>
                  {active.artist} ·{' '}
                  {active.album}
                </span>
              </div>

              <button
                onClick={() =>
                  setLiked(!liked)
                }
                className={
                  liked ? 'liked' : ''
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

        <AnimatePresence mode="wait">
          {tab === 'Galaxy' && (
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
                      setTab('Explore')
                    }
                  >
                    View all
                  </button>
                </div>

                <div className="track-list">
                  {filtered
                    .slice(0, 8)
                    .map(
                      (
                        track,
                        index,
                      ) => (
                        <motion.button
                          whileHover={{
                            x: 5,
                          }}
                          className={
                            track.id ===
                            active.id
                              ? 'track active-track'
                              : 'track'
                          }
                          key={
                            track.id
                          }
                          onClick={() =>
                            choose(
                              track,
                            )
                          }
                        >
                          <span className="num">
                            {index + 1}
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

                          <MoreHorizontal
                            size={17}
                          />
                        </motion.button>
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
                    if (tracks[0]) {
                      choose(
                        tracks[0],
                      )
                    }
                  }}
                  disabled={
                    !tracks.length
                  }
                >
                  <Play size={16} />
                  Play mix
                </button>
              </div>
            </motion.section>
          )}

          {tab !== 'Galaxy' && (
            <motion.section
              key={tab}
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
                    {tab.toUpperCase()}
                  </span>

                  <h2>
                    {tab ===
                    'Explore'
                      ? 'Discover new worlds'
                      : tab ===
                        'Library'
                      ? 'Your collection'
                      : 'Public constellations'}
                  </h2>
                </div>

                <button className="ghost">
                  <Plus size={16} />
                  Create
                </button>
              </div>

              <div className="cards">
                {filtered.map(
                  (track) => (
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
                            size={16}
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
                filtered.length ===
                  0 && (
                  <div className="empty-state">
                    No music found.
                  </div>
                )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

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
              <Disc3 size={90} />
            </div>

            <div className="now-title">
              <span>
                NOW PLAYING
              </span>

              <h2>
                {active.title}
              </h2>

              <p>
                {active.artist} ·{' '}
                {active.album}
              </p>
            </div>

            <Visualizer
              playing={playing}
              color={active.color}
            />

            <div className="progress">
              <span>
                {formatTime(
                  currentTime,
                )}
              </span>

              <input
                type="range"
                min="0"
                max={
                  duration || 1
                }
                value={
                  Math.min(
                    currentTime,
                    duration ||
                      1,
                  )
                }
                onChange={(event) => {
                  const time =
                    Number(
                      event
                        .target
                        .value,
                    )

                  audioEngine.seek(time)
                }}
              />

              <span>
                {formatTime(
                  duration ||
                    active.duration ||
                    0,
                )}
              </span>
            </div>

            <div className="big-controls">
              <button>
                <Shuffle />
              </button>

              <button onClick={prev}>
                <SkipBack />
              </button>

              <button
                className="play-big"
                onClick={() =>
                  void audioEngine.toggle()
                }
              >
                {playing ? (
                  <Pause />
                ) : (
                  <Play />
                )}
              </button>

              <button onClick={next}>
                <SkipForward />
              </button>

              <button>
                <Repeat2 />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer
        className="player"
        onClick={(event) => {
          if (
            (
              event.target as HTMLElement
            ).closest(
              'button,input',
            )
          ) {
            return
          }

          setShowPlayer(true)
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
            <Disc3 size={15} />
          </div>

          <div>
            <b>
              {active.title}
            </b>

            <small>
              {active.artist}
            </small>
          </div>
        </div>

        <div className="player-controls">
          <button onClick={prev}>
            <SkipBack />
          </button>

          <button
            className="play"
            onClick={() => void audioEngine.toggle()}
          >
            {playing ? (
              <Pause />
            ) : (
              <Play />
            )}
          </button>

          <button onClick={next}>
            <SkipForward />
          </button>
        </div>

        <div className="player-right">
          <Visualizer
            playing={playing}
            color={active.color}
          />

          <button
            onClick={() =>
              setLiked(!liked)
            }
            className={
              liked ? 'liked' : ''
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
            onClick={() => audioEngine.toggleMute()}
          >
            {muted ||
            volume === 0 ? (
              <VolumeX size={18} />
            ) : (
              <Volume2 size={18} />
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
            onChange={(event) => {
              audioEngine.setVolume(
                Number(event.target.value) / 100,
              )
            }}
          />
        </div>
      </footer>

      {query && (
        <div className="search-pop">
          <div className="search-pop-head">
            <b>Results</b>

            <span>
              {loading
                ? 'Searching...'
                : `${filtered.length} found`}
            </span>
          </div>

          {filtered.map(
            (track) => (
              <button
                key={track.id}
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

                <Play size={15} />
              </button>
            ),
          )}

          {!loading &&
            filtered.length ===
              0 && (
              <p>
                {message ||
                  'No worlds found.'}
              </p>
            )}
        </div>
      )}
    </div>
  )
}