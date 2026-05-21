import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_BPM = 40
const MAX_BPM = 240
const DEFAULT_BPM = 180

const TIMER_PRESETS_MIN = [30, 45, 60] as const
const DEFAULT_TIMER_MIN = TIMER_PRESETS_MIN[2]
const MIN_TIMER_MIN = 1
const MAX_TIMER_MIN = 180

type SoundType =
  | 'bright'
  | 'wood'
  | 'digital'
  | 'deep'
  | 'bell'
  | 'drum'

const SOUND_OPTIONS: { id: SoundType; label: string }[] = [
  { id: 'bright', label: '清脆' },
  { id: 'wood', label: '木鱼' },
  { id: 'digital', label: '电子' },
  { id: 'deep', label: '浑厚' },
  { id: 'bell', label: '铃声' },
  { id: 'drum', label: '鼓点' },
]

function clampBpm(bpm: number): number {
  if (Number.isNaN(bpm)) return DEFAULT_BPM
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
}

function clampTimerMin(min: number): number {
  if (Number.isNaN(min)) return DEFAULT_TIMER_MIN
  return Math.min(MAX_TIMER_MIN, Math.max(MIN_TIMER_MIN, Math.round(min)))
}

function minToSec(min: number): number {
  return clampTimerMin(min) * 60
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function App() {
  const [bpm, setBpm] = useState<number>(DEFAULT_BPM)
  const [playing, setPlaying] = useState<boolean>(false)
  const [tick, setTick] = useState<number>(0)

  const [timerEnabled, setTimerEnabled] = useState<boolean>(true)
  const [timerSec, setTimerSec] = useState<number>(minToSec(DEFAULT_TIMER_MIN))
  const [remainingSec, setRemainingSec] = useState<number>(
    minToSec(DEFAULT_TIMER_MIN),
  )
  const [customTimerInput, setCustomTimerInput] = useState<string>(
    String(DEFAULT_TIMER_MIN),
  )

  const [sound, setSound] = useState<SoundType>('bright')

  const audioCtxRef = useRef<AudioContext | null>(null)
  const schedulerRef = useRef<number | null>(null)
  const countdownRef = useRef<number | null>(null)
  const keepAliveRef = useRef<AudioBufferSourceNode | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const nextBeatTimeRef = useRef(0)
  const timerEndsAtRef = useRef<number | null>(null)
  const bpmRef = useRef<number>(bpm)
  const soundRef = useRef<SoundType>(sound)
  const playingRef = useRef(playing)
  const timerEnabledRef = useRef(timerEnabled)
  bpmRef.current = bpm
  soundRef.current = sound
  playingRef.current = playing
  timerEnabledRef.current = timerEnabled

  const SCHEDULE_AHEAD_SEC = 0.15
  const LOOKAHEAD_MS = 25

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

  const playBright = useCallback((ctx: AudioContext, now: number) => {
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
  }, [])

  const playWood = useCallback((ctx: AudioContext, now: number) => {
    const dest = ctx.destination

    const body = ctx.createOscillator()
    const bodyGain = ctx.createGain()
    body.type = 'sine'
    body.frequency.setValueAtTime(320, now)
    bodyGain.gain.setValueAtTime(0.001, now)
    bodyGain.gain.exponentialRampToValueAtTime(0.55, now + 0.002)
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
    body.connect(bodyGain).connect(dest)
    body.start(now)
    body.stop(now + 0.1)

    const knock = ctx.createOscillator()
    const knockGain = ctx.createGain()
    knock.type = 'sine'
    knock.frequency.setValueAtTime(980, now)
    knock.frequency.exponentialRampToValueAtTime(620, now + 0.018)
    knockGain.gain.setValueAtTime(0.001, now)
    knockGain.gain.exponentialRampToValueAtTime(0.35, now + 0.001)
    knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)
    knock.connect(knockGain).connect(dest)
    knock.start(now)
    knock.stop(now + 0.04)

    const len = Math.floor(ctx.sampleRate * 0.025)
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / len
      data[i] = (Math.random() * 2 - 1) * (1 - t) ** 2
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1400, now)
    filter.Q.setValueAtTime(6, now)
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.25, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02)
    noise.connect(filter).connect(noiseGain).connect(dest)
    noise.start(now)
    noise.stop(now + 0.03)
  }, [])

  const playDigital = useCallback((ctx: AudioContext, now: number) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(1200, now)
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.035)
  }, [])

  const playDeep = useCallback((ctx: AudioContext, now: number) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, now)
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(0.65, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.11)
  }, [])

  const playBell = useCallback((ctx: AudioContext, now: number) => {
    const dest = ctx.destination
    const partials = [
      { freq: 740, gain: 0.4, decay: 0.35 },
      { freq: 1480, gain: 0.22, decay: 0.28 },
      { freq: 2220, gain: 0.1, decay: 0.2 },
    ]
    for (const { freq, gain: peak, decay } of partials) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      g.gain.setValueAtTime(0.001, now)
      g.gain.exponentialRampToValueAtTime(peak, now + 0.003)
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay)
      osc.connect(g).connect(dest)
      osc.start(now)
      osc.stop(now + decay + 0.02)
    }
  }, [])

  const playDrum = useCallback((ctx: AudioContext, now: number) => {
    const dest = ctx.destination

    const kick = ctx.createOscillator()
    const kickGain = ctx.createGain()
    kick.type = 'sine'
    kick.frequency.setValueAtTime(180, now)
    kick.frequency.exponentialRampToValueAtTime(55, now + 0.06)
    kickGain.gain.setValueAtTime(0.001, now)
    kickGain.gain.exponentialRampToValueAtTime(0.7, now + 0.002)
    kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
    kick.connect(kickGain).connect(dest)
    kick.start(now)
    kick.stop(now + 0.16)

    const len = Math.floor(ctx.sampleRate * 0.04)
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.5
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(2000, now)
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.18, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025)
    noise.connect(filter).connect(noiseGain).connect(dest)
    noise.start(now)
    noise.stop(now + 0.04)
  }, [])

  const playSoundAt = useCallback(
    (ctx: AudioContext, when: number) => {
      switch (soundRef.current) {
        case 'wood':
          playWood(ctx, when)
          break
        case 'digital':
          playDigital(ctx, when)
          break
        case 'deep':
          playDeep(ctx, when)
          break
        case 'bell':
          playBell(ctx, when)
          break
        case 'drum':
          playDrum(ctx, when)
          break
        default:
          playBright(ctx, when)
      }
    },
    [playBright, playWood, playDigital, playDeep, playBell, playDrum],
  )

  const playClick = useCallback(() => {
    const ctx = ensureCtx()
    playSoundAt(ctx, ctx.currentTime)
  }, [ensureCtx, playSoundAt])

  const stopKeepAlive = useCallback(() => {
    keepAliveRef.current?.stop()
    keepAliveRef.current = null
  }, [])

  const startKeepAlive = useCallback(
    (ctx: AudioContext) => {
      stopKeepAlive()
      const buffer = ctx.createBuffer(1, 2, ctx.sampleRate)
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const gain = ctx.createGain()
      gain.gain.value = 0.0001
      src.connect(gain).connect(ctx.destination)
      src.start()
      keepAliveRef.current = src
    },
    [stopKeepAlive],
  )

  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) return
    try {
      await wakeLockRef.current.release()
    } catch {
      /* already released */
    }
    wakeLockRef.current = null
  }, [])

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    try {
      await releaseWakeLock()
      wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch {
      /* denied or unsupported */
    }
  }, [releaseWakeLock])

  const setMediaSessionPlaying = useCallback((active: boolean) => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = active ? 'playing' : 'none'
    if (active) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'tap-tap',
        artist: '节拍器',
      })
    }
  }, [])

  const syncTimerFromClock = useCallback(() => {
    if (!timerEnabledRef.current || timerEndsAtRef.current === null) return
    const left = Math.max(
      0,
      Math.ceil((timerEndsAtRef.current - Date.now()) / 1000),
    )
    setRemainingSec(left)
    if (left <= 0) setPlaying(false)
  }, [])

  const scheduleBeats = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx || !playingRef.current) return

    const beatSec = 60 / bpmRef.current
    while (nextBeatTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const when = nextBeatTimeRef.current
      playSoundAt(ctx, when)

      const delayMs = (when - ctx.currentTime) * 1000
      if (delayMs >= 0 && delayMs < 800) {
        window.setTimeout(() => {
          if (playingRef.current) setTick((t) => t + 1)
        }, delayMs)
      }

      nextBeatTimeRef.current += beatSec
    }
  }, [playSoundAt])

  const stopTransport = useCallback(() => {
    if (schedulerRef.current !== null) {
      window.clearTimeout(schedulerRef.current)
      schedulerRef.current = null
    }
    stopKeepAlive()
    void releaseWakeLock()
    setMediaSessionPlaying(false)
  }, [releaseWakeLock, setMediaSessionPlaying, stopKeepAlive])

  useEffect(() => {
    if (!playing) {
      stopTransport()
      return
    }

    let cancelled = false

    const start = async () => {
      const ctx = ensureCtx()
      await ctx.resume()
      startKeepAlive(ctx)
      await requestWakeLock()
      setMediaSessionPlaying(true)

      nextBeatTimeRef.current = ctx.currentTime + 0.05

      const loop = () => {
        if (cancelled || !playingRef.current) return
        scheduleBeats()
        schedulerRef.current = window.setTimeout(loop, LOOKAHEAD_MS)
      }
      loop()
    }

    void start()

    return () => {
      cancelled = true
      stopTransport()
    }
  }, [
    playing,
    ensureCtx,
    scheduleBeats,
    startKeepAlive,
    requestWakeLock,
    setMediaSessionPlaying,
    stopTransport,
  ])

  useEffect(() => {
    if (!playing || !timerEnabled) {
      timerEndsAtRef.current = null
      if (countdownRef.current !== null) {
        window.clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      return
    }

    timerEndsAtRef.current = Date.now() + timerSec * 1000
    syncTimerFromClock()

    countdownRef.current = window.setInterval(syncTimerFromClock, 1000)

    return () => {
      if (countdownRef.current !== null) {
        window.clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [playing, timerEnabled, timerSec, syncTimerFromClock])

  useEffect(() => {
    const onVisibility = () => {
      const ctx = audioCtxRef.current
      if (document.visibilityState === 'visible') {
        if (ctx?.state === 'suspended') void ctx.resume()
        syncTimerFromClock()
        if (playingRef.current && ctx) {
          nextBeatTimeRef.current = ctx.currentTime + 0.05
        }
        if (playingRef.current) void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [requestWakeLock, syncTimerFromClock])

  const selectPreset = (min: number) => {
    const sec = minToSec(min)
    setTimerEnabled(true)
    setTimerSec(sec)
    setCustomTimerInput(String(clampTimerMin(min)))
    if (!playing) setRemainingSec(sec)
  }

  const applyCustomTimer = () => {
    const min = clampTimerMin(Number(customTimerInput))
    const sec = minToSec(min)
    setTimerEnabled(true)
    setTimerSec(sec)
    setCustomTimerInput(String(min))
    if (!playing) setRemainingSec(sec)
  }

  const timerMin = timerSec / 60
  const isPresetActive = (min: number) =>
    timerEnabled && Math.round(timerMin) === min

  const toggleTimerOff = () => {
    setTimerEnabled(false)
  }

  const adjust = (delta: number) => setBpm((b) => clampBpm(b + delta))
  const toggle = () => {
    const ctx = ensureCtx()
    void ctx.resume()
    if (!playing && timerEnabled) {
      setRemainingSec(timerSec)
      timerEndsAtRef.current = null
    }
    setPlaying((p) => !p)
  }

  const pulseDuration = Math.max(80, Math.min(220, 60000 / bpm / 2))

  const chipClass = (active: boolean, compact = false, stretch = false) =>
    `${stretch ? 'flex-1 min-w-0 w-full text-center' : 'shrink-0'} rounded-full font-medium border transition-colors ${
      compact ? 'px-1.5 py-2 text-xs leading-tight' : 'px-3 py-2 text-sm'
    } ${
      active
        ? 'bg-rose text-cream-soft border-rose shadow-[0_2px_0_rgba(107,79,59,0.2)]'
        : 'bg-cream-soft border-cedar/20 text-cedar hover:bg-rose-soft'
    }`

  return (
    <div className="h-dvh overflow-hidden flex flex-col items-center px-5 text-cedar pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <header className="shrink-0 text-center">
        <h1 className="font-serif text-6xl font-bold tracking-tight text-cedar">
          tap-tap
        </h1>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-md flex flex-col items-center justify-evenly">
        <div className="relative flex items-center justify-center h-56 w-56 shrink-0">
          <div
            key={tick}
              className="absolute inset-0 rounded-full bg-rose-soft"
              style={{
                animation: playing
                  ? `pulse ${pulseDuration}ms ease-out forwards`
                  : 'none',
              }}
            />
            <div className="relative flex flex-col items-center justify-center rounded-full bg-cream-soft h-44 w-44 shadow-[0_2px_0_rgba(107,79,59,0.15)] border border-rose/40">
              <div className="font-serif text-6xl font-bold leading-none text-cedar tabular-nums">
                {bpm}
              </div>
              <div className="mt-2 text-xs tracking-[0.3em] uppercase text-cedar-soft">
                bpm
              </div>
            </div>
        </div>

        <div className="flex items-center justify-center gap-2 shrink-0">
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

        <div className="w-full px-2 shrink-0">
              <input
                type="range"
                min={MIN_BPM}
                max={MAX_BPM}
                step={1}
                value={bpm}
                onChange={(e) => setBpm(clampBpm(Number(e.target.value)))}
                className="w-full h-1.5 accent-[#d4a89b]"
                aria-label="BPM 滑块"
              />
          <div className="flex justify-between text-xs text-cedar-soft mt-0.5 tabular-nums">
            <span>{MIN_BPM}</span>
            <span>{MAX_BPM}</span>
          </div>
        </div>

        <section
          className="w-full px-2 flex flex-col gap-1 shrink-0"
          aria-label="定时练习"
        >
            <div className="flex items-center justify-between">
              <span className="text-xs text-cedar-soft">定时练习</span>
              {timerEnabled && (
                <span className="text-xs tabular-nums text-cedar">
                {playing ? '剩余 ' : ''}
                {formatTime(playing ? remainingSec : timerSec)}
              </span>
            )}
          </div>
          <div className="flex w-full items-stretch gap-1.5">
            <button
              type="button"
              onClick={toggleTimerOff}
              className={chipClass(!timerEnabled, true, true)}
            >
              不限
            </button>
            {TIMER_PRESETS_MIN.map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => selectPreset(min)}
                className={chipClass(isPresetActive(min), true, true)}
              >
                {min} 分
              </button>
            ))}
            <div className="relative flex-[1.15] min-w-0">
              <input
                type="number"
                min={MIN_TIMER_MIN}
                max={MAX_TIMER_MIN}
                value={customTimerInput}
                onChange={(e) => setCustomTimerInput(e.target.value)}
                onBlur={applyCustomTimer}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyCustomTimer()
                }}
                className="w-full h-full min-h-[34px] pl-2 pr-6 py-2 rounded-full bg-cream-soft border border-cedar/20 text-cedar text-xs text-center tabular-nums focus:outline-none focus:border-rose"
                aria-label="自定义定时分钟数"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-cedar-soft">
                分
              </span>
            </div>
            <button
              type="button"
              onClick={applyCustomTimer}
              className={chipClass(
                timerEnabled &&
                  !TIMER_PRESETS_MIN.some((m) => isPresetActive(m)),
                true,
                true,
              )}
            >
              应用
            </button>
            </div>
        </section>

        <section
          className="w-full px-2 flex flex-col gap-1 shrink-0"
          aria-label="节拍音色"
        >
              <span className="text-xs text-cedar-soft">节拍音色</span>
              <div className="grid w-full grid-cols-3 gap-1">
                {SOUND_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSound(id)
                      ensureCtx()
                      soundRef.current = id
                      playClick()
                    }}
                    className={chipClass(sound === id, true, true)}
                    aria-pressed={sound === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
        </section>

        <button
          type="button"
          onClick={toggle}
          className="shrink-0 w-full max-w-xs px-10 py-4 rounded-full bg-rose text-cream-soft text-xl font-serif font-semibold tracking-wide shadow-[0_3px_0_rgba(107,79,59,0.25)] hover:bg-rose-soft hover:text-cedar transition-colors active:translate-y-[1px]"
          aria-pressed={playing}
        >
          {playing ? '暂停' : '开始'}
        </button>
      </main>
    </div>
  )
}

export default App
