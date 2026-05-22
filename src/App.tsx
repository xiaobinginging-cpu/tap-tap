import { useCallback, useEffect, useRef, useState } from 'react'
import { SOUND_OPTIONS, type SoundType, playSound } from './lib/sounds'
import { renderClickLoop, type ClickLoop } from './lib/clickLoop'

const MIN_BPM = 40
const MAX_BPM = 240
const DEFAULT_BPM = 180

const TIMER_PRESETS_MIN = [30, 45, 60] as const
const DEFAULT_TIMER_MIN = TIMER_PRESETS_MIN[2]
const MIN_TIMER_MIN = 1
const MAX_TIMER_MIN = 180

/** Wait out slider drags before re-rendering the loop. */
const RENDER_DEBOUNCE_MS = 140

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

  // The metronome plays as a looping WAV through this <audio> element — that
  // is the only way the beat survives an iOS screen lock.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // A live AudioContext, kept solely for instant sound-chip previews.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const loopRef = useRef<ClickLoop | null>(null)
  const renderedOnceRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const countdownRef = useRef<number | null>(null)
  const timerEndsAtRef = useRef<number | null>(null)

  const bpmRef = useRef<number>(bpm)
  const soundRef = useRef<SoundType>(sound)
  const playingRef = useRef(playing)
  const timerEnabledRef = useRef(timerEnabled)

  // Mirror the latest state into refs for use inside async callbacks,
  // event handlers and effects that should not re-subscribe on every change.
  useEffect(() => {
    bpmRef.current = bpm
    soundRef.current = sound
    playingRef.current = playing
    timerEnabledRef.current = timerEnabled
  })

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

  const previewSound = useCallback(
    (id: SoundType) => {
      const ctx = ensureCtx()
      playSound(id, ctx, ctx.currentTime)
    },
    [ensureCtx],
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
    navigator.mediaSession.playbackState = active ? 'playing' : 'paused'
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

  // Re-render the looping WAV whenever tempo or voice changes, debounced so a
  // slider drag does not thrash. Runs while stopped too, so the <audio>
  // element always has a current source ready for an instant gesture-start.
  useEffect(() => {
    let cancelled = false

    const run = () => {
      void (async () => {
        let loop: ClickLoop
        try {
          loop = await renderClickLoop(soundRef.current, bpmRef.current)
        } catch {
          return
        }
        if (cancelled) {
          URL.revokeObjectURL(loop.url)
          return
        }
        const audio = audioRef.current
        if (!audio) {
          URL.revokeObjectURL(loop.url)
          return
        }
        const prev = loopRef.current
        loopRef.current = loop
        audio.src = loop.url
        audio.load()
        if (prev) URL.revokeObjectURL(prev.url)
        if (playingRef.current) {
          try {
            await audio.play()
          } catch {
            /* will resume on next gesture */
          }
        }
      })()
    }

    if (!renderedOnceRef.current) {
      // First render: do it immediately so a quick tap on 开始 has a source.
      renderedOnceRef.current = true
      run()
      return () => {
        cancelled = true
      }
    }

    const handle = window.setTimeout(run, RENDER_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [bpm, sound])

  // Drive playback from the `playing` flag.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.play().catch(() => {
        /* needs a user gesture — toggle() starts it synchronously */
      })
      void requestWakeLock()
      setMediaSessionPlaying(true)
    } else {
      audio.pause()
      audio.currentTime = 0
      void releaseWakeLock()
      setMediaSessionPlaying(false)
    }
  }, [playing, requestWakeLock, releaseWakeLock, setMediaSessionPlaying])

  // Visual pulse, derived from the audio clock so it stays in sync with the
  // loop. Foreground only (rAF freezes when backgrounded — fine, screen off).
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let lastBeat = -1

    const step = () => {
      const audio = audioRef.current
      const loop = loopRef.current
      if (audio && loop && !audio.paused) {
        const beat = Math.floor(audio.currentTime / loop.beatSec)
        if (beat !== lastBeat) {
          lastBeat = beat
          setTick((t) => t + 1)
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // Timer countdown — wall-clock anchored, so it self-corrects after the tab
  // is backgrounded (where setInterval is throttled or frozen).
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

  // Coming back to the foreground: re-sync the timer, recover audio if iOS
  // paused it, and re-acquire the (auto-released) wake lock.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      syncTimerFromClock()
      if (playingRef.current) {
        const audio = audioRef.current
        if (audio && audio.paused) {
          audio.play().catch(() => {
            /* ignore */
          })
        }
        void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [requestWakeLock, syncTimerFromClock])

  // Lock-screen / Control Center transport controls.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.setActionHandler('play', () => setPlaying(true))
      navigator.mediaSession.setActionHandler('pause', () => setPlaying(false))
      navigator.mediaSession.setActionHandler('stop', () => setPlaying(false))
    } catch {
      /* unsupported */
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('stop', null)
      } catch {
        /* ignore */
      }
    }
  }, [])

  // Release the last loop's object URL on unmount.
  useEffect(() => {
    return () => {
      if (loopRef.current) URL.revokeObjectURL(loopRef.current.url)
    }
  }, [])

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
    if (playing) {
      setPlaying(false)
      return
    }

    if (timerEnabled) {
      setRemainingSec(timerSec)
      timerEndsAtRef.current = null
    }

    // Kick playback off inside the user gesture so iOS unlocks the <audio>
    // element — that unlock is what lets it keep playing once the screen
    // locks. The render effect has already set a current source.
    audioRef.current?.play().catch(() => {
      /* source not ready yet; the render effect will start it */
    })
    setPlaying(true)
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
      <audio
        ref={audioRef}
        loop
        playsInline
        preload="auto"
        className="pointer-events-none fixed h-px w-px opacity-0"
        aria-hidden
      />
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
                      previewSound(id)
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
