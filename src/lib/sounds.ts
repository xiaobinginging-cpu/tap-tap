// Metronome click voices. Each renderer schedules one click on a
// BaseAudioContext at `when` — works for both a live AudioContext (preview)
// and an OfflineAudioContext (rendering the looping click track).

export type SoundType = 'bright' | 'wood' | 'digital' | 'deep' | 'bell' | 'drum'

export const SOUND_OPTIONS: { id: SoundType; label: string }[] = [
  { id: 'bright', label: '清脆' },
  { id: 'wood', label: '木鱼' },
  { id: 'digital', label: '电子' },
  { id: 'deep', label: '浑厚' },
  { id: 'bell', label: '铃声' },
  { id: 'drum', label: '鼓点' },
]

/** Longest tail across all voices — render head-room so loops stay seamless. */
export const MAX_TAIL_SEC = 0.5

function playBright(ctx: BaseAudioContext, now: number) {
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
}

function playWood(ctx: BaseAudioContext, now: number) {
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
}

function playDigital(ctx: BaseAudioContext, now: number) {
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
}

function playDeep(ctx: BaseAudioContext, now: number) {
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
}

function playBell(ctx: BaseAudioContext, now: number) {
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
}

function playDrum(ctx: BaseAudioContext, now: number) {
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
}

/** Schedule one click of the given voice at `when` on any audio context. */
export function playSound(
  sound: SoundType,
  ctx: BaseAudioContext,
  when: number,
): void {
  switch (sound) {
    case 'wood':
      return playWood(ctx, when)
    case 'digital':
      return playDigital(ctx, when)
    case 'deep':
      return playDeep(ctx, when)
    case 'bell':
      return playBell(ctx, when)
    case 'drum':
      return playDrum(ctx, when)
    default:
      return playBright(ctx, when)
  }
}
