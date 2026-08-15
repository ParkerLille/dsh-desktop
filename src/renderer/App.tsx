import { useCallback, useEffect, useRef, useState } from 'react'
import { Plug, RefreshCw } from 'lucide-react'
import type { DesktopPluginRecord, DshProcessStatus } from '../shared/contracts'
import type { DesktopBridge } from '../shared/desktop-bridge'
import { PluginWorkbench } from './components/PluginWorkbench'
import { buildPluginInjection } from './guest-injection'

type GuestElement = HTMLElement & { executeJavaScript?: (source: string) => Promise<unknown>; reload?: () => void }

export function App({ bridge }: { bridge: DesktopBridge }) {
  const [status, setStatus] = useState<DshProcessStatus>({ phase: 'starting', ownership: null, url: 'http://127.0.0.1:3080' })
  const [plugins, setPlugins] = useState<DesktopPluginRecord[]>([])
  const [workbenchOpen, setWorkbenchOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guestRef = useRef<GuestElement | null>(null)
  const [guestReady, setGuestReady] = useState(false)

  const syncPlugins = useCallback(async (records: DesktopPluginRecord[]) => {
    setPlugins(records)
    if (guestReady && guestRef.current?.executeJavaScript) await guestRef.current.executeJavaScript(buildPluginInjection(records))
  }, [guestReady])

  const start = useCallback(async (retry = false) => {
    setError(null)
    setStatus(current => ({ ...current, phase: 'starting' }))
    try {
      const [nextStatus, records] = await Promise.all([retry ? bridge.dsh.retry() : bridge.dsh.start(), bridge.plugins.list()])
      setStatus(nextStatus)
      setPlugins(records)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message)
      setStatus(current => ({ ...current, phase: 'failed', error: message }))
    }
  }, [bridge])

  useEffect(() => { void start() }, [start])
  useEffect(() => {
    const guest = guestRef.current
    if (status.phase !== 'ready' || guest === null) return
    const ready = () => setGuestReady(true)
    guest.addEventListener('dom-ready', ready)
    return () => guest.removeEventListener('dom-ready', ready)
  }, [status.phase])
  useEffect(() => {
    if (!guestReady || !guestRef.current?.executeJavaScript) return
    void guestRef.current.executeJavaScript(buildPluginInjection(plugins))
  }, [guestReady, plugins])

  return <main className={workbenchOpen ? 'desktop-shell with-workbench' : 'desktop-shell'}>
    <header className="desktop-toolbar">
      <div className="brand"><span className="brand-mark">DSH</span><span>Desktop</span></div>
      <div className="toolbar-actions">
        <span className={status.phase === 'ready' ? 'connection-state ready' : 'connection-state'}>{status.phase === 'ready' ? 'Connected' : status.phase}</span>
        <button className={workbenchOpen ? 'toolbar-button active' : 'toolbar-button'} aria-label="Plugins" onClick={() => setWorkbenchOpen(open => !open)}><Plug size={16} />Plugins</button>
      </div>
    </header>
    <section className="guest-area">
      {status.phase === 'ready' && <webview ref={guestRef as never} src={status.url} partition="persist:dsh-desktop" />}
      {status.phase === 'starting' && <div className="startup-state"><RefreshCw className="spin" size={22} /><strong>Starting DSH</strong></div>}
      {status.phase === 'failed' && <div className="startup-state error-state"><strong>Unable to start DSH</strong><p>{error}</p><button className="primary-button" aria-label="Retry" onClick={() => start(true)}>Retry</button></div>}
    </section>
    {workbenchOpen && <PluginWorkbench bridge={bridge} plugins={plugins} onChange={syncPlugins} onClose={() => setWorkbenchOpen(false)} />}
  </main>
}
