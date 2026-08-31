import type { Track } from './types'
import { getStreamUrl } from './music'

type AudioState = {
  track: Track | null
  playing: boolean
  loading: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  error: string | null
}

type Listener = (state: AudioState) => void

class AudioEngine {
  private readonly audio: HTMLAudioElement
  private readonly listeners = new Set<Listener>()
  private objectUrl: string | null = null
  private queue: Track[] = []
  private loadToken = 0

  private state: AudioState = {
    track: null,
    playing: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    volume: this.loadVolume(),
    muted: this.loadMuted(),
    error: null,
  }

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'metadata'
    this.audio.volume = this.state.volume
    this.audio.muted = this.state.muted

    this.audio.addEventListener('loadstart', () => {
      this.update({ loading: true, error: null })
    })

    this.audio.addEventListener('loadedmetadata', () => {
      this.update({
        loading: false,
        duration: Number.isFinite(this.audio.duration)
          ? this.audio.duration
          : this.state.track?.duration || 0,
      })
    })

    this.audio.addEventListener('timeupdate', () => {
      this.update({ currentTime: this.audio.currentTime || 0 })
    })

    this.audio.addEventListener('durationchange', () => {
      if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        this.update({ duration: this.audio.duration })
      }
    })

    this.audio.addEventListener('play', () => {
      this.update({ playing: true, loading: false })
    })

    this.audio.addEventListener('pause', () => {
      this.update({ playing: false })
    })

    this.audio.addEventListener('waiting', () => {
      this.update({ loading: true })
    })

    this.audio.addEventListener('canplay', () => {
      this.update({ loading: false })
    })

    this.audio.addEventListener('playing', () => {
      this.update({ playing: true, loading: false })
    })

    this.audio.addEventListener('ended', () => {
      void this.next()
    })

    this.audio.addEventListener('error', () => {
      const mediaError = this.audio.error
      const message = mediaError?.message || 'Unable to play this track.'

      this.update({
        playing: false,
        loading: false,
        error: message,
      })
    })
  }

  private loadVolume(): number {
    if (typeof window === 'undefined') return 0.72

    const value = Number(localStorage.getItem('music-galaxy-volume'))
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.72
  }

  private loadMuted(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('music-galaxy-muted') === 'true'
  }

  private update(patch: Partial<AudioState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener(this.state))
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    listener(this.state)
    return () => {this.listeners.delete(listener)
    }
  }

  getState() {
    return this.state
  }

  getElement() {
    return this.audio
  }

  setQueue(tracks: Track[]) {
    this.queue = [...tracks]
  }

  setTrack(track: Track | null) {
    if (this.state.track?.id === track?.id) return

    this.loadToken += 1
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()

    this.update({
      track,
      playing: false,
      loading: false,
      currentTime: 0,
      duration: track?.duration || 0,
      error: null,
    })
  }

  async load(track: Track): Promise<boolean> {
    const token = ++this.loadToken

    try {
      this.audio.pause()

      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl)
        this.objectUrl = null
      }

      this.update({
        track,
        loading: true,
        playing: false,
        currentTime: 0,
        duration: track.duration || 0,
        error: null,
      })

      if (track.provider === 'demo') {
        throw new Error('This demo track has no playable audio.')
      }

      const url = await getStreamUrl(track)

      if (token !== this.loadToken) return false

      if (!url) {
        throw new Error('No playable stream available.')
      }

      this.audio.src = url
      this.audio.currentTime = 0
      this.audio.volume = this.state.volume
      this.audio.muted = this.state.muted
      this.audio.load()

      return true
    } catch (error) {
      if (token !== this.loadToken) return false

      console.error('Audio loading failed:', error)
      this.update({
        loading: false,
        playing: false,
        error: error instanceof Error ? error.message : 'Unable to load track.',
      })
      return false
    }
  }

  async play(track?: Track): Promise<boolean> {
    const target = track ?? this.state.track
    if (!target || target.provider === 'demo') return false

    if (this.state.track?.id !== target.id || !this.audio.src) {
      const loaded = await this.load(target)
      if (!loaded) return false
    }

    try {
      await this.audio.play()
      return true
    } catch (error) {
      console.error('Audio playback failed:', error)
      this.update({
        playing: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Playback failed.',
      })
      return false
    }
  }

  pause() {
    this.audio.pause()
  }

  async toggle(track?: Track) {
    if (track && this.state.track?.id !== track.id) {
      return this.play(track)
    }

    if (this.audio.paused) {
      return this.play()
    }

    this.pause()
    return true
  }

  seek(seconds: number) {
    if (!Number.isFinite(seconds) || !this.audio.src) return

    const duration = this.audio.duration
    const max = Number.isFinite(duration) && duration > 0
      ? duration
      : Number.MAX_SAFE_INTEGER

    this.audio.currentTime = Math.min(Math.max(0, seconds), max)
    this.update({ currentTime: this.audio.currentTime })
  }

  async next() {
    if (!this.queue.length) return false

    const index = this.queue.findIndex((track) => track.id === this.state.track?.id)
    const nextIndex = index < 0 ? 0 : (index + 1) % this.queue.length
    return this.play(this.queue[nextIndex])
  }

  async previous() {
    if (!this.queue.length) return false

    const index = this.queue.findIndex((track) => track.id === this.state.track?.id)
    const previousIndex = index < 0
      ? 0
      : (index - 1 + this.queue.length) % this.queue.length

    return this.play(this.queue[previousIndex])
  }

  setVolume(value: number) {
    const volume = Math.min(1, Math.max(0, value))
    this.audio.volume = volume

    if (typeof window !== 'undefined') {
      localStorage.setItem('music-galaxy-volume', String(volume))
    }

    if (volume > 0 && this.audio.muted) {
      this.setMuted(false)
    }

    this.update({ volume })
  }

  setMuted(muted: boolean) {
    this.audio.muted = muted

    if (typeof window !== 'undefined') {
      localStorage.setItem('music-galaxy-muted', String(muted))
    }

    this.update({ muted })
  }

  toggleMute() {
    this.setMuted(!this.audio.muted)
  }

  stop() {
    this.audio.pause()
    this.audio.currentTime = 0
    this.update({ playing: false, currentTime: 0 })
  }

  destroy() {
    this.loadToken += 1
    this.audio.pause()
    this.audio.src = ''

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }

    this.listeners.clear()
  }
}

export const audioEngine = new AudioEngine()
