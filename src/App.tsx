import './App.css'

import { createPortal } from 'react-dom'

import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
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


/* ==========================================================================
   HELPERS
   ========================================================================== */



function Artwork({
  track,
  className,
  iconSize = 16,
  children,
}: {
  track: Track
  className: string
  iconSize?: number
  children?: React.ReactNode
}) {
  const [failed, setFailed] =
    useState(false)

  useEffect(() => {
    setFailed(false)
  }, [track.id, track.artworkUrl])

  const artwork =
    track.artworkUrl?.trim() || ''

  const showImage =
    artwork.length > 0 &&
    !failed

  return (
    <div
      className={`artwork ${className}`}
      style={{
        background: `radial-gradient(
          circle at 30% 30%,
          ${track.color},
          #080811 68%
        )`,
      }}
    >
      {showImage ? (
        <img
          src={artwork}
          alt={`${track.title} artwork`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => {
            console.log(
              '[MusicGalaxy artwork OK]',
              track.provider,
              track.title,
              artwork,
            )
          }}
          onError={(event) => {
            console.error(
              '[MusicGalaxy artwork FAILED]',
              {
                provider: track.provider,
                title: track.title,
                url: artwork,
                element: event.currentTarget,
              },
            )

            setFailed(true)
          }}
        />
      ) : (
        <Disc3 size={iconSize} />
      )}

      {children}
    </div>
  )
}

function formatTime(
  seconds: number,
) {
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


/* ==========================================================================
   CONSTANT SEEK WAVE

   IMPORTANT BEHAVIOUR

   PAUSED
     -> perfectly straight horizontal line

   PLAYING
     -> smooth continuous sine wave

   SONG FREQUENCY
     -> NEVER controls the wave

   CURRENT SONG TIME
     -> ONLY controls horizontal position of dot
   ========================================================================== */

function PlayerWave({
  playing,
  color,
  currentTime,
  duration,
  onSeek,
}: {
  playing: boolean
  color: string
  currentTime: number
  duration: number
  onSeek: (
    seconds: number,
  ) => void
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const waveRef =
    useRef<SVGPathElement | null>(
      null,
    )

  const progressWaveRef =
    useRef<SVGPathElement | null>(
      null,
    )

  const dotRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const rafRef =
    useRef<number>(0)

  const startRef =
    useRef<number | null>(
      null,
    )

  /*
   * Keep playback information in refs.
   *
   * This prevents currentTime updates from
   * restarting the wave animation.
   */
  const currentTimeRef =
    useRef(
      currentTime,
    )

  const durationRef =
    useRef(
      duration,
    )

  currentTimeRef.current =
    currentTime

  durationRef.current =
    duration


  /*
   * Unique clip id.
   */
  const rawId =
    useId()

  const clipId =
    `player-wave-clip-${rawId.replace(
      /:/g,
      '',
    )}`


  /*
   * ---------------------------------------------------------------
   * WAVE SETTINGS
   * ---------------------------------------------------------------
   *
   * Smaller amplitude:
   *   old ~31px
   *   new  ~15px
   *
   * Shorter wavelength:
   *   5 compact cycles across the bar
   *
   * The result is a smaller, smoother,
   * more consistent waveform.
   */

  const amplitude = 10

  const cycles = 10

  const center = 50


  /*
   * ---------------------------------------------------------------
   * EXACT WAVE FUNCTION
   * ---------------------------------------------------------------
   *
   * This is used for both:
   *
   * 1. Drawing the waveform
   * 2. Positioning the dot
   *
   * Therefore the dot always sits
   * exactly ON the curve.
   */

  const getWaveY = (
    normalizedX: number,
    phase: number,
  ) => {
    if (!playing) {
      return center
    }

    return (
      center +
      Math.sin(
        normalizedX *
          Math.PI *
          2 *
          cycles +
          phase,
      ) *
        amplitude
    )
  }


  /*
   * ---------------------------------------------------------------
   * WAVE ANIMATION LOOP
   * ---------------------------------------------------------------
   *
   * CRITICAL:
   *
   * The dependency is ONLY "playing".
   *
   * currentTime does NOT restart this loop.
   *
   * Therefore:
   *
   * PLAY
   *   -> animation starts
   *
   * PAUSE
   *   -> wave becomes straight immediately
   *
   * Song time updates
   *   -> dot moves
   *   -> wave animation continues uninterrupted
   */

  useEffect(() => {
    let mounted = true

    startRef.current =
      null

    const animate = (
      timestamp: number,
    ) => {
      if (!mounted) {
        return
      }

      if (
        startRef.current ===
        null
      ) {
        startRef.current =
          timestamp
      }

      const elapsed =
        (
          timestamp -
          startRef.current
        ) *
        0.001

      /*
       * Constant wave speed.
       *
       * This value is completely
       * independent of the song.
       */
      const phase =
        elapsed * 1.2

      const wave =
        waveRef.current

      const progressWave =
        progressWaveRef.current

      const dot =
        dotRef.current

      /*
       * -----------------------------------------------------------
       * BUILD WAVE PATH
       * -----------------------------------------------------------
       */

      if (
        wave &&
        progressWave
      ) {
        let path = ''

        const points = 240

        for (
          let i = 0;
          i <= points;
          i += 1
        ) {
          const normalizedX =
            i /
            points

          const x =
            normalizedX *
            100

          const y =
            getWaveY(
              normalizedX,
              phase,
            )

          path +=
            i === 0
              ? `M ${x.toFixed(
                  3,
                )} ${y.toFixed(
                  3,
                )}`
              : ` L ${x.toFixed(
                  3,
                )} ${y.toFixed(
                  3,
                )}`
        }

        wave.setAttribute(
          'd',
          path,
        )

        progressWave.setAttribute(
          'd',
          path,
        )
      }


      /*
       * -----------------------------------------------------------
       * PLAYBACK POSITION
       * -----------------------------------------------------------
       */

      const liveDuration =
        durationRef.current

      const liveCurrentTime =
        currentTimeRef.current

      const progress =
        liveDuration > 0
          ? Math.min(
              1,
              Math.max(
                0,
                liveCurrentTime /
                  liveDuration,
              ),
            )
          : 0


      /*
       * -----------------------------------------------------------
       * DOT
       * -----------------------------------------------------------
       *
       * PAUSED:
       *   dot sits at center line
       *
       * PLAYING:
       *   dot follows the exact sine wave
       */

      if (dot) {
        const y =
          getWaveY(
            progress,
            phase,
          )

        dot.style.left =
          `${progress * 100}%`

        dot.style.top =
          `${y}%`
      }


      rafRef.current =
        requestAnimationFrame(
          animate,
        )
    }


    rafRef.current =
      requestAnimationFrame(
        animate,
      )


    return () => {
      mounted = false

      cancelAnimationFrame(
        rafRef.current,
      )

      startRef.current =
        null
    }
  }, [playing])


  /*
   * ---------------------------------------------------------------
   * SEEK
   * ---------------------------------------------------------------
   */

  const seekFromPointer =
    (
      clientX: number,
    ) => {
      const element =
        containerRef.current

      if (!element) {
        return
      }

      const rect =
        element.getBoundingClientRect()

      if (
        rect.width <= 0
      ) {
        return
      }

      const ratio =
        Math.min(
          1,
          Math.max(
            0,
            (
              clientX -
              rect.left
            ) /
              rect.width,
          ),
        )

      onSeek(
        ratio *
          durationRef.current,
      )
    }


  const progress =
    duration > 0
      ? Math.min(
          1,
          Math.max(
            0,
            currentTime /
              duration,
          ),
        )
      : 0


  return (
    <div
      ref={
        containerRef
      }
      className={
        playing
          ? 'player-wave playing'
          : 'player-wave'
      }
      style={
        {
          '--wave-color':
            color,
        } as CSSProperties
      }
      onPointerDown={(
        event,
      ) => {
        seekFromPointer(
          event.clientX,
        )
      }}
      role="slider"
      tabIndex={0}
      aria-label="Seek through song"
      aria-valuemin={0}
      aria-valuemax={
        duration || 0
      }
      aria-valuenow={
        currentTime
      }
      onKeyDown={(
        event,
      ) => {
        if (
          event.key ===
          'ArrowRight'
        ) {
          onSeek(
            Math.min(
              duration,
              currentTime + 5,
            ),
          )
        }

        if (
          event.key ===
          'ArrowLeft'
        ) {
          onSeek(
            Math.max(
              0,
              currentTime - 5,
            ),
          )
        }

        if (
          event.key ===
          'Home'
        ) {
          onSeek(0)
        }

        if (
          event.key ===
          'End'
        ) {
          onSeek(duration)
        }
      }}
    >

      <svg
        className="player-wave-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >

        <defs>

          <clipPath
            id={
              clipId
            }
          >

            <rect
              x="0"
              y="0"
              width={
                progress *
                100
              }
              height="100"
            />

          </clipPath>

        </defs>


        <path
          ref={
            waveRef
          }
          className="wave-line background"
          d="M 0 50 L 100 50"
        />


        <path
          ref={
            progressWaveRef
          }
          className="wave-line foreground"
          d="M 0 50 L 100 50"
          clipPath={
            `url(#${clipId})`
          }
        />

      </svg>


      <div
        ref={
          dotRef
        }
        className="player-wave-dot"
        style={{
          left:
            `${progress * 100}%`,
          top: '50%',
        }}
      />

    </div>
  )
}


/* ==========================================================================
   LIKE HEART BURST — SMOOTH PARABOLIC PROJECTILES
   ========================================================================== */

function LikeHeartBurst({
  trigger,
  direction,
  sourceRef,
  destinationRef,
}: {
  trigger: number
  direction: 'forward' | 'reverse'
  sourceRef: React.RefObject<HTMLElement | null>
  destinationRef: React.RefObject<HTMLElement | null>
}) {
  type Point = { x: number; y: number }
  type Particle = {
    id: number
    size: number
    delay: number
    duration: number
    rotation: number
    points: Point[]
  }

  const [burst, setBurst] = useState<{
    id: number
    particles: Particle[]
  } | null>(null)

  const forwardRoutesRef = useRef<Particle[] | null>(null)

  useEffect(() => {
    if (!trigger) return

    const sourceRect = sourceRef.current?.getBoundingClientRect()
    const destinationRect = destinationRef.current?.getBoundingClientRect()

    if (!sourceRect || !destinationRect) return

    const likePoint: Point = {
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top + sourceRect.height / 2,
    }

    const thumbnailPoint: Point = {
      x: destinationRect.left + destinationRect.width / 2,
      y: destinationRect.top + destinationRect.height / 2,
    }

    const makeForwardParticles = (): Particle[] => {
      const centerX = window.innerWidth * 0.5
      const centerY = window.innerHeight * 0.30
      const particles: Particle[] = []
      const sampleQuadratic = (
        t: number,
        p0: Point,
        p1: Point,
        p2: Point,
      ): Point => {
        const u = 1 - t
        return {
          x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
          y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
        }
      }

      for (let index = 0; index < 14; index += 1) {
        const spread = (index - 6.5) / 6.5
        const side = index % 2 === 0 ? -1 : 1
        const endSpread = spread * 26
        const apex = {
          x:
            centerX +
            spread * 155 +
            side * (8 + Math.random() * 24),
          y:
            centerY -
            20 -
            Math.random() * 72,
        }

        const control: Point = {
          x: apex.x + (Math.random() - 0.5) * 48,
          y: apex.y + (Math.random() - 0.5) * 22,
        }

        const end: Point = {
          x: thumbnailPoint.x + endSpread,
          y: thumbnailPoint.y + (Math.random() - 0.5) * 10,
        }

        const points: Point[] = []
        const steps = 15

        for (let step = 0; step <= steps; step += 1) {
          points.push(
            sampleQuadratic(
              step / steps,
              likePoint,
              control,
              end,
            ),
          )
        }

        particles.push({
          id: index,
          size: 9 + Math.random() * 6,
          delay: Math.random() * 0.08,
          duration: 1.38 + Math.random() * 0.16,
          rotation: (Math.random() - 0.5) * 70,
          points,
        })
      }

      return particles
    }

    let particles: Particle[]

    if (direction === 'forward' || !forwardRoutesRef.current) {
      particles = makeForwardParticles()
      forwardRoutesRef.current = particles.map((particle) => ({
        ...particle,
        points: particle.points.map((point) => ({ ...point })),
      }))
    } else {
      particles = forwardRoutesRef.current.map((particle) => ({
        ...particle,
        delay: Math.random() * 0.08,
        duration: 1.38 + Math.random() * 0.16,
        points: [...particle.points].reverse().map((point) => ({
          ...point,
        })),
      }))
    }

    const renderOrigin =
      direction === 'forward'
        ? likePoint
        : thumbnailPoint

    const normalized = particles.map((particle) => ({
      ...particle,
      points: particle.points.map((point) => ({
        x: point.x - renderOrigin.x,
        y: point.y - renderOrigin.y,
      })),
    }))

    setBurst({
      id: trigger,
      particles: normalized,
    })

    const timeout = window.setTimeout(() => {
      setBurst(null)
    }, 1850)

    return () => window.clearTimeout(timeout)
  }, [trigger, direction, sourceRef, destinationRef])

  if (!burst) return null

  const renderSource =
    direction === 'forward'
      ? sourceRef.current?.getBoundingClientRect()
      : destinationRef.current?.getBoundingClientRect()

  const originX = renderSource
    ? renderSource.left + renderSource.width / 2
    : 0
  const originY = renderSource
    ? renderSource.top + renderSource.height / 2
    : 0

  return (
    <div className="like-burst-layer" aria-hidden="true">
      {burst.particles.map((particle) => (
        <motion.span
          key={`${burst.id}-${particle.id}`}
          className="like-burst-heart"
          style={{
            left: originX,
            top: originY,
            width: particle.size,
            height: particle.size,
          }}
          initial={{
            x: -particle.size / 2,
            y: -particle.size / 2,
            opacity: 0,
            scale: 0.3,
            rotate: 0,
          }}
          animate={{
            x: particle.points.map(
              (point) => point.x - particle.size / 2,
            ),
            y: particle.points.map(
              (point) => point.y - particle.size / 2,
            ),
            opacity: [0, 1, 1, 0.94, 0.62, 0.22, 0],
            scale: [0.3, 0.8, 1, 1.02, 0.9, 0.45, 0.02],
            rotate: [
              0,
              particle.rotation * 0.25,
              particle.rotation * 0.5,
              particle.rotation * 0.8,
              particle.rotation,
              particle.rotation * 1.15,
              particle.rotation * 1.3,
            ],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: 'easeInOut',
            times: [0, 0.08, 0.22, 0.48, 0.68, 0.86, 1],
          }}
        >
          <Heart
            size={particle.size}
            fill="currentColor"
            strokeWidth={1.8}
          />
        </motion.span>
      ))}
    </div>
  )
}


type ShuffleMode = 'playlist' | 'all-playlists' | 'galaxy'

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function uniqueTracks(items: Track[]): Track[] {
  const map = new Map<string, Track>()
  for (const track of items) {
    if (!map.has(track.id)) map.set(track.id, track)
  }
  return Array.from(map.values())
}

function ShuffleMenu({
  mode,
  playlistName,
  playlistCount,
  allPlaylistCount,
  hasPlaylists,
  galaxyCount,
  onSelect,
  anchorRect,
}: {
  mode: ShuffleMode | null
  playlistName?: string
  playlistCount: number
  allPlaylistCount: number
  hasPlaylists: boolean
  galaxyCount: number
  onSelect: (mode: ShuffleMode) => void
  anchorRect: DOMRect
}) {
  const width = Math.min(300, window.innerWidth - 24)
  const left = Math.max(
    12,
    Math.min(
      anchorRect.left + anchorRect.width / 2 - width / 2,
      window.innerWidth - width - 12,
    ),
  )

  const bottom = Math.max(
    12,
    window.innerHeight - anchorRect.top + 12,
  )

  const optionClass = (active: boolean) =>
    active ? 'shuffle-option active' : 'shuffle-option'

  const playlistSecondary = playlistName
    ? `Current · ${playlistCount} songs`
    : undefined

  const personalSecondary = hasPlaylists
    ? 'add to your Playlist'
    : 'Create Playlist'

  const menu = (
    <motion.div
      className="shuffle-menu"
      initial={{ opacity: 0, y: 7, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 7, scale: 0.97 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        '--shuffle-left': `${left}px`,
        '--shuffle-bottom': `${bottom}px`,
        '--shuffle-width': `${width}px`,
      } as CSSProperties}
    >
      <button
        type="button"
        role="menuitem"
        className={optionClass(mode === 'playlist')}
        onClick={() => onSelect('playlist')}
        disabled={!playlistName}
      >
        <span className="shuffle-option-icon">
          <ListMusic size={16} />
        </span>

        <span className="shuffle-option-copy">
          <b>Shuffle playlist</b>
          {playlistSecondary && <small>{playlistSecondary}</small>}
        </span>

        {mode === 'playlist' && <Check size={15} />}
      </button>

      <button
        type="button"
        role="menuitem"
        className={optionClass(mode === 'all-playlists')}
        onClick={() => {
          if (allPlaylistCount === 0) {
            onSelect('all-playlists')
            return
          }
          onSelect('all-playlists')
        }}
        disabled={false}
      >
        <span className="shuffle-option-icon">
          <ListMusic size={16} />
        </span>

        <span className="shuffle-option-copy">
          <b>Shuffle your playlist</b>
          <small>{personalSecondary}</small>
        </span>

        {mode === 'all-playlists' && <Check size={15} />}
      </button>

      <button
        type="button"
        role="menuitem"
        className={optionClass(mode === 'galaxy')}
        onClick={() => onSelect('galaxy')}
        disabled={galaxyCount === 0}
      >
        <span className="shuffle-option-icon">
          <SparkleIcon size={16} />
        </span>

        <span className="shuffle-option-copy">
          <b>Shuffle Music Galaxy</b>
        </span>

        {mode === 'galaxy' && <Check size={15} />}
      </button>
    </motion.div>
  )

  return createPortal(menu, document.body)
}

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
  ] = useState(
    'Galaxy',
  )

  const [
    query,
    setQuery,
  ] = useState('')

  const [
    searchOpen,
    setSearchOpen,
  ] = useState(false)

  const searchAreaRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const [
    liked,
    setLiked,
  ] = useState(false)

  const [likeBurst, setLikeBurst] = useState(0)
  const [likeBurstDirection, setLikeBurstDirection] = useState<'forward' | 'reverse'>('forward')
  const likeButtonRef = useRef<HTMLButtonElement | null>(null)
  const currentArtworkRef = useRef<HTMLDivElement | null>(null)

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
  ] = useState<
    string | null
  >(null)

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
  ] = useState<
    string | null
  >(null)

  const [
    editingPlaylistName,
    setEditingPlaylistName,
  ] = useState('')

  const [
    audioState,
    setAudioState,
  ] = useState(
    () =>
      audioEngine.getState(),
  )


  /* ========================================================================
     UI MODE STATE
     ======================================================================== */

  const [shuffleUi, setShuffleUi] = useState(
    () => audioEngine.getState().shuffle,
  )

  const [repeatUi, setRepeatUi] = useState(
    () => audioEngine.getState().repeat,
  )

  const [shuffleMode, setShuffleMode] = useState<ShuffleMode | null>(null)
  const [shuffleMenuOpen, setShuffleMenuOpen] = useState(false)
  const [shuffleMenuAnchor, setShuffleMenuAnchor] = useState<DOMRect | null>(null)


  /* ========================================================================
     AUDIO STATE
     ======================================================================== */

  useEffect(() => {
    const unsubscribe =
      audioEngine.subscribe(
        (
          state,
        ) => {
          setAudioState(
            state,
          )


          if (
            state.track
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
  }, [])


  const playing =
    audioState.playing

  const currentTime =
    audioState.currentTime

  const duration =
    audioState.duration ||
    active.duration ||
    0

  const volume =
    Math.round(
      audioState.volume *
        100,
    )

  const muted =
    audioState.muted

  const shuffle = shuffleUi

  const repeat = repeatUi

  const audioLoading =
    audioState.loading


  /* ========================================================================
     SEARCH OUTSIDE CLICK
     ======================================================================== */

  useEffect(() => {
    if (!searchOpen) {
      return
    }

    const handlePointerDown =
      (
        event: PointerEvent,
      ) => {
        const target =
          event.target as Node

        if (
          searchAreaRef.current &&
          !searchAreaRef.current.contains(
            target,
          )
        ) {
          setSearchOpen(
            false,
          )
        }
      }

    const handleKeyDown =
      (
        event: KeyboardEvent,
      ) => {
        if (
          event.key ===
          'Escape'
        ) {
          setSearchOpen(
            false,
          )
        }
      }

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
    )

    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
      )

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [searchOpen])


  /* ========================================================================
     SHUFFLE MENU OUTSIDE CLICK
     ======================================================================== */

  useEffect(() => {
    if (!shuffleMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement

      if (!target.closest('.shuffle-anchor') && !target.closest('.shuffle-menu')) {
        setShuffleMenuOpen(false)
        setShuffleMenuAnchor(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [shuffleMenuOpen])


  /* ========================================================================
     LIBRARY RESTORE
     ======================================================================== */

  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        const snapshot =
          await loadLibrary()

        if (
          cancelled
        ) {
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
            (
              previous,
            ) => {
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
                  (
                    track,
                  ) =>
                    !localIds.has(
                      track.id,
                    ),
                ),
              ]
            },
          )
        }
      } catch (
        error
      ) {
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


  /* ========================================================================
     AUDIO QUEUE
     ======================================================================== */

  useEffect(() => {
    audioEngine.setQueue(
      tracks,
    )
  }, [tracks])


  /* ========================================================================
     TRENDING
     ======================================================================== */

  useEffect(() => {
    let cancelled = false

    async function loadTrending() {
      setLoading(true)

      try {
        const results =
          await trendingAll()

        if (
          cancelled
        ) {
          return
        }

        if (
          results.length
        ) {
          setTracks(
            (
              previous,
            ) => {
              const map =
                new Map<
                  string,
                  Track
                >()

              previous.forEach(
                (
                  track,
                ) =>
                  map.set(
                    track.id,
                    track,
                  ),
              )

              results.forEach(
                (
                  track,
                ) =>
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

          if (
            !audioEngine.getState()
              .track
          ) {
            setActive(
              results[0],
            )
          }
        }
      } catch (
        error
      ) {
        console.error(
          'Failed to load music:',
          error,
        )

        if (
          !cancelled
        ) {
          setMessage(
            'Music providers are temporarily unavailable.',
          )
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          )
        }
      }
    }

    void loadTrending()

    return () => {
      cancelled = true
    }
  }, [])


  /* ========================================================================
     SEARCH
     ======================================================================== */

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

            if (
              cancelled
            ) {
              return
            }

            setTracks(
              results,
            )

            setSearchOpen(
              true,
            )

            if (
              !results.length
            ) {
              setMessage(
                `No music found for "${search}".`,
              )
            }
          } catch (
            error
          ) {
            console.error(
              'Search failed:',
              error,
            )

            if (
              !cancelled
            ) {
              setMessage(
                'Music providers are temporarily unavailable.',
              )

              setSearchOpen(
                true,
              )
            }
          } finally {
            if (
              !cancelled
            ) {
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


  /* ========================================================================
     GALAXY PULSE
     ======================================================================== */

  useEffect(() => {
    let raf = 0

    const update = () => {
      const level =
        audioEngine.getAudioLevel()

      setPulse(
        playing
          ? Math.min(
              1,
              0.04 +
                level *
                  0.8,
            )
          : 0.03,
      )

      raf =
        requestAnimationFrame(
          update,
        )
    }

    raf =
      requestAnimationFrame(
        update,
      )

    return () => {
      cancelAnimationFrame(
        raf,
      )
    }
  }, [playing])


  /* ========================================================================
     CHOOSE TRACK
     ======================================================================== */

  const choose = async (
    track: Track,
  ) => {
    setActive(
      track,
    )

    setLiked(false)

    setMessage('')

    setSearchOpen(
      false,
    )

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


  /* ========================================================================
     PLAYBACK
     ======================================================================== */

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
        setActive(
          track,
        )

        setLiked(false)

        void addRecent(
          track.id,
        )
      }
    }


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
        setActive(
          track,
        )

        setLiked(false)

        void addRecent(
          track.id,
        )
      }
    }


  /* ========================================================================
     SEEK
     ======================================================================== */

  const seekTo = (
    seconds: number,
  ) => {
    audioEngine.seek(
      seconds,
    )
  }


  /* ========================================================================
     VOLUME
     ======================================================================== */

  const handleVolume = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    audioEngine.setVolume(
      Number(
        event.target.value,
      ) / 100,
    )
  }


  const toggleMute = () => {
    audioEngine.toggleMute()
  }


  const toggleShuffle = (event: MouseEvent<HTMLButtonElement>) => {
    if (shuffleMenuOpen) {
      setShuffleMenuOpen(false)
      setShuffleMenuAnchor(null)
      return
    }

    setShuffleMenuAnchor(
      event.currentTarget.getBoundingClientRect(),
    )
    setShuffleMenuOpen(true)
  }

  const applyShuffleMode = (mode: ShuffleMode) => {
    let source: Track[] = []

    if (mode === 'playlist') {
      const playlist = playlists.find((item) =>
        item.trackIds.includes(active.id),
      )

      if (!playlist) {
        setMessage('The current song is not in a playlist.')
        setShuffleMenuOpen(false)
        setShuffleMenuAnchor(null)
        return
      }

      source = playlist.trackIds
        .map(
          (id) =>
            tracks.find((track) => track.id === id) ||
            libraryTracks.find((track) => track.id === id),
        )
        .filter((track): track is Track => Boolean(track))
    } else if (mode === 'all-playlists') {
      if (!playlists.length) {
        setShuffleMenuOpen(false)
        setShuffleMenuAnchor(null)
        openCreatePlaylist()
        return
      }

      source = playlists
        .flatMap((playlist) => playlist.trackIds)
        .map(
          (id) =>
            tracks.find((track) => track.id === id) ||
            libraryTracks.find((track) => track.id === id),
        )
        .filter((track): track is Track => Boolean(track))
    } else {
      source = tracks
    }

    const unique = uniqueTracks(source)

    if (!unique.length) {
      setMessage('No songs are available for this shuffle source.')
      setShuffleMenuOpen(false)
      return
    }

    const hasActive = unique.some((track) => track.id === active.id)
    const remaining = shuffleArray(
      unique.filter((track) => track.id !== active.id),
    )
    const queue = hasActive ? [active, ...remaining] : remaining

    // The queue itself is randomized, so disable the engine's legacy boolean
    // shuffle to avoid applying a second shuffle layer.
    if (audioEngine.getState().shuffle) {
      audioEngine.toggleShuffle()
    }

    audioEngine.setQueue(queue)

    setShuffleMode(mode)
    setShuffleUi(true)
    setAudioState((previous) => ({
      ...previous,
      shuffle: true,
    }))
    setShuffleMenuOpen(false)
    setShuffleMenuAnchor(null)

    setMessage(
      mode === 'playlist'
        ? 'Playlist shuffle enabled.'
        : mode === 'all-playlists'
          ? 'All playlist shuffle enabled.'
          : 'Music Galaxy shuffle enabled.',
    )
  }


  const cycleRepeat = () => {
    audioEngine.cycleRepeat()

    const nextRepeat =
      repeatUi === 'off'
        ? 'all'
        : repeatUi === 'all'
          ? 'one'
          : 'off'

    setRepeatUi(nextRepeat)
    setAudioState((previous) => ({
      ...previous,
      repeat: nextRepeat,
    }))
  }


  /* ========================================================================
     FAVORITE
     ======================================================================== */

  const toggleFavorite =
    async () => {
      const nextLiked = !liked

      setLiked(nextLiked)
      setLikeBurstDirection(
        nextLiked ? 'forward' : 'reverse',
      )
      setLikeBurst((value) => value + 1)

      await setFavorite(
        active.id,
        nextLiked,
      )
    }


  /* ========================================================================
     LOCAL IMPORT
     ======================================================================== */

  const handleLocalImport =
    async (
      event: ChangeEvent<HTMLInputElement>,
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
          (
            file,
          ) =>
            file.type.startsWith(
              'audio/',
            ),
        )

      const localTracks =
        importLocalAudio(
          audioFiles,
        )

      if (!localTracks.length) {
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

      if (!saved.length) {
        setMessage(
          'Unable to save the imported tracks.',
        )

        event.target.value =
          ''

        return
      }

      setLibraryTracks(
        (
          previous,
        ) => {
          const map =
            new Map<
              string,
              Track
            >()

          previous.forEach(
            (
              track,
            ) =>
              map.set(
                track.id,
                track,
              ),
          )

          saved.forEach(
            (
              track,
            ) =>
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
        (
          previous,
        ) => {
          const ids =
            new Set(
              saved.map(
                (
                  track,
                ) =>
                  track.id,
              ),
            )

          return [
            ...saved,
            ...previous.filter(
              (
                track,
              ) =>
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

      setSearchOpen(
        false,
      )

      setMessage(
        `${saved.length} local track${
          saved.length ===
          1
            ? ''
            : 's'
        } imported into your library.`,
      )

      event.target.value =
        ''
    }


  /* ========================================================================
     PLAYLISTS
     ======================================================================== */

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
          (
            previous,
          ) => [
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
      } catch (
        error
      ) {
        console.error(
          'Create playlist failed:',
          error,
        )

        setMessage(
          'Unable to create playlist.',
        )
      }
    }


  const handleDeletePlaylist =
    async (
      playlistId: string,
    ) => {
      const playlist =
        playlists.find(
          (
            item,
          ) =>
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
          (
            previous,
          ) =>
            previous.filter(
              (
                item,
              ) =>
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
      } catch (
        error
      ) {
        console.error(
          'Delete playlist failed:',
          error,
        )
      }
    }


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
          (
            item,
          ) =>
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
          (
            previous,
          ) =>
            previous.map(
              (
                item,
              ) =>
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
      } catch (
        error
      ) {
        console.error(
          'Rename playlist failed:',
          error,
        )
      }
    }


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
        (
          previous,
        ) =>
          previous.map(
            (
              item,
            ) =>
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
        (
          previous,
        ) =>
          previous.map(
            (
              item,
            ) =>
              item.id ===
              updated.id
                ? updated
                : item,
          ),
      )
    }


  const playPlaylist =
    async (
      playlist: Playlist,
    ) => {
      const playlistTracks =
        playlist.trackIds
          .map(
            (
              id,
            ) =>
              tracks.find(
                (
                  track,
                ) =>
                  track.id ===
                  id,
              ) ||
              libraryTracks.find(
                (
                  track,
                ) =>
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


  /* ========================================================================
     FILTERS
     ======================================================================== */

  const filtered =
    tab === 'Library'
      ? libraryTracks
      : tracks

  const selectedPlaylist =
    playlists.find(
      (
        playlist,
      ) =>
        playlist.id ===
        selectedPlaylistId,
    )

  const currentPlaylist = playlists.find((playlist) =>
    playlist.trackIds.includes(active.id),
  )

  const currentPlaylistTracks = currentPlaylist
    ? uniqueTracks(
        currentPlaylist.trackIds
          .map(
            (id) =>
              tracks.find((track) => track.id === id) ||
              libraryTracks.find((track) => track.id === id),
          )
          .filter((track): track is Track => Boolean(track)),
      )
    : []

  const allPlaylistTracks = uniqueTracks(
    playlists
      .flatMap((playlist) => playlist.trackIds)
      .map(
        (id) =>
          tracks.find((track) => track.id === id) ||
          libraryTracks.find((track) => track.id === id),
      )
      .filter((track): track is Track => Boolean(track)),
  )

  const repeatLabel =
    repeat === 'one'
      ? 'Repeat one'
      : repeat === 'all'
        ? 'Repeat all'
        : 'Repeat off'

  const searchResults =
    query.trim()
      ? tracks
      : []


  /* ========================================================================
     RENDER
     ======================================================================== */

  return (
    <div className="app">

      {/* ================================================================ */}
      {/* SIDEBAR                                                           */}
      {/* ================================================================ */}

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
            (
              [
                name,
                Icon,
              ],
            ) => (

              <button
                key={name}
                className={
                  tab === name
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

                  setSearchOpen(
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
          (
            item,
          ) => (

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

                setSearchOpen(
                  item !==
                    'Trending',
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

        {/* ================================================================ */}
        {/* TOPBAR                                                           */}
        {/* ================================================================ */}

        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() =>
              setMenu(
                (
                  value,
                ) =>
                  !value,
              )
            }
          >

            <Menu />

          </button>


          <div
            ref={
              searchAreaRef
            }
            className="search-wrapper"
          >

            <div
              className={
                searchOpen
                  ? 'search is-open'
                  : 'search'
              }
            >

              <Search
                size={17}
              />


              <input
                value={
                  query
                }
                onFocus={() => {

                  if (
                    query.trim()
                  ) {
                    setSearchOpen(
                      true,
                    )
                  }

                }}
                onChange={(
                  event,
                ) => {

                  const value =
                    event.target
                      .value

                  setQuery(
                    value,
                  )

                  setSearchOpen(
                    Boolean(
                      value.trim(),
                    ),
                  )

                }}
                placeholder="Search songs, artists, albums..."
                autoComplete="off"
                aria-label="Search"
              />


              {query && (

                <button
                  type="button"
                  className="search-clear"
                  aria-label="Clear search"
                  onClick={() => {

                    setQuery('')

                    setMessage('')

                    setSearchOpen(
                      false,
                    )

                  }}
                >

                  <X
                    size={15}
                  />

                </button>

              )}

            </div>


            <AnimatePresence>

              {searchOpen &&
                query.trim() && (

                <motion.div
                  className="search-pop"
                  initial={{
                    opacity: 0,
                    y: -7,
                    scale: 0.985,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: -7,
                    scale: 0.985,
                  }}
                  transition={{
                    duration: 0.14,
                  }}
                  onPointerDown={(
                    event,
                  ) =>
                    event.stopPropagation()
                  }
                >

                  <div className="search-pop-head">

                    <b>
                      Results
                    </b>

                    <span>
                      {loading
                        ? 'Searching...'
                        : `${searchResults.length} found`}
                    </span>

                  </div>


                  <div className="search-results-scroll">

                    {searchResults.map(
                      (
                        track,
                      ) => (

                        <button
                          key={
                            track.id
                          }
                          type="button"
                          className="search-result-row"
                          onClick={() =>
                            void choose(
                              track,
                            )
                          }
                        >

                          <Artwork
                            track={track}
                            className="mini-cover"
                            iconSize={15}
                          />


                          <span className="search-result-info">

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


                    {loading && (

                      <div className="search-loading">

                        <Activity
                          size={17}
                        />

                        <span>
                          Searching...
                        </span>

                      </div>

                    )}


                    {!loading &&
                      !searchResults.length && (

                      <div className="search-empty">

                        {
                          message ||
                          'No worlds found.'
                        }

                      </div>

                    )}

                  </div>

                </motion.div>

              )}

            </AnimatePresence>

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


        {/* ================================================================ */}
        {/* HERO                                                             */}
        {/* ================================================================ */}

        <section className="hero">

          <div className="hero-copy">

            <div className="eyebrow">

              <span className="live-dot" />

              YOUR PERSONAL UNIVERSE

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
                onClick={() =>
                  void togglePlayback()
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


        {/* ================================================================ */}
        {/* GALAXY                                                           */}
        {/* ================================================================ */}

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

            ) : tracks.length ? (

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
                  Search for music to
                  create your galaxy.
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


              <motion.button
                onClick={() =>
                  void toggleFavorite()
                }
                animate={
                  liked
                    ? { scale: [1, 1.12, 0.96, 1.03, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={
                  liked
                    ? 'liked like-button'
                    : 'like-button'
                }
                aria-label={
                  liked ? 'Unlike' : 'Like'
                }
                title={
                  liked ? 'Unlike' : 'Like'
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

              </motion.button>

            </div>

          </div>

        </section>


        {/* ================================================================ */}
        {/* CONTENT                                                          */}
        {/* ================================================================ */}

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

                        <motion.div
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
                        >

                          <button
                            className="track-main"
                            onClick={() =>
                              void choose(
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

                        </motion.div>

                      ),
                    )}


                  {!loading &&
                    !filtered.length && (

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


              {libraryTracks.length ? (

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
                          void choose(
                            track,
                          )
                        }
                      >

                        <div
                          className="card-art"
                          style={{
                            background: `radial-gradient(circle at 30% 30%, ${track.color}, #080811 65%)`,
                          }}
                        >
                          {track.artworkUrl ? (
                            <img
                              src={track.artworkUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <span>✦</span>
                          )}

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
                        void choose(
                          track,
                        )
                      }
                    >

                      <div
                        className="card-art"
                        style={{
                          background: `radial-gradient(circle at 30% 30%, ${track.color}, #080811 65%)`,
                        }}
                      >

                        {track.artworkUrl ? (
                          <img
                            src={track.artworkUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <span>✦</span>
                        )}

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


              {!playlists.length ? (

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


                                  <Artwork
                                    track={track}
                                    className="mini-cover"
                                    iconSize={15}
                                  />


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
                                    className="track-remove"
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

        </AnimatePresence>

      </main>
\n\n      <AnimatePresence>
        {shuffleMenuOpen && shuffleMenuAnchor && (
          <ShuffleMenu
            mode={shuffleMode}
            playlistName={currentPlaylist?.name}
            playlistCount={currentPlaylistTracks.length}
            allPlaylistCount={allPlaylistTracks.length}
            hasPlaylists={playlists.length > 0}
            galaxyCount={tracks.length}
            onSelect={applyShuffleMode}
            anchorRect={shuffleMenuAnchor}
          />
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* EXPANDED PLAYER                                                    */}
      {/* ================================================================== */}

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
                background: active.artworkUrl
                  ? '#080811'
                  : `radial-gradient(circle at 30% 20%, ${active.color}, #080811 62%)`,
              }}
            >
              {active.artworkUrl ? (
                <img
                  src={active.artworkUrl}
                  alt=""
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <Disc3 size={90} />
              )}
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


            <div className="expanded-seek">
              <span className="expanded-time expanded-time-current">
                {formatTime(currentTime)}
              </span>

              <PlayerWave
                playing={playing}
                color={active.color}
                currentTime={currentTime}
                duration={duration}
                onSeek={seekTo}
              />

              <span className="expanded-time expanded-time-end">
                {formatTime(duration)}
              </span>
            </div>

            <div className="big-controls">

              <div className="shuffle-anchor">
                <button
                  className={
                    shuffle
                      ? 'control-active'
                      : ''
                  }
                  onClick={toggleShuffle}
                  aria-pressed={shuffle}
                  aria-label="Choose shuffle source"
                  title="Choose shuffle source"
                >
                  <Shuffle />
                </button>
              </div>


              <button
                onClick={() =>
                  void previous()
                }
              >

                <SkipBack />

              </button>


              <button
                className="play-big"
                onClick={() =>
                  void togglePlayback()
                }
              >

                {playing ? (
                  <Pause />
                ) : (
                  <Play />
                )}

              </button>


              <button
                onClick={() =>
                  void next()
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
                aria-pressed={repeat !== 'off'}
                aria-label={repeatLabel}
                title={repeatLabel}
              >

                <Repeat2 />
                {repeat === 'one' && (
                  <span className="repeat-mode-badge">1</span>
                )}

              </button>

            </div>

          </motion.div>

        )}

      </AnimatePresence>


      {/* ================================================================== */}
      {/* BOTTOM PLAYER                                                      */}
      {/* ================================================================== */}

      <footer
        className="player"
        onClick={(
          event,
        ) => {
          if (
            (
              event.target as HTMLElement
            ).closest(
              'button,input,.player-wave',
            )
          ) {
            return
          }

          setShowPlayer(true)
        }}
      >

        <div className="player-left">

          <div className="current">

            <div ref={currentArtworkRef}>
              <Artwork
                track={active}
                className="mini-cover"
                iconSize={15}
              />
            </div>

            <div>
              <b>{active.title}</b>
              <small>{active.artist}</small>
            </div>

          </div>

          <div className="player-controls">

          <div className="shuffle-anchor">
            <button
              className={
                shuffle
                  ? 'control-active'
                  : ''
              }
              onClick={toggleShuffle}
              aria-label="Choose shuffle source"
              title="Choose shuffle source"
              aria-pressed={shuffle}
              data-active={shuffle ? 'true' : 'false'}
            >
              <Shuffle />
            </button>
          </div>


          <button
            onClick={() => void previous()}
            aria-label="Previous track"
            title="Previous"
          >
            <SkipBack />
          </button>


          <button
            className="play"
            onClick={() => void togglePlayback()}
            aria-label={
              playing
                ? 'Pause'
                : 'Play'
            }
            title={
              playing
                ? 'Pause'
                : 'Play'
            }
          >
            {playing ? (
              <Pause />
            ) : (
              <Play />
            )}
          </button>


          <button
            onClick={() => void next()}
            aria-label="Next track"
            title="Next"
          >
            <SkipForward />
          </button>


          <button
            className={
              repeat !== 'off'
                ? 'control-active'
                : ''
            }
            onClick={() => {
              cycleRepeat()
            }}
            aria-pressed={repeat !== 'off'}
            aria-label={repeatLabel}
            title={repeatLabel}
            data-active={repeat !== 'off' ? 'true' : 'false'}
          >
            <Repeat2 />
            {repeat === 'one' && (
              <span className="repeat-mode-badge">1</span>
            )}
          </button>

          </div>

        </div>


        <div className="player-seek">

          <span className="player-time player-time-current">
            {formatTime(currentTime)}
          </span>

          <div className="player-wave-container">
            <PlayerWave
              playing={playing}
              color={active.color}
              currentTime={currentTime}
              duration={duration}
              onSeek={seekTo}
            />
          </div>

          <span className="player-time player-time-end">
            {formatTime(duration)}
          </span>

        </div>


        <div className="player-right">

          <motion.button
            ref={likeButtonRef}
            animate={
              liked
                ? { scale: [1, 1.16, 0.94, 1.05, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 0.34, ease: 'easeOut' }}
            className={
              liked
                ? 'liked player-action like-button'
                : 'player-action like-button'
            }
            onClick={() =>
              void toggleFavorite()
            }
            aria-label={
              liked
                ? 'Unlike'
                : 'Like'
            }
            title={
              liked
                ? 'Unlike'
                : 'Like'
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
          </motion.button>


          <div className="volume-control">

            <button
              className="volume-button"
              onClick={toggleMute}
              aria-label={
                muted || volume === 0
                  ? 'Unmute'
                  : 'Mute'
              }
              title={
                muted || volume === 0
                  ? 'Unmute'
                  : 'Mute'
              }
            >
              {muted || volume === 0 ? (
                <VolumeX size={17} />
              ) : (
                <Volume2 size={17} />
              )}
            </button>


            <div className="volume-slider-wrap">

              <input
                className="volume-slider"
                type="range"
                min="0"
                max="100"
                value={
                  muted
                    ? 0
                    : volume
                }
                style={
                  {
                    '--volume-fill':
                      `${muted ? 0 : volume}%`,
                  } as CSSProperties
                }
                onChange={handleVolume}
                aria-label="Volume"
              />

              <span className="volume-value">
                {muted ? 0 : volume}
              </span>

            </div>

          </div>

        </div>

      </footer>

      <LikeHeartBurst
        trigger={likeBurst}
        direction={likeBurstDirection}
        sourceRef={likeButtonRef}
        destinationRef={currentArtworkRef}
      />


      {/* ================================================================== */}
      {/* CREATE PLAYLIST                                                    */}
      {/* ================================================================== */}

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
            onPointerDown={() =>
              setPlaylistDialog(
                false,
              )
            }
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
              onPointerDown={(
                event,
              ) =>
                event.stopPropagation()
              }
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


      {/* ================================================================== */}
      {/* ADD TO PLAYLIST                                                    */}
      {/* ================================================================== */}

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
            onPointerDown={() =>
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
              onPointerDown={(
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