import { useEffect, useState } from 'react'
import { Code2, Plus, Save, Trash2, X } from 'lucide-react'
import type { DesktopPluginRecord } from '../../shared/contracts'
import type { DesktopBridge } from '../../shared/desktop-bridge'

interface Props {
  bridge: DesktopBridge
  plugins: DesktopPluginRecord[]
  onChange(records: DesktopPluginRecord[]): void
  onClose(): void
}

export function PluginWorkbench({ bridge, plugins, onChange, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(plugins[0]?.manifest.id ?? null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)
  const selected = plugins.find(plugin => plugin.manifest.id === selectedId) ?? null

  useEffect(() => { setSource(selected?.source ?? '') }, [selected?.manifest.id, selected?.source])

  async function refreshSelected(record: DesktopPluginRecord) {
    const next = plugins.some(item => item.manifest.id === record.manifest.id)
      ? plugins.map(item => item.manifest.id === record.manifest.id ? record : item)
      : [...plugins, record]
    onChange(next)
    setSelectedId(record.manifest.id)
  }

  async function createPlugin() {
    setError(null)
    try {
      const record = await bridge.plugins.create({ name, description: '' })
      await refreshSelected(record)
      setName('')
      setCreating(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }

  async function toggle(record: DesktopPluginRecord, enabled: boolean) {
    try { await refreshSelected(await bridge.plugins.setEnabled(record.manifest.id, enabled)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }

  async function save() {
    if (selected === null) return
    try { await refreshSelected(await bridge.plugins.update(selected.manifest.id, { source })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }

  async function remove() {
    if (selected === null || !window.confirm(`Delete ${selected.manifest.name}?`)) return
    await bridge.plugins.remove(selected.manifest.id)
    const next = plugins.filter(item => item.manifest.id !== selected.manifest.id)
    onChange(next)
    setSelectedId(next[0]?.manifest.id ?? null)
  }

  return <aside className="workbench" aria-label="Plugin workbench">
    <header className="workbench-header">
      <div><Code2 size={17} /><strong>Plugins</strong></div>
      <div className="header-actions">
        <button className="icon-button" aria-label="New plugin" title="New plugin" onClick={() => setCreating(true)}><Plus size={17} /></button>
        <button className="icon-button" aria-label="Close plugins" title="Close" onClick={onClose}><X size={17} /></button>
      </div>
    </header>
    {creating && <div className="create-row">
      <label htmlFor="plugin-name">Plugin name</label>
      <input id="plugin-name" value={name} onChange={event => setName(event.target.value)} autoFocus />
      <button className="primary-button" onClick={createPlugin} disabled={!name.trim()}>Create plugin</button>
    </div>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="workbench-body">
      <nav className="plugin-list" aria-label="Local plugins">
        {plugins.length === 0 && <p className="empty-state">No local plugins</p>}
        {plugins.map(plugin => <button key={plugin.manifest.id} className={plugin.manifest.id === selectedId ? 'plugin-row active' : 'plugin-row'} onClick={() => setSelectedId(plugin.manifest.id)}>
          <span>{plugin.manifest.name}</span>
          <span className={plugin.manifest.enabled ? 'status-dot enabled' : 'status-dot'} aria-hidden="true" />
        </button>)}
      </nav>
      <section className="plugin-editor">
        {selected === null ? <div className="editor-empty">Select or create a plugin</div> : <>
          <div className="plugin-meta">
            <div><strong>{selected.manifest.name}</strong><small>{selected.manifest.id}</small></div>
            <label className="toggle-label"><input type="checkbox" aria-label={`Enable ${selected.manifest.name}`} checked={selected.manifest.enabled} onChange={event => toggle(selected, event.target.checked)} />Enabled</label>
          </div>
          <textarea aria-label="Plugin source" spellCheck={false} value={source} onChange={event => setSource(event.target.value)} />
          <footer className="editor-actions">
            <button className="danger-button" onClick={remove}><Trash2 size={15} />Delete</button>
            <button className="primary-button" onClick={save}><Save size={15} />Save & reload</button>
          </footer>
        </>}
      </section>
    </div>
  </aside>
}
