// Renders the metronome as a seamless looping WAV. Played through a plain
// <audio loop> element, this keeps ticking when the iPhone screen is locked —
// iOS only lets media-element audio run in the background, not Web Audio +
// JS timers (those both freeze on lock).

import { MAX_TAIL_SEC, playSound, type SoundType } from './sounds'

const SAMPLE_RATE = 44100
/** Aim for ~2s loops so iOS reliably treats it as ongoing media playback. */
const TARGET_LOOP_SEC = 2

export interface ClickLoop {
  /** Object URL of the looping WAV — assign to <audio>.src. */
  url: string
  /** Exact seconds per beat in the rendered loop (for visual sync). */
  beatSec: number
  /** Number of beats contained in one loop. */
  beats: number
}

type OfflineCtor = typeof OfflineAudioContext

function getOfflineCtor(): OfflineCtor {
  return (
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: OfflineCtor })
      .webkitOfflineAudioContext
  )
}

/**
 * Render `bpm` clicks of `sound` into a gapless looping WAV. Click tails that
 * spill past the loop end are folded back onto the start, so the `loop`
 * attribute produces no audible seam.
 */
export async function renderClickLoop(
  sound: SoundType,
  bpm: number,
): Promise<ClickLoop> {
  const beatSec = 60 / bpm
  const beats = Math.max(1, Math.ceil(TARGET_LOOP_SEC / beatSec))
  const loopSamples = Math.round(beats * beatSec * SAMPLE_RATE)
  const tailSamples = Math.ceil(MAX_TAIL_SEC * SAMPLE_RATE)
  // Sample-aligned beat length so playback tempo matches the loop exactly.
  const exactBeatSec = loopSamples / beats / SAMPLE_RATE

  const Offline = getOfflineCtor()
  const offline = new Offline(1, loopSamples + tailSamples, SAMPLE_RATE)
  for (let i = 0; i < beats; i++) {
    playSound(sound, offline, i * exactBeatSec)
  }
  const rendered = await offline.startRendering()
  const src = rendered.getChannelData(0)

  const loop = new Float32Array(loopSamples)
  loop.set(src.subarray(0, loopSamples))
  // Fold the overhanging tails back onto the loop start.
  for (let i = 0; i < tailSamples; i++) {
    loop[i] += src[loopSamples + i]
  }

  return {
    url: URL.createObjectURL(encodeWav(loop, SAMPLE_RATE)),
    beatSec: exactBeatSec,
    beats,
  }
}

/** Encode mono float samples as a 16-bit PCM WAV blob. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}
