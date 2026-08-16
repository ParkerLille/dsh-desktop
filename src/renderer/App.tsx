import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { DshProcessStatus } from '../shared/contracts'
import type { DesktopBridge } from '../shared/desktop-bridge'

export function App({ bridge }: { bridge: DesktopBridge }) {
  const [status, setStatus] = useState<DshProcessStatus>({ phase: 'starting', ownership: null, url: 'http://127.0.0.1:3080' })
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async (retry = false) => {
    setError(null)
    setStatus(current => ({ ...current, phase: 'starting' }))
    try {
      const nextStatus = retry ? await bridge.dsh.retry() : await bridge.dsh.start()
      setStatus(nextStatus)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message)
      setStatus(current => ({ ...current, phase: 'failed', error: message }))
    }
  }, [bridge])

  useEffect(() => { void start() }, [start])

  return <main className="desktop-shell">
    <section className="guest-area">
      {status.phase === 'ready' && <webview src={status.url} partition="persist:dsh-desktop" />}
      {status.phase === 'starting' && <div className="startup-state"><RefreshCw className="spin" size={22} /><strong>Starting DSH</strong></div>}
      {status.phase === 'failed' && <div className="startup-state error-state"><strong>Unable to start DSH</strong><p>{error}</p><button className="primary-button" aria-label="Retry" onClick={() => start(true)}>Retry</button></div>}
    </section>
  </main>
}
