import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import type { WsEvent } from '../types'

export function useWebSocket(): void {
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)

  const { sidecarPort, sidecarReady, setAudioStatus, setWaveformAmplitudes, updateTrainingJob } =
    useAppStore()

  const connect = useCallback(() => {
    if (!mounted.current || !sidecarReady) return

    const url = `ws://localhost:${sidecarPort}/ws`
    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    socket.onmessage = (event) => {
      try {
        const data: WsEvent = JSON.parse(event.data as string)
        switch (data.type) {
          case 'waveform':
            setWaveformAmplitudes(data.amplitudes)
            break
          case 'audio_status':
            setAudioStatus(data.status)
            break
          case 'training_progress':
            updateTrainingJob({
              current_epoch: data.epoch,
              total_epochs: data.total,
              status: data.status
            })
            break
        }
      } catch {
        // ignore malformed frames
      }
    }

    socket.onclose = () => {
      ws.current = null
      if (mounted.current) {
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    socket.onerror = () => {
      socket.close()
    }
  }, [sidecarPort, sidecarReady, setAudioStatus, setWaveformAmplitudes, updateTrainingJob])

  useEffect(() => {
    mounted.current = true
    if (sidecarReady) connect()
    return () => {
      mounted.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [sidecarReady, connect])
}
