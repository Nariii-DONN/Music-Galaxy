import type { Track } from './types'
import { getStreamUrl } from './music'
import { getLocalAudioUrl } from './libraryStore'

export type RepeatMode =
  | 'off'
  | 'all'
  | 'one'

export type FrequencyBands = {
  sub: number
  bass: number
  lowMid: number
  mid: number
  upperMid: number
  presence: number
  treble: number
  air: number
  overall: number
}

export type AudioState = {
  track: Track | null
  playing: boolean
  loading: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  error: string | null
}

type Listener = (
  state: AudioState,
) => void

type VisualizerListener = (
  bands: FrequencyBands,
) => void


class AudioEngine {
  private audio: HTMLAudioElement

  private listeners =
    new Set<Listener>()

  private visualizerListeners =
    new Set<VisualizerListener>()

  private queue: Track[] = []

  private objectUrl:
    | string
    | null = null

  private requestId = 0

  /* ---------------------------------------------------------------------- */
  /* WEB AUDIO                                                               */
  /* ---------------------------------------------------------------------- */

  private audioContext:
    | AudioContext
    | null = null

  private analyser:
    | AnalyserNode
    | null = null

  private mediaSource:
    | MediaElementAudioSourceNode
    | null = null

  private frequencyData:
    | Uint8Array<ArrayBuffer>
    | null = null

  private analyserEnabled =
    false

  private analyserTrackId:
    | string
    | null = null

  /* ---------------------------------------------------------------------- */
  /* SINGLE VISUALIZER SAMPLER                                              */
  /* ---------------------------------------------------------------------- */

  private visualizerFrame =
    0

  private lastVisualizerTime = 0

  private readonly visualizerInterval =
    1000 / 60

  private bands: FrequencyBands = {
    sub: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    upperMid: 0,
    presence: 0,
    treble: 0,
    air: 0,
    overall: 0,
  }

  private fallbackBands: FrequencyBands =
    {
      sub: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      upperMid: 0,
      presence: 0,
      treble: 0,
      air: 0,
      overall: 0,
    }

  /* ---------------------------------------------------------------------- */
  /* AUDIO STATE                                                              */
  /* ---------------------------------------------------------------------- */

  private state: AudioState = {
    track: null,
    playing: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    volume: this.loadVolume(),
    muted: this.loadMuted(),
    shuffle: this.loadShuffle(),
    repeat: this.loadRepeat(),
    error: null,
  }

  constructor() {
    this.audio =
      this.createAudioElement()

    this.bindAudioEvents(
      this.audio,
    )

    this.startVisualizerLoop()
  }

  /* ---------------------------------------------------------------------- */
  /* AUDIO ELEMENT                                                           */
  /* ---------------------------------------------------------------------- */

  private createAudioElement() {
    const element =
      new Audio()

    element.preload =
      'metadata'

    element.crossOrigin =
      'anonymous'

    element.volume =
      this.state.volume

    element.muted =
      this.state.muted

    return element
  }

  private bindAudioEvents(
    element: HTMLAudioElement,
  ) {
    element.addEventListener(
      'loadstart',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        this.update({
          loading: true,
          error: null,
        })
      },
    )

    element.addEventListener(
      'loadedmetadata',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        this.update({
          loading: false,
          duration:
            Number.isFinite(
              element.duration,
            )
              ? element.duration
              : this.state.track
                    ?.duration ||
                0,
        })
      },
    )

    element.addEventListener(
      'durationchange',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        if (
          Number.isFinite(
            element.duration,
          ) &&
          element.duration > 0
        ) {
          this.update({
            duration:
              element.duration,
          })
        }
      },
    )

    element.addEventListener(
      'timeupdate',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        this.update({
          currentTime:
            Number.isFinite(
              element.currentTime,
            )
              ? element.currentTime
              : 0,
        })
      },
    )

    element.addEventListener(
      'play',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        this.update({
          playing: true,
          loading: false,
          error: null,
        })
      },
    )

    element.addEventListener(
      'playing',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        this.update({
          playing: true,
          loading: false,
          error: null,
        })
      },
    )

    element.addEventListener(
      'pause',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        this.update({
          playing: false,
        })
      },
    )

    element.addEventListener(
      'waiting',
      () => {
        if (
          element !==
            this.audio ||
          element.paused
        ) {
          return
        }

        this.update({
          loading: true,
        })
      },
    )

    element.addEventListener(
      'canplay',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        this.update({
          loading: false,
        })
      },
    )

    element.addEventListener(
      'ended',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        void this.handleEnded()
      },
    )

    element.addEventListener(
      'error',
      () => {
        if (
          element !==
          this.audio
        ) {
          return
        }

        this.update({
          playing: false,
          loading: false,
          error:
            'Unable to play this track.',
        })
      },
    )
  }

  /* ---------------------------------------------------------------------- */
  /* STATE                                                                   */
  /* ---------------------------------------------------------------------- */

  private update(
    patch: Partial<AudioState>,
  ) {
    this.state = {
      ...this.state,
      ...patch,
    }

    this.listeners.forEach(
      (listener) => {
        listener(
          this.state,
        )
      },
    )
  }

  subscribe(
    listener: Listener,
  ) {
    this.listeners.add(
      listener,
    )

    listener(this.state)

    return () => {
      this.listeners.delete(
        listener,
      )
    }
  }

  subscribeVisualizer(
    listener: VisualizerListener,
  ) {
    this.visualizerListeners.add(
      listener,
    )

    listener(this.bands)

    return () => {
      this.visualizerListeners.delete(
        listener,
      )
    }
  }

  getState() {
    return this.state
  }

  getElement() {
    return this.audio
  }

  setQueue(
    tracks: Track[],
  ) {
    this.queue = [
      ...tracks,
    ]
  }

  getQueue() {
    return [
      ...this.queue,
    ]
  }

  /* ---------------------------------------------------------------------- */
  /* STORAGE                                                                 */
  /* ---------------------------------------------------------------------- */

  private loadVolume() {
    const value =
      Number(
        localStorage.getItem(
          'music-galaxy-volume',
        ),
      )

    if (
      !Number.isFinite(
        value,
      )
    ) {
      return 0.72
    }

    return Math.min(
      1,
      Math.max(
        0,
        value,
      ),
    )
  }

  private loadMuted() {
    return (
      localStorage.getItem(
        'music-galaxy-muted',
      ) === 'true'
    )
  }

  private loadShuffle() {
    return (
      localStorage.getItem(
        'music-galaxy-shuffle',
      ) === 'true'
    )
  }

  private loadRepeat(): RepeatMode {
    const value =
      localStorage.getItem(
        'music-galaxy-repeat',
      )

    if (
      value === 'all' ||
      value === 'one'
    ) {
      return value
    }

    return 'off'
  }

  /* ---------------------------------------------------------------------- */
  /* WEB AUDIO SETUP                                                         */
  /* ---------------------------------------------------------------------- */

  private destroyAnalyser() {
    this.analyserEnabled =
      false

    this.analyserTrackId =
      null

    try {
      this.mediaSource?.disconnect()
    } catch {
      // Ignore.
    }

    try {
      this.analyser?.disconnect()
    } catch {
      // Ignore.
    }

    try {
      if (
        this.audioContext &&
        this.audioContext.state !==
          'closed'
      ) {
        void this.audioContext.close()
      }
    } catch {
      // Ignore.
    }

    this.audioContext =
      null

    this.mediaSource =
      null

    this.analyser =
      null

    this.frequencyData =
      null

    this.resetBands()
  }

  private resetBands() {
    this.bands = {
      sub: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      upperMid: 0,
      presence: 0,
      treble: 0,
      air: 0,
      overall: 0,
    }
  }

  private async ensureAnalyser(
    trackId: string,
  ) {
    if (
      this.analyserEnabled &&
      this.analyserTrackId ===
        trackId
    ) {
      if (
        this.audioContext?.state ===
        'suspended'
      ) {
        try {
          await this.audioContext.resume()
        } catch {
          // Ignore.
        }
      }

      return true
    }

    try {
      const Constructor =
        window.AudioContext ||
        (
          window as Window & {
            webkitAudioContext?: typeof AudioContext
          }
        ).webkitAudioContext

      if (!Constructor) {
        return false
      }

      this.audioContext =
        new Constructor()

      this.analyser =
        this.audioContext.createAnalyser()

      /*
       * 2048 gives good low-frequency
       * resolution while remaining smooth.
       */
      this.analyser.fftSize =
        2048

      this.analyser.smoothingTimeConstant =
        0.84

      this.analyser.minDecibels =
        -90

      this.analyser.maxDecibels =
        -10

      this.mediaSource =
        this.audioContext.createMediaElementSource(
          this.audio,
        )

      this.mediaSource.connect(
        this.analyser,
      )

      this.analyser.connect(
        this.audioContext.destination,
      )

      this.frequencyData =
        new Uint8Array(
          this.analyser.frequencyBinCount,
        )

      this.analyserEnabled =
        true

      this.analyserTrackId =
        trackId

      if (
        this.audioContext.state ===
        'suspended'
      ) {
        try {
          await this.audioContext.resume()
        } catch {
          // Ignore.
        }
      }

      return true
    } catch (error) {
      console.warn(
        'Web Audio analyser unavailable:',
        error,
      )

      this.destroyAnalyser()

      return false
    }
  }

  /* ---------------------------------------------------------------------- */
  /* FREQUENCY MAPPING                                                       */
  /* ---------------------------------------------------------------------- */

  private frequencyToIndex(
    frequency: number,
  ) {
    if (
      !this.audioContext ||
      !this.analyser
    ) {
      return 0
    }

    const nyquist =
      this.audioContext.sampleRate /
      2

    const index =
      Math.round(
        (
          frequency /
          nyquist
        ) *
        this.analyser.frequencyBinCount,
      )

    return Math.max(
      0,
      Math.min(
        this.analyser.frequencyBinCount -
          1,
        index,
      ),
    )
  }

  private averageRange(
    startHz: number,
    endHz: number,
  ) {
    if (
      !this.frequencyData ||
      !this.audioContext ||
      !this.analyser
    ) {
      return 0
    }

    const start =
      this.frequencyToIndex(
        startHz,
      )

    const end =
      Math.max(
        start + 1,
        this.frequencyToIndex(
          endHz,
        ),
      )

    let sum = 0
    let count = 0

    for (
      let index = start;
      index <= end &&
      index <
        this.frequencyData.length;
      index += 1
    ) {
      const value =
        this.frequencyData[
          index
        ] / 255

      /*
       * Square amplitude so meaningful
       * musical energy is emphasized.
       */
      sum +=
        value * value

      count += 1
    }

    if (
      count === 0
    ) {
      return 0
    }

    return Math.min(
      1,
      Math.sqrt(
        sum / count,
      ) * 1.6,
    )
  }

  private smoothValue(
    current: number,
    target: number,
    attack: number,
    release: number,
  ) {
    const amount =
      target > current
        ? attack
        : release

    return (
      current +
      (
        target -
        current
      ) *
        amount
    )
  }

  /* ---------------------------------------------------------------------- */
  /* SINGLE VISUALIZER LOOP                                                  */
  /* ---------------------------------------------------------------------- */

  private startVisualizerLoop() {
    const sample =
      (time: number) => {
        if (
          time -
            this.lastVisualizerTime >=
          this.visualizerInterval
        ) {
          this.lastVisualizerTime =
            time

          this.sampleVisualizer()
        }

        this.visualizerFrame =
          requestAnimationFrame(
            sample,
          )
      }

    this.visualizerFrame =
      requestAnimationFrame(
        sample,
      )
  }

  private sampleVisualizer() {
    if (
      !this.state.playing
    ) {
      this.updateFallbackIdle()

      return
    }

    if (
      this.analyserEnabled &&
      this.frequencyData &&
      this.analyser
    ) {
      try {
        this.analyser.getByteFrequencyData(
          this.frequencyData,
        )

        this.sampleRealBands()

        return
      } catch {
        // Fall through to BPM fallback.
      }
    }

    this.sampleFallbackBands()
  }

  /* ---------------------------------------------------------------------- */
  /* REAL FREQUENCY BANDS                                                    */
  /* ---------------------------------------------------------------------- */

  private sampleRealBands() {
    const targets: FrequencyBands =
      {
        /*
         * Deep/sub bass
         */
        sub:
          this.averageRange(
            20,
            60,
          ),

        /*
         * Bass
         */
        bass:
          this.averageRange(
            60,
            120,
          ),

        /*
         * Low mids
         */
        lowMid:
          this.averageRange(
            120,
            250,
          ),

        /*
         * Main mids
         */
        mid:
          this.averageRange(
            250,
            500,
          ),

        /*
         * Upper mids
         */
        upperMid:
          this.averageRange(
            500,
            2000,
          ),

        /*
         * Presence
         */
        presence:
          this.averageRange(
            2000,
            6000,
          ),

        /*
         * Treble
         */
        treble:
          this.averageRange(
            6000,
            12000,
          ),

        /*
         * Air
         */
        air:
          this.averageRange(
            12000,
            20000,
          ),

        /*
         * Complete spectrum
         */
        overall:
          this.averageRange(
            20,
            20000,
          ),
      }

    /*
     * Every band gets its own attack
     * and release characteristics.
     *
     * This is what prevents every
     * frequency from behaving identically.
     */
    this.bands.sub =
      this.smoothValue(
        this.bands.sub,
        targets.sub,
        0.36,
        0.11,
      )

    this.bands.bass =
      this.smoothValue(
        this.bands.bass,
        targets.bass,
        0.32,
        0.12,
      )

    this.bands.lowMid =
      this.smoothValue(
        this.bands.lowMid,
        targets.lowMid,
        0.27,
        0.14,
      )

    this.bands.mid =
      this.smoothValue(
        this.bands.mid,
        targets.mid,
        0.23,
        0.15,
      )

    this.bands.upperMid =
      this.smoothValue(
        this.bands.upperMid,
        targets.upperMid,
        0.21,
        0.16,
      )

    this.bands.presence =
      this.smoothValue(
        this.bands.presence,
        targets.presence,
        0.22,
        0.17,
      )

    this.bands.treble =
      this.smoothValue(
        this.bands.treble,
        targets.treble,
        0.24,
        0.18,
      )

    this.bands.air =
      this.smoothValue(
        this.bands.air,
        targets.air,
        0.17,
        0.21,
      )

    this.bands.overall =
      this.smoothValue(
        this.bands.overall,
        targets.overall,
        0.22,
        0.14,
      )

    this.emitVisualizer()
  }

  /* ---------------------------------------------------------------------- */
  /* REMOTE PROVIDER FALLBACK                                               */
  /* ---------------------------------------------------------------------- */

  private sampleFallbackBands() {
    const track =
      this.state.track

    const bpm =
      Number.isFinite(
        track?.bpm,
      ) &&
      (track?.bpm ?? 0) > 0
        ? track!.bpm!
        : 100

    const beatDuration =
      60 / bpm

    const beatPosition =
      this.state.currentTime /
      beatDuration

    const phase =
      beatPosition -
      Math.floor(
        beatPosition,
      )

    /*
     * Main kick envelope.
     */
    const beat =
      Math.pow(
        Math.max(
          0,
          1 - phase,
        ),
        4,
      )

    /*
     * Slower rhythmic movement.
     */
    const half =
      (
        1 +
        Math.sin(
          beatPosition *
            Math.PI *
            2 +
            Math.PI,
        )
      ) /
      2

    /*
     * Faster rhythm.
     */
    const quarter =
      (
        1 +
        Math.sin(
          beatPosition *
            Math.PI *
            4,
        )
      ) /
      2

    /*
     * Very fast high-frequency movement.
     */
    const eighth =
      (
        1 +
        Math.sin(
          beatPosition *
            Math.PI *
            8,
        )
      ) /
      2

    const targets: FrequencyBands =
      {
        sub:
          0.08 +
          beat * 0.82,

        bass:
          0.1 +
          beat * 0.66,

        lowMid:
          0.08 +
          half * 0.38,

        mid:
          0.07 +
          half * 0.3,

        upperMid:
          0.06 +
          quarter * 0.26,

        presence:
          0.05 +
          quarter * 0.2,

        treble:
          0.045 +
          eighth * 0.2,

        air:
          0.025 +
          eighth * 0.14,

        overall:
          0.08 +
          beat * 0.42,
      }

    this.bands.sub =
      this.smoothValue(
        this.bands.sub,
        targets.sub,
        0.2,
        0.08,
      )

    this.bands.bass =
      this.smoothValue(
        this.bands.bass,
        targets.bass,
        0.19,
        0.09,
      )

    this.bands.lowMid =
      this.smoothValue(
        this.bands.lowMid,
        targets.lowMid,
        0.17,
        0.09,
      )

    this.bands.mid =
      this.smoothValue(
        this.bands.mid,
        targets.mid,
        0.16,
        0.1,
      )

    this.bands.upperMid =
      this.smoothValue(
        this.bands.upperMid,
        targets.upperMid,
        0.18,
        0.1,
      )

    this.bands.presence =
      this.smoothValue(
        this.bands.presence,
        targets.presence,
        0.18,
        0.11,
      )

    this.bands.treble =
      this.smoothValue(
        this.bands.treble,
        targets.treble,
        0.2,
        0.12,
      )

    this.bands.air =
      this.smoothValue(
        this.bands.air,
        targets.air,
        0.14,
        0.12,
      )

    this.bands.overall =
      this.smoothValue(
        this.bands.overall,
        targets.overall,
        0.18,
        0.09,
      )

    this.emitVisualizer()
  }

  private updateFallbackIdle() {
    const idleTarget =
      0

    const keys =
      Object.keys(
        this.bands,
      ) as Array<
        keyof FrequencyBands
      >

    for (
      const key of keys
    ) {
      this.bands[key] =
        this.smoothValue(
          this.bands[key],
          idleTarget,
          0.08,
          0.04,
        )
    }

    this.emitVisualizer()
  }

  private emitVisualizer() {
    const snapshot = {
      ...this.bands,
    }

    this.visualizerListeners.forEach(
      (listener) => {
        listener(snapshot)
      },
    )
  }

  /* ---------------------------------------------------------------------- */
  /* PUBLIC VISUALIZER API                                                   */
  /* ---------------------------------------------------------------------- */

  getFrequencyBands():
    FrequencyBands {
    return {
      ...this.bands,
    }
  }

  getFrequencyData():
    Uint8Array {
    if (
      !this.frequencyData ||
      !this.analyserEnabled ||
      !this.analyser
    ) {
      return new Uint8Array(
        0,
      )
    }

    try {
      this.analyser.getByteFrequencyData(
        this.frequencyData,
      )

      return this.frequencyData
    } catch {
      return new Uint8Array(
        0,
      )
    }
  }

  getTimeDomainData():
    Uint8Array {
    if (
      !this.analyserEnabled ||
      !this.analyser
    ) {
      return new Uint8Array(
        0,
      )
    }

    const data =
      new Uint8Array(
        this.analyser.fftSize,
      )

    try {
      this.analyser.getByteTimeDomainData(
        data,
      )

      return data
    } catch {
      return new Uint8Array(
        0,
      )
    }
  }

  getAudioLevel() {
    return this.bands.overall
  }

  getLowFrequencyLevel() {
    return Math.min(
      1,
      this.bands.sub *
        0.7 +
        this.bands.bass *
          0.3,
    )
  }

  getVisualizerSnapshot() {
    return {
      level:
        this.bands.overall,

      bass:
        this.bands.bass,

      mid:
        (
          this.bands.mid +
          this.bands.upperMid
        ) *
        0.5,

      treble:
        (
          this.bands.treble +
          this.bands.air
        ) *
        0.5,
    }
  }

  /* ---------------------------------------------------------------------- */
  /* LOAD                                                                     */
  /* ---------------------------------------------------------------------- */

  private replaceAudioElement() {
    const previous =
      this.audio

    try {
      previous.pause()
    } catch {
      // Ignore.
    }

    previous.removeAttribute(
      'src',
    )

    previous.load()

    this.destroyAnalyser()

    this.audio =
      this.createAudioElement()

    this.bindAudioEvents(
      this.audio,
    )
  }

  async load(
    track: Track,
  ) {
    const request =
      ++this.requestId

    try {
      const previousIsLocal =
        this.state.track
          ?.provider ===
        'local'

      const nextIsLocal =
        track.provider ===
        'local'

      if (
        previousIsLocal !==
        nextIsLocal
      ) {
        this.replaceAudioElement()
      } else {
        this.audio.pause()

        this.audio.removeAttribute(
          'src',
        )

        this.audio.load()

        this.destroyAnalyser()
      }

      if (
        this.objectUrl
      ) {
        URL.revokeObjectURL(
          this.objectUrl,
        )

        this.objectUrl =
          null
      }

      this.update({
        track,
        playing: false,
        loading: true,
        currentTime: 0,
        duration:
          track.duration ||
          0,
        error: null,
      })

      const url =
        track.provider ===
        'local'
          ? await getLocalAudioUrl(
              track,
            )
          : await getStreamUrl(
              track,
            )

      if (
        request !==
        this.requestId
      ) {
        return false
      }

      if (!url) {
        throw new Error(
          'No playable stream available.',
        )
      }

      if (
        track.provider ===
        'local'
      ) {
        this.objectUrl =
          url
      }

      this.audio.src =
        url

      this.audio.currentTime =
        0

      this.audio.volume =
        this.state.volume

      this.audio.muted =
        this.state.muted

      this.audio.load()

      return true
    } catch (error) {
      if (
        request !==
        this.requestId
      ) {
        return false
      }

      console.error(
        'Audio loading failed:',
        error,
      )

      this.update({
        playing: false,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load track.',
      })

      return false
    }
  }

  /* ---------------------------------------------------------------------- */
  /* PLAY                                                                     */
  /* ---------------------------------------------------------------------- */

  async play(
    track?: Track,
  ) {
    const target =
      track ??
      this.state.track

    if (!target) {
      return false
    }

    if (
      target.provider ===
      'demo'
    ) {
      this.update({
        playing: false,
        loading: false,
        error:
          'The demo track has no playable audio.',
      })

      return false
    }

    if (
      this.state.track?.id !==
        target.id ||
      !this.audio.src
    ) {
      const loaded =
        await this.load(
          target,
        )

      if (!loaded) {
        return false
      }
    }

    try {
      /*
       * Local audio:
       * enable real analyser.
       */
      if (
        target.provider ===
        'local'
      ) {
        await this.ensureAnalyser(
          target.id,
        )
      }

      /*
       * Remote audio:
       * no analyser connection.
       * Native playback remains untouched.
       */
      await this.audio.play()

      return true
    } catch (error) {
      console.error(
        'Playback failed:',
        error,
      )

      this.update({
        playing: false,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Playback failed.',
      })

      return false
    }
  }

  /* ---------------------------------------------------------------------- */
  /* PLAYBACK                                                                 */
  /* ---------------------------------------------------------------------- */

  pause() {
    this.audio.pause()
  }

  async toggle(
    track?: Track,
  ) {
    if (
      track &&
      this.state.track?.id !==
        track.id
    ) {
      return this.play(
        track,
      )
    }

    if (
      this.audio.paused
    ) {
      return this.play()
    }

    this.pause()

    return true
  }

  /* ---------------------------------------------------------------------- */
  /* SEEK                                                                     */
  /* ---------------------------------------------------------------------- */

  seek(
    seconds: number,
  ) {
    if (
      !Number.isFinite(
        seconds,
      )
    ) {
      return
    }

    const duration =
      Number.isFinite(
        this.audio.duration,
      ) &&
      this.audio.duration > 0
        ? this.audio.duration
        : this.state.duration

    const target =
      duration > 0
        ? Math.min(
            Math.max(
              0,
              seconds,
            ),
            duration,
          )
        : Math.max(
            0,
            seconds,
          )

    try {
      this.audio.currentTime =
        target

      this.update({
        currentTime:
          target,
      })
    } catch {
      // Ignore.
    }
  }

  restart() {
    this.seek(0)
  }

  /* ---------------------------------------------------------------------- */
  /* VOLUME                                                                   */
  /* ---------------------------------------------------------------------- */

  setVolume(
    value: number,
  ) {
    const volume =
      Math.min(
        1,
        Math.max(
          0,
          value,
        ),
      )

    this.audio.volume =
      volume

    localStorage.setItem(
      'music-galaxy-volume',
      String(volume),
    )

    if (
      volume > 0 &&
      this.audio.muted
    ) {
      this.audio.muted =
        false

      localStorage.setItem(
        'music-galaxy-muted',
        'false',
      )

      this.update({
        volume,
        muted: false,
      })

      return
    }

    this.update({
      volume,
    })
  }

  setMuted(
    muted: boolean,
  ) {
    this.audio.muted =
      muted

    localStorage.setItem(
      'music-galaxy-muted',
      String(muted),
    )

    this.update({
      muted,
    })
  }

  toggleMute() {
    this.setMuted(
      !this.audio.muted,
    )
  }

  /* ---------------------------------------------------------------------- */
  /* SHUFFLE                                                                  */
  /* ---------------------------------------------------------------------- */

  setShuffle(
    enabled: boolean,
  ) {
    localStorage.setItem(
      'music-galaxy-shuffle',
      String(enabled),
    )

    this.update({
      shuffle: enabled,
    })
  }

  toggleShuffle() {
    this.setShuffle(
      !this.state.shuffle,
    )
  }

  /* ---------------------------------------------------------------------- */
  /* REPEAT                                                                   */
  /* ---------------------------------------------------------------------- */

  setRepeat(
    mode: RepeatMode,
  ) {
    localStorage.setItem(
      'music-galaxy-repeat',
      mode,
    )

    this.update({
      repeat: mode,
    })
  }

  cycleRepeat() {
    const next: RepeatMode =
      this.state.repeat ===
      'off'
        ? 'all'
        : this.state.repeat ===
            'all'
          ? 'one'
          : 'off'

    this.setRepeat(
      next,
    )
  }

  /* ---------------------------------------------------------------------- */
  /* QUEUE                                                                    */
  /* ---------------------------------------------------------------------- */

  private currentIndex() {
    if (
      !this.state.track
    ) {
      return -1
    }

    return this.queue.findIndex(
      (track) =>
        track.id ===
        this.state.track?.id,
    )
  }

  private findRandomTrack() {
    if (
      this.queue.length <=
      1
    ) {
      return (
        this.queue[0] ??
        null
      )
    }

    const candidates =
      this.queue.filter(
        (track) =>
          track.id !==
          this.state.track?.id,
      )

    if (
      !candidates.length
    ) {
      return null
    }

    return candidates[
      Math.floor(
        Math.random() *
          candidates.length,
      )
    ]
  }

  private findNextTrack() {
    if (
      !this.queue.length
    ) {
      return null
    }

    if (
      this.state.shuffle
    ) {
      const random =
        this.findRandomTrack()

      if (random) {
        return random
      }
    }

    const index =
      this.currentIndex()

    if (
      index < 0
    ) {
      return (
        this.queue[0] ??
        null
      )
    }

    const nextIndex =
      index + 1

    if (
      nextIndex <
      this.queue.length
    ) {
      return this.queue[
        nextIndex
      ]
    }

    if (
      this.state.repeat ===
      'all'
    ) {
      return (
        this.queue[0] ??
        null
      )
    }

    return null
  }

  private findPreviousTrack() {
    if (
      !this.queue.length
    ) {
      return null
    }

    const index =
      this.currentIndex()

    if (
      index < 0
    ) {
      return (
        this.queue[0] ??
        null
      )
    }

    if (
      index > 0
    ) {
      return this.queue[
        index - 1
      ]
    }

    if (
      this.state.repeat ===
      'all'
    ) {
      return (
        this.queue[
          this.queue.length -
            1
        ] ?? null
      )
    }

    return null
  }

  private async handleEnded() {
    if (
      !this.state.track
    ) {
      return
    }

    if (
      this.state.repeat ===
      'one'
    ) {
      this.audio.currentTime =
        0

      try {
        await this.audio.play()
      } catch {
        this.update({
          playing: false,
        })
      }

      return
    }

    const next =
      this.findNextTrack()

    if (!next) {
      this.update({
        playing: false,
        currentTime:
          this.state.duration,
      })

      return
    }

    await this.play(
      next,
    )
  }

  async next() {
    const next =
      this.findNextTrack()

    if (!next) {
      this.restart()
      return false
    }

    return this.play(
      next,
    )
  }

  async previous() {
    if (
      this.audio.currentTime >
      3
    ) {
      this.restart()
      return true
    }

    const previous =
      this.findPreviousTrack()

    if (!previous) {
      this.restart()
      return false
    }

    return this.play(
      previous,
    )
  }

  /* ---------------------------------------------------------------------- */
  /* CLEANUP                                                                  */
  /* ---------------------------------------------------------------------- */

  stop() {
    this.audio.pause()

    try {
      this.audio.currentTime =
        0
    } catch {
      // Ignore.
    }

    this.update({
      playing: false,
      currentTime: 0,
    })
  }

  clear() {
    ++this.requestId

    this.audio.pause()

    this.audio.removeAttribute(
      'src',
    )

    this.audio.load()

    if (
      this.objectUrl
    ) {
      URL.revokeObjectURL(
        this.objectUrl,
      )

      this.objectUrl =
        null
    }

    this.destroyAnalyser()

    this.update({
      track: null,
      playing: false,
      loading: false,
      currentTime: 0,
      duration: 0,
      error: null,
    })
  }

  destroy() {
    if (
      this.visualizerFrame
    ) {
      cancelAnimationFrame(
        this.visualizerFrame,
      )
    }

    this.clear()

    this.listeners.clear()

    this.visualizerListeners.clear()
  }
}

export const audioEngine =
  new AudioEngine()