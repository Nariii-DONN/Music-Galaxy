export type Track = {
  id: string
  provider: string
  providerId: string
  title: string
  artist: string
  album: string
  genre: string
  mood: string
  color: string
  duration: number
  durationLabel: string
  artworkUrl?: string
  streamUrl?: string
  permalink?: string
  license?: string
  downloadable?: boolean
  tags?: string[]
  bpm?: number
}

export type MusicProvider = {
  id: string
  name: string
  search(query: string): Promise<Track[]>
  trending(): Promise<Track[]>
  stream(track: Track): Promise<string | null>
}
