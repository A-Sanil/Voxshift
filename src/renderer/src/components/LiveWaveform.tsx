import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'

const BAR_COUNT = 32
const MIN_HEIGHT = 2
const MAX_HEIGHT = 40

export function LiveWaveform(): React.ReactElement {
  const audioStatus = useAppStore((s) => s.audioStatus)
  const amplitudes = useAppStore((s) => s.waveformAmplitudes)
  const isLive = audioStatus === 'live'

  const smoothed = useRef<number[]>(Array(BAR_COUNT).fill(0))

  // Smooth out amplitudes for a more organic look
  const bars = amplitudes.slice(0, BAR_COUNT).map((amp, i) => {
    const target = isLive ? Math.max(amp, 0) * MAX_HEIGHT : 0
    smoothed.current[i] = smoothed.current[i] * 0.7 + target * 0.3
    return smoothed.current[i]
  })

  return (
    <div className="flex items-center gap-[2px] h-[48px] px-1">
      {bars.map((height, i) => (
        <div
          key={i}
          className={[
            'w-[3px] rounded-full transition-all duration-75',
            isLive ? 'bg-live' : 'bg-text-secondary/20'
          ].join(' ')}
          style={{
            height: `${Math.max(MIN_HEIGHT, height)}px`,
            opacity: isLive ? 0.6 + (height / MAX_HEIGHT) * 0.4 : 0.3
          }}
        />
      ))}
    </div>
  )
}
