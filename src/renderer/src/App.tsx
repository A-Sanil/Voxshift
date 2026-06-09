import React, { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { useSidecar } from './hooks/useSidecar'
import { useWebSocket } from './hooks/useWebSocket'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { BottomBar } from './components/BottomBar'
import { ToastContainer } from './components/ToastContainer'
import { VoiceChangerPage } from './pages/VoiceChanger'
import { TrainingPage } from './pages/Training'
import { MarketplacePage } from './pages/Marketplace'
import { SettingsPage } from './pages/Settings'

function PageContent(): React.ReactElement {
  const activeTab = useAppStore((s) => s.activeTab)

  switch (activeTab) {
    case 'voice-changer': return <VoiceChangerPage />
    case 'training': return <TrainingPage />
    case 'marketplace': return <MarketplacePage />
    case 'settings': return <SettingsPage />
  }
}

function AppShell(): React.ReactElement {
  useSidecar()
  useWebSocket()

  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const audioStatus = useAppStore((s) => s.audioStatus)

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '1') setActiveTab('voice-changer')
      if (e.key === '2') setActiveTab('training')
      if (e.key === '3') setActiveTab('marketplace')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveTab])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-canvas text-text-primary">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-hidden animate-fade-in">
            <PageContent />
          </main>
        </div>
      </div>
      <BottomBar />
      <ToastContainer />
    </div>
  )
}

// Sidecar connection wrapper — shows a loading screen until the port is resolved
export default function App(): React.ReactElement {
  const setSidecarPort = useAppStore((s) => s.setSidecarPort)

  useEffect(() => {
    window.api?.getSidecarPort().then((port) => {
      if (port) setSidecarPort(port)
    })
  }, [setSidecarPort])

  return <AppShell />
}
