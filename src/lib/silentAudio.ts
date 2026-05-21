let cachedUrl: string | null = null

/** 2s silent WAV loop — keeps iOS/Android media session alive when screen locks */
export function getSilentAudioUrl(): string {
  if (cachedUrl) return cachedUrl

  const sampleRate = 22050
  const seconds = 2
  const numSamples = sampleRate * seconds
  const byteRate = sampleRate * 2
  const dataSize = numSamples * 2
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
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  cachedUrl = URL.createObjectURL(
    new Blob([buffer], { type: 'audio/wav' }),
  )
  return cachedUrl
}
