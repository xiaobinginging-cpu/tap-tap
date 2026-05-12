import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_BPM = 40
const MAX_BPM = 240
const DEFAULT_BPM = 180

function clampBpm(bpm: number): number {
  if (Number.isNaN(bpm)) return DEFAULT_BPM
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
}

function App() {
  const [bpm, setBpm] = useState<number>(DEFAULT_BPM)
  const [playing, setPlaying] = useState<boolean>(false)
  const [tick, setTick] = useState<number>(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const bpmRef = useRef<number>(bpm)
  bpmRef.current = bpm

  const ensureCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      audioCtxRef.current = new Ctor()
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }, [])

  const playClick = useCallback(() => {
    const ctx = ensureCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(0.6, now + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.06)
  }, [ensureCtx])

  useEffect(() => {
    if (!playing) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    let cancelled = false

    const fire = () => {
      if (cancelled) return
      playClick()
      setTick((t) => t + 1)
      const interval = 60000 / bpmRef.current
      timeoutRef.current = window.setTimeout(fire, interval)
    }

    fire()

    return () => {
      cancelled = true
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [playing, playClick])

  const adjust = (delta: number) => setBpm((b) => clampBpm(b + delta))
  const toggle = () => {
    ensureCtx()
    setPlaying((p) => !p)
  }

  const pulseDuration = Math.max(80, Math.min(220, 60000 / bpm / 2))

  return (
    <div className="min-h-full flex flex-col items-center justify-start px-6 py-10 sm:py-16 text-cedar">
      <header className="text-center mb-10 sm:mb-14">
        <h1 className="font-serif text-6xl sm:text-7xl font-bold tracking-tight text-cedar">
          tap-tap
        </h1>
        <p className="font-serif text-base sm:text-lg mt-3 text-cedar-soft">
          家里跟练用的节拍器
        </p>
      </header>

      <main className="w-full max-w-md flex flex-col items-center gap-8">
        <div className="relative flex items-center justify-center h-56 w-56 sm:h-64 sm:w-64">
          <div
            key={tick}
            className="absolute inset-0 rounded-full bg-rose-soft"
            style={{
              animation: playing
                ? `pulse ${pulseDuration}ms ease-out forwards`
                : 'none',
            }}
          />
          <div className="relative flex flex-col items-center justify-center rounded-full bg-cream-soft h-44 w-44 sm:h-52 sm:w-52 shadow-[0_2px_0_rgba(107,79,59,0.15)] border border-rose/40">
            <div className="font-serif text-6xl sm:text-7xl font-bold leading-none text-cedar tabular-nums">
              {bpm}
            </div>
            <div className="mt-2 text-xs sm:text-sm tracking-[0.3em] uppercase text-cedar-soft">
              bpm
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => adjust(-5)}
            className="px-4 py-2 rounded-full bg-cream-soft border border-cedar/20 text-cedar hover:bg-rose-soft transition-colors text-lg font-medium"
            aria-label="减 5"
          >
            −5
          </button>
          <button
            type="button"
            onClick={() => adjust(-1)}
            className="px-4 py-2 rounded-full bg-cream-soft border border-cedar/20 text-cedar hover:bg-rose-soft transition-colors text-lg font-medium"
            aria-label="减 1"
          >
            −1
          </button>
          <button
            type="button"
            onClick={() => adjust(1)}
            className="px-4 py-2 rounded-full bg-cream-soft border border-cedar/20 text-cedar hover:bg-rose-soft transition-colors text-lg font-medium"
            aria-label="加 1"
          >
            +1
          </button>
          <button
            type="button"
            onClick={() => adjust(5)}
            className="px-4 py-2 rounded-full bg-cream-soft border border-cedar/20 text-cedar hover:bg-rose-soft transition-colors text-lg font-medium"
            aria-label="加 5"
          >
            +5
          </button>
        </div>

        <div className="w-full px-2">
          <input
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(clampBpm(Number(e.target.value)))}
            className="w-full accent-[#d4a89b]"
            aria-label="BPM 滑块"
          />
          <div className="flex justify-between text-xs text-cedar-soft mt-1 tabular-nums">
            <span>{MIN_BPM}</span>
            <span>{MAX_BPM}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          className="mt-2 px-10 py-4 rounded-full bg-rose text-cream-soft text-xl font-serif font-semibold tracking-wide shadow-[0_3px_0_rgba(107,79,59,0.25)] hover:bg-rose-soft hover:text-cedar transition-colors active:translate-y-[1px]"
          aria-pressed={playing}
        >
          {playing ? '暂停' : '开始'}
        </button>
      </main>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.85; }
          100% { transform: scale(1.35); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default App
