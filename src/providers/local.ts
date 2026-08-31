import type { Track } from '../lib/types'

export function importLocalAudio(files: File[]): Track[] {
  return files.filter(f => f.type.startsWith('audio/')).map((file, i) => ({
    id:`local:${crypto.randomUUID()}`, provider:'local', providerId:String(i), title:file.name.replace(/\.[^/.]+$/, ''),
    artist:'Local library', album:'Device', genre:'Local', mood:'Personal', color:'#f472b6',
    duration:0, durationLabel:'--:--', streamUrl:URL.createObjectURL(file), downloadable:false,
  }))
}
