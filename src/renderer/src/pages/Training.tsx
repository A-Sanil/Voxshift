import React, { useState, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { useSidecar } from '../hooks/useSidecar'

type WizardStep = 'upload' | 'configure' | 'training'

const PITCH_ALGOS = [
  { value: 'rmvpe', label: 'RMVPE', desc: 'Recommended — most accurate' },
  { value: 'harvest', label: 'Harvest', desc: 'Balanced speed/accuracy' },
  { value: 'dio', label: 'Dio', desc: 'Fastest, lower accuracy' }
] as const

export function TrainingPage(): React.ReactElement {
  const trainingJob = useAppStore((s) => s.trainingJob)
  const setTrainingJob = useAppStore((s) => s.setTrainingJob)
  const addToast = useAppStore((s) => s.addToast)
  const { apiFetch } = useSidecar()

  const [step, setStep] = useState<WizardStep>(trainingJob ? 'training' : 'upload')
  const [files, setFiles] = useState<string[]>([])
  const [modelName, setModelName] = useState('')
  const [epochs, setEpochs] = useState(100)
  const [sampleRate, setSampleRate] = useState(40000)
  const [pitchAlgo, setPitchAlgo] = useState<'rmvpe' | 'harvest' | 'dio'>('rmvpe')
  const [isDragging, setIsDragging] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  async function handleSelectFiles(): Promise<void> {
    const paths = await window.api?.selectAudioFiles()
    if (paths && paths.length > 0) {
      setFiles(paths)
      setStep('configure')
    }
  }

  async function handleStartTraining(): Promise<void> {
    if (!modelName.trim() || files.length === 0) return
    const res = await apiFetch('/api/train', {
      method: 'POST',
      body: JSON.stringify({
        model_name: modelName.trim(),
        file_paths: files,
        total_epochs: epochs,
        sample_rate: sampleRate,
        pitch_algo: pitchAlgo
      })
    })
    if (res.ok) {
      const job = await res.json()
      setTrainingJob(job)
      setStep('training')
    } else {
      addToast({ type: 'error', message: 'Failed to start training job' })
    }
  }

  async function handleCancel(): Promise<void> {
    if (!trainingJob) return
    await apiFetch(`/api/train/${trainingJob.id}/cancel`, { method: 'POST' })
    setTrainingJob(null)
    setStep('upload')
    setFiles([])
    setModelName('')
  }

  function handleDrop(e: React.DragEvent): void {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
      .filter((f) => /\.(wav|mp3|flac|ogg|m4a)$/i.test(f.name))
      .map((f) => (f as unknown as { path: string }).path ?? f.name)
    if (dropped.length > 0) {
      setFiles(dropped)
      setStep('configure')
    }
  }

  function reset(): void {
    setTrainingJob(null)
    setStep('upload')
    setFiles([])
    setModelName('')
  }

  return (
    <div className="flex flex-col items-center justify-start h-full overflow-y-auto p-8">
      <div className="w-full max-w-[560px] flex flex-col gap-6 animate-fade-in">

        {/* ── Step: Upload ── */}
        {step === 'upload' && (
          <>
            <div>
              <h2 className="text-xl font-medium text-text-primary mb-1">Train a new voice</h2>
              <p className="text-sm text-text-secondary">
                Upload audio samples of the target voice. 10–30 minutes of clean recordings gives the best results.
              </p>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={handleSelectFiles}
              className={[
                'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed cursor-pointer h-[200px] transition-all duration-150',
                isDragging
                  ? 'border-accent bg-accent-dim scale-[1.01]'
                  : 'border-border-strong hover:border-accent/40 hover:bg-accent-dim/50'
              ].join(' ')}
            >
              <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary">
                <UploadIcon />
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-text-primary">Drop audio files here</div>
                <div className="text-xs text-text-secondary mt-1">or click to browse · WAV, MP3, FLAC, OGG, M4A</div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Tips for best results</div>
              <ul className="space-y-1.5 text-xs text-text-secondary">
                <li className="flex gap-2"><span className="text-live shrink-0">✓</span>10–30 minutes of clean, consistent speech</li>
                <li className="flex gap-2"><span className="text-live shrink-0">✓</span>Record in a quiet room — background noise degrades quality</li>
                <li className="flex gap-2"><span className="text-live shrink-0">✓</span>Multiple shorter clips are fine; variety in tone helps</li>
                <li className="flex gap-2"><span className="text-text-secondary/40 shrink-0">✗</span>Don't mix multiple voices in the same training set</li>
              </ul>
            </div>

            <p className="text-xs text-text-secondary text-center">
              Runs fully on your machine — no audio is uploaded anywhere.
            </p>
          </>
        )}

        {/* ── Step: Configure ── */}
        {step === 'configure' && (
          <>
            <div>
              <h2 className="text-xl font-medium text-text-primary mb-1">Configure training</h2>
              <p className="text-sm text-text-secondary">
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            <div className="bg-surface rounded-lg border border-border divide-y divide-border max-h-[140px] overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-live text-xs">♪</span>
                  <span className="flex-1 text-xs text-text-primary truncate">{f.split(/[\\/]/).pop()}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Model name</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. My custom voice"
                className="bg-surface border border-border hover:border-border-strong focus:border-accent/60 text-text-primary text-sm rounded px-3 py-2 outline-none transition-colors placeholder:text-text-secondary/40"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Epochs</label>
                <span className="text-xs font-medium text-text-primary tabular-nums">{epochs}</span>
              </div>
              <input
                type="range" min={20} max={500} step={10} value={epochs}
                style={{ '--range-progress': `${((epochs - 20) / 480) * 100}%` } as React.CSSProperties}
                onChange={(e) => setEpochs(Number(e.target.value))}
              />
              <div className="flex justify-between text-xs text-text-secondary">
                <span>Quick (20)</span><span>Best quality (500)</span>
              </div>
            </div>

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={['transition-transform', showAdvanced ? 'rotate-90' : ''].join(' ')}>
                <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Advanced options
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-4 p-4 bg-surface rounded-lg border border-border">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Pitch extraction algorithm</label>
                  <div className="flex flex-col gap-1.5">
                    {PITCH_ALGOS.map((algo) => (
                      <label key={algo.value} className="flex items-center gap-3 cursor-pointer group">
                        <div className={[
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                          pitchAlgo === algo.value ? 'border-accent' : 'border-border-strong group-hover:border-accent/50'
                        ].join(' ')}>
                          {pitchAlgo === algo.value && <div className="w-2 h-2 rounded-full bg-accent" />}
                        </div>
                        <div>
                          <span className="text-sm text-text-primary">{algo.label}</span>
                          <span className="text-xs text-text-secondary ml-2">{algo.desc}</span>
                        </div>
                        <input type="radio" className="sr-only" value={algo.value} checked={pitchAlgo === algo.value} onChange={() => setPitchAlgo(algo.value)} />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Sample rate</label>
                  <div className="flex gap-2">
                    {[32000, 40000, 48000].map((sr) => (
                      <button key={sr} onClick={() => setSampleRate(sr)}
                        className={['flex-1 py-2 rounded text-xs font-medium transition-all duration-150',
                          sampleRate === sr ? 'bg-accent text-white' : 'bg-[rgba(255,255,255,0.04)] border border-border text-text-secondary hover:text-text-primary hover:border-border-strong'].join(' ')}>
                        {(sr / 1000).toFixed(0)}kHz
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep('upload'); setFiles([]) }}
                className="px-4 py-2 rounded text-sm text-text-secondary hover:text-text-primary border border-border hover:border-border-strong transition-all duration-150">
                Back
              </button>
              <button onClick={handleStartTraining} disabled={!modelName.trim()}
                className="flex-1 py-2 rounded text-sm font-medium bg-accent text-white hover:bg-accent/85 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none">
                Start training
              </button>
            </div>

            <p className="text-xs text-text-secondary text-center">
              Runs locally on your machine — no data leaves your device.
            </p>
          </>
        )}

        {/* ── Step: In progress ── */}
        {step === 'training' && trainingJob && (
          <>
            <div>
              <h2 className="text-xl font-medium text-text-primary mb-1">Training {trainingJob.model_name}</h2>
              <p className="text-sm text-text-secondary">
                {trainingJob.status === 'running'
                  ? 'You can freely navigate the app while training runs in the background.'
                  : trainingJob.status === 'completed'
                  ? 'Training complete! Your model is ready to use.'
                  : trainingJob.status === 'failed'
                  ? 'Training failed. Check your audio files and try again.'
                  : 'Training was cancelled.'}
              </p>
            </div>

            <div className="bg-surface rounded-xl border border-border p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-primary">
                  {trainingJob.status === 'running'
                    ? `Epoch ${trainingJob.current_epoch} of ${trainingJob.total_epochs}`
                    : capitalize(trainingJob.status)}
                </span>
                <span className="text-text-secondary tabular-nums text-xs">
                  {Math.round((trainingJob.current_epoch / trainingJob.total_epochs) * 100)}%
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                <div
                  className={['absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                    trainingJob.status === 'completed' ? 'bg-live' :
                    trainingJob.status === 'failed' ? 'bg-red-500' : 'bg-accent'].join(' ')}
                  style={{ width: `${Math.round((trainingJob.current_epoch / trainingJob.total_epochs) * 100)}%` }}
                />
              </div>

              {trainingJob.status === 'running' && (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-live" />
                  Training in progress — you can leave this tab
                </div>
              )}
            </div>

            {trainingJob.status === 'running' && (
              <button onClick={handleCancel}
                className="w-full py-2 rounded text-sm text-text-secondary hover:text-red-400 border border-border hover:border-red-500/30 transition-all duration-150">
                Cancel training
              </button>
            )}

            {trainingJob.status !== 'running' && (
              <button onClick={reset}
                className="w-full py-2 rounded text-sm font-medium bg-accent text-white hover:bg-accent/85 transition-all duration-150">
                {trainingJob.status === 'completed' ? 'Train another voice' : 'Try again'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
)
