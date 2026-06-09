import { useEffect, useCallback } from 'react'
import { useAppStore } from '../store/appStore'

const POLL_INTERVAL = 1500

export function useSidecar(): {
  apiBase: string
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
} {
  const { sidecarPort, setSidecarReady, setModels, setDevices, updateSettings, setActiveModelId } =
    useAppStore()

  const apiBase = `http://localhost:${sidecarPort}`

  const apiFetch = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`${apiBase}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        ...init
      }),
    [apiBase]
  )

  // Poll until sidecar is up, then bootstrap state
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>

    async function tryConnect(): Promise<void> {
      try {
        const res = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(800) })
        if (!res.ok) throw new Error('not ready')

        if (!alive) return
        setSidecarReady(true)

        const [modelsRes, devicesRes, settingsRes] = await Promise.all([
          apiFetch('/api/models'),
          apiFetch('/api/devices'),
          apiFetch('/api/settings')
        ])

        if (modelsRes.ok) {
          const models = await modelsRes.json()
          setModels(models)
        }
        if (devicesRes.ok) {
          const { input, output } = await devicesRes.json()
          setDevices(input, output)
        }
        if (settingsRes.ok) {
          const s = await settingsRes.json()
          updateSettings(s)
          if (s.active_model_id) setActiveModelId(s.active_model_id)
        }
      } catch {
        if (alive) timer = setTimeout(tryConnect, POLL_INTERVAL)
      }
    }

    tryConnect()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [apiBase, apiFetch, setSidecarReady, setModels, setDevices, updateSettings, setActiveModelId])

  return { apiBase, apiFetch }
}
