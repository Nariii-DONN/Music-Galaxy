import type { Track } from '../lib/types'

export interface MusicProvider {
  id: string
  name: string

  search(query: string): Promise<Track[]>

  trending(): Promise<Track[]>

  getStreamUrl(track: Track): Promise<string | null>
}