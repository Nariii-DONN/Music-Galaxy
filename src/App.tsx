import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Float, Sparkles } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Compass, Disc3, Heart, Home, Library, ListMusic, Menu, Pause,
  Play, Plus, Radio, Search, Settings, Share2, SkipBack, SkipForward,
  SlidersHorizontal, Sparkles as SparkleIcon, Volume2, VolumeX, X, Upload,
  Globe2, UserRound, ChevronDown, Maximize2, Shuffle, Repeat2, MoreHorizontal
} from 'lucide-react'
import * as THREE from 'three'

type Track = {
  id: string; title: string; artist: string; album: string; genre: string
  mood: string; color: string; bpm: number; duration: string
}

const tracks: Track[] = [
  { id:'1', title:'Neon Horizon', artist:'Astra Nova', album:'Afterglow', genre:'Electronic', mood:'Night', color:'#7c3aed', bpm:124, duration:'3:42' },
  { id:'2', title:'Starlight Drive', artist:'Kairo', album:'Velocity', genre:'Synthwave', mood:'Energetic', color:'#06b6d4', bpm:118, duration:'4:08' },
  { id:'3', title:'Moonlit Ocean', artist:'Luna Vale', album:'Tides', genre:'Ambient', mood:'Calm', color:'#38bdf8', bpm:72, duration:'5:11' },
  { id:'4', title:'Gravity Hearts', artist:'Vanta', album:'Orbit', genre:'Pop', mood:'Happy', color:'#f472b6', bpm:110, duration:'3:36' },
  { id:'5', title:'Solar Flare', artist:'Nox', album:'Eclipse', genre:'Drum & Bass', mood:'Energy', color:'#f97316', bpm:174, duration:'3:19' },
  { id:'6', title:'Velvet Rain', artist:'Mira', album:'Cloud Nine', genre:'Lo-fi', mood:'Focus', color:'#a78bfa', bpm:84, duration:'2:58' },
  { id:'7', title:'Aurora Memory', artist:'Northline', album:'Polar', genre:'Cinematic', mood:'Dream', color:'#22d3ee', bpm:92, duration:'4:51' },
  { id:'8', title:'Black Hole', artist:'VOID', album:'Singularity', genre:'Techno', mood:'Dark', color:'#ef4444', bpm:138, duration:'5:02' },
]

const nav = [
  ['Galaxy', Home], ['Explore', Compass], ['Library', Library], ['Playlists', ListMusic]
] as const

function CameraRig({ pulse }: { pulse: number }) {
  const { camera } = useThree()
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    camera.position.x += (Math.sin(t * 0.08) * 0.7 - camera.position.x) * 0.006
    camera.position.y += (Math.cos(t * 0.07) * 0.4 + 1.5 - camera.position.y) * 0.006
    camera.lookAt(0, 0, 0)
    if (pulse > 0) camera.position.z = 12 + Math.sin(t * 18) * pulse * 0.15
  })
  return null
}

function Galaxy({ active, pulse, onSelect }: { active: Track; pulse: number; onSelect: (t:Track)=>void }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (group.current) group.current.rotation.y = t * 0.025
  })
  const positions = useMemo(() => tracks.map((_, i) => {
    const a = (i / tracks.length) * Math.PI * 2
    const r = 2.2 + (i % 3) * 0.8
    return [Math.cos(a)*r, Math.sin(a*2)*0.65, Math.sin(a)*r] as [number,number,number]
  }), [])
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0,0,0]} intensity={20} distance={20} color={active.color} />
      <Stars radius={70} depth={35} count={2600} factor={2.4} saturation={0} fade speed={0.35} />
      <Sparkles count={900} scale={[18,10,18]} size={1.6} speed={0.25} opacity={0.55} color={active.color} />
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[0.65, 48, 48]} />
          <meshStandardMaterial emissive={active.color} emissiveIntensity={4} color="#080812" roughness={0.2} />
        </mesh>
        {tracks.map((track, i) => (
          <Float key={track.id} speed={1.1+i*.04} rotationIntensity={0.12} floatIntensity={0.35}>
            <mesh position={positions[i]} onClick={() => onSelect(track)}>
              <sphereGeometry args={[track.id === active.id ? 0.46 : 0.31 + (i%2)*0.07, 28, 28]} />
              <meshStandardMaterial color={track.color} emissive={track.color} emissiveIntensity={track.id === active.id ? 3.5 : 1.6} metalness={0.2} roughness={0.35} />
            </mesh>
          </Float>
        ))}
        <mesh rotation={[Math.PI/2,0,0]}>
          <ringGeometry args={[2.1,2.13,128]} />
          <meshBasicMaterial color={active.color} transparent opacity={0.22} />
        </mesh>
        <mesh rotation={[Math.PI/2,0.3,0]}>
          <ringGeometry args={[3.0,3.018,128]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.08} />
        </mesh>
      </group>
      <CameraRig pulse={pulse} />
      <OrbitControls enablePan={false} minDistance={7} maxDistance={18} autoRotate autoRotateSpeed={0.12} />
    </>
  )
}

function Visualizer({ playing, color }: { playing:boolean; color:string }) {
  const bars = Array.from({length:42})
  return <div className="visualizer" aria-hidden>
    {bars.map((_,i)=><span key={i} style={{'--i':i, '--c':color} as React.CSSProperties} className={playing?'bar active':'bar'} />)}
  </div>
}

export default function App() {
  const [active, setActive] = useState(tracks[0])
  const [playing, setPlaying] = useState(false)
  const [tab, setTab] = useState('Galaxy')
  const [query, setQuery] = useState('')
  const [liked, setLiked] = useState(false)
  const [volume, setVolume] = useState(72)
  const [muted, setMuted] = useState(false)
  const [menu, setMenu] = useState(false)
  const [showPlayer, setShowPlayer] = useState(false)
  const [pulse, setPulse] = useState(0)
  const audio = useRef<HTMLAudioElement | null>(null)

  const filtered = tracks.filter(t => `${t.title} ${t.artist} ${t.genre} ${t.album}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const timer = window.setInterval(() => setPulse(playing ? 0.7 : 0.05), 220)
    return () => clearInterval(timer)
  }, [playing])

  const choose = (track:Track) => {
    setActive(track); setPlaying(true); setShowPlayer(false)
  }

  const next = () => {
    const i = tracks.findIndex(t=>t.id===active.id)
    setActive(tracks[(i+1)%tracks.length]); setPlaying(true)
  }
  const prev = () => {
    const i = tracks.findIndex(t=>t.id===active.id)
    setActive(tracks[(i-1+tracks.length)%tracks.length]); setPlaying(true)
  }

  return (
    <div className="app">
      <aside className={menu?'sidebar open':'sidebar'}>
        <div className="brand"><div className="brand-orb"><SparkleIcon size={18}/></div><span>Music<span>Galaxy</span></span></div>
        <div className="profile-mini"><div className="avatar">N</div><div><b>Nariii</b><small>Explorer</small></div><ChevronDown size={14}/></div>
        <nav>
          {nav.map(([name,Icon])=><button className={tab===name?'nav-item active':'nav-item'} onClick={()=>{setTab(name);setMenu(false)}} key={name}><Icon size={18}/><span>{name}</span></button>)}
        </nav>
        <div className="side-title">DISCOVER</div>
        {['Trending','Night Drive','Focus','New Releases'].map(x=><button className="nav-item subtle" key={x}><Radio size={16}/><span>{x}</span></button>)}
        <div className="side-bottom"><button className="nav-item subtle"><Settings size={17}/><span>Settings</span></button><button className="nav-item subtle"><UserRound size={17}/><span>Profile</span></button></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={()=>setMenu(!menu)}><Menu/></button>
          <div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search songs, artists, albums..." />{query&&<button onClick={()=>setQuery('')}><X size={15}/></button>}</div>
          <div className="top-actions"><button className="icon-btn"><Globe2 size={18}/></button><button className="publish"><Plus size={17}/> Publish</button><div className="avatar">N</div></div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot"/> YOUR PERSONAL UNIVERSE</div>
            <h1>Music should be<br/><em>experienced.</em></h1>
            <p>Explore your music as a living galaxy. Fly between artists, albums and songs — every world moves with the sound.</p>
            <div className="hero-actions"><button className="primary" onClick={()=>setPlaying(!playing)}>{playing?<Pause size={17}/>:<Play size={17}/>} {playing?'Pause journey':'Enter your galaxy'}</button><button className="ghost"><Share2 size={16}/> Share galaxy</button></div>
          </div>
          <div className="stats"><div><b>248</b><span>SONGS</span></div><div><b>31</b><span>ARTISTS</span></div><div><b>18</b><span>GALAXIES</span></div></div>
        </section>

        <section className="galaxy-card">
          <div className="galaxy-toolbar"><div><b>YOUR GALAXY</b><span>Drag to explore · click a planet to play</span></div><div className="toolbar-actions"><button><SlidersHorizontal size={16}/> Visuals</button><button><Maximize2 size={16}/></button></div></div>
          <div className="canvas-wrap">
            <Canvas camera={{position:[0,1.5,12], fov:52}} dpr={[1,1.7]}>
              <color attach="background" args={['#03040d']} />
              <fog attach="fog" args={['#03040d', 8, 24]} />
              <Galaxy active={active} pulse={pulse} onSelect={choose}/>
            </Canvas>
            <div className="galaxy-label center"><span className="tiny-star"/> {active.genre.toUpperCase()} SECTOR</div>
            <div className="planet-tooltip"><div className="cover" style={{background:active.color}}><Disc3/></div><div><small>NOW PLAYING</small><b>{active.title}</b><span>{active.artist} · {active.album}</span></div><button onClick={()=>setLiked(!liked)} className={liked?'liked':''}><Heart size={17} fill={liked?'currentColor':'none'}/></button></div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {tab==='Galaxy' && (
            <motion.section key="galaxy" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} className="content-grid">
              <div className="panel">
                <div className="panel-head"><div><h2>Continue exploring</h2><p>Music from your universe</p></div><button>View all</button></div>
                <div className="track-list">{filtered.slice(0,5).map((t,i)=><motion.button whileHover={{x:5}} className={t.id===active.id?'track active-track':'track'} key={t.id} onClick={()=>choose(t)}><span className="num">{i+1}</span><span className="mini-cover" style={{background:t.color}}><Disc3 size={15}/></span><span className="track-info"><b>{t.title}</b><small>{t.artist} · {t.album}</small></span><span className="genre">{t.genre}</span><span className="track-time">{t.duration}</span><MoreHorizontal size={17}/></motion.button>)}</div>
              </div>
              <div className="panel recommendation"><div className="panel-head"><div><h2>Made for tonight</h2><p>AI-ready discovery mix</p></div><SparkleIcon size={18}/></div><div className="mix-art"><div className="orb one"/><div className="orb two"/><div className="orb three"/><div className="mix-title">NIGHT<br/><span>DRIVE</span></div></div><button className="wide-primary" onClick={()=>choose(tracks[1])}><Play size={16}/> Play mix</button></div>
            </motion.section>
          )}
          {tab!=='Galaxy' && (
            <motion.section key={tab} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="section-view">
              <div className="section-heading"><div><span className="eyebrow">{tab.toUpperCase()}</span><h2>{tab==='Explore'?'Discover new worlds':tab==='Library'?'Your collection':'Public constellations'}</h2></div><button className="ghost"><Plus size={16}/> Create</button></div>
              <div className="cards">{filtered.map(t=><motion.button whileHover={{y:-6}} className="music-card" key={t.id} onClick={()=>choose(t)}><div className="card-art" style={{background:`radial-gradient(circle at 30% 30%, ${t.color}, #080811 65%)`}}><span>✦</span><button onClick={(e)=>{e.stopPropagation();choose(t)}}><Play size={16}/></button></div><b>{t.title}</b><small>{t.artist}</small><span>{t.genre} · {t.mood}</span></motion.button>)}</div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showPlayer && <motion.div className="player-expanded" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}><button className="close-player" onClick={()=>setShowPlayer(false)}><X/></button><div className="big-art" style={{background:`radial-gradient(circle at 30% 20%, ${active.color}, #080811 62%)`}}><Disc3 size={90}/></div><div className="now-title"><span>NOW PLAYING</span><h2>{active.title}</h2><p>{active.artist} · {active.album}</p></div><Visualizer playing={playing} color={active.color}/><div className="progress"><span>0:00</span><input type="range" min="0" max="100" defaultValue="35"/><span>{active.duration}</span></div><div className="big-controls"><button><Shuffle/></button><button onClick={prev}><SkipBack/></button><button className="play-big" onClick={()=>setPlaying(!playing)}>{playing?<Pause/>:<Play/>}</button><button onClick={next}><SkipForward/></button><button><Repeat2/></button></div></motion.div>}
      </AnimatePresence>

      <footer className="player" onClick={(e)=>{if((e.target as HTMLElement).closest('button,input')) return;setShowPlayer(true)}}>
        <div className="current"><div className="mini-cover" style={{background:active.color}}><Disc3 size={15}/></div><div><b>{active.title}</b><small>{active.artist}</small></div></div>
        <div className="player-controls"><button onClick={prev}><SkipBack/></button><button className="play" onClick={()=>setPlaying(!playing)}>{playing?<Pause/>:<Play/>}</button><button onClick={next}><SkipForward/></button></div>
        <div className="player-right"><Visualizer playing={playing} color={active.color}/><button onClick={()=>setLiked(!liked)} className={liked?'liked':''}><Heart size={18} fill={liked?'currentColor':'none'}/></button><button onClick={()=>setMuted(!muted)}>{muted||volume===0?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><input className="volume" type="range" min="0" max="100" value={muted?0:volume} onChange={e=>{setVolume(+e.target.value);setMuted(false)}} /></div>
      </footer>

      {query && <div className="search-pop"><div className="search-pop-head"><b>Results</b><span>{filtered.length} found</span></div>{filtered.map(t=><button key={t.id} onClick={()=>choose(t)}><span className="mini-cover" style={{background:t.color}}><Disc3 size={14}/></span><span><b>{t.title}</b><small>{t.artist} · {t.album}</small></span><Play size={15}/></button>)}{filtered.length===0&&<p>No worlds found.</p>}</div>}
    </div>
  )
}
