import type { DesktopPluginRecord, PluginActivationResult } from '../shared/contracts'

interface PanelContribution { id: string; title: string; html: string }
interface CommandContribution { id: string; label: string; run: () => void }
interface PluginApi {
  registerPanel(panel: PanelContribution): void
  registerStyle(css: string): void
  registerCommand(command: CommandContribution): void
  notify(message: string): void
}
interface ActivePlugin { dispose(): void }

export class GuestPluginRuntime {
  private readonly active = new Map<string, ActivePlugin>()
  private root: HTMLElement | null = null
  constructor(private readonly target: Window) {}
  private ensureRoot(): HTMLElement {
    if (this.root?.isConnected) return this.root
    const root = this.target.document.createElement('aside')
    root.dataset.dshDesktopRuntime = 'true'
    root.setAttribute('aria-label', 'Desktop plugins')
    Object.assign(root.style, { position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483000', display: 'grid', gap: '8px', maxWidth: '360px' })
    this.target.document.body.append(root)
    this.root = root
    return root
  }
  private activate(record: DesktopPluginRecord): PluginActivationResult {
    const id = record.manifest.id
    const owned: Element[] = []
    const api: PluginApi = {
      registerPanel: panel => {
        const section = this.target.document.createElement('section')
        section.dataset.dshDesktopPlugin = id
        section.dataset.panelId = panel.id
        section.style.cssText = 'background:var(--color-background,#fff);color:var(--color-foreground,#171717);border:1px solid rgba(127,127,127,.3);border-radius:6px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.16)'
        const heading = this.target.document.createElement('strong')
        heading.textContent = panel.title
        const content = this.target.document.createElement('div')
        content.innerHTML = panel.html
        section.append(heading, content)
        this.ensureRoot().append(section)
        owned.push(section)
      },
      registerStyle: css => {
        const style = this.target.document.createElement('style')
        style.dataset.dshDesktopPlugin = id
        style.textContent = css
        this.target.document.head.append(style)
        owned.push(style)
      },
      registerCommand: command => {
        const button = this.target.document.createElement('button')
        button.type = 'button'
        button.dataset.dshDesktopPlugin = id
        button.dataset.commandId = command.id
        button.textContent = command.label
        button.addEventListener('click', command.run)
        this.ensureRoot().append(button)
        owned.push(button)
      },
      notify: message => {
        const status = this.target.document.createElement('div')
        status.dataset.dshDesktopPlugin = id
        status.setAttribute('role', 'status')
        status.textContent = message
        this.ensureRoot().append(status)
        owned.push(status)
      },
    }
    try {
      const run = new Function('api', '"use strict";\n' + record.source) as (api: PluginApi) => void
      run(api)
      this.active.set(id, { dispose: () => owned.splice(0).reverse().forEach(node => node.remove()) })
      return { id }
    } catch (error) {
      owned.splice(0).reverse().forEach(node => node.remove())
      return { id, error: error instanceof Error ? error.message : String(error) }
    }
  }
  sync(records: readonly DesktopPluginRecord[]): PluginActivationResult[] {
    for (const active of this.active.values()) active.dispose()
    this.active.clear()
    const results = records.filter(record => record.manifest.enabled).map(record => this.activate(record))
    if (this.root !== null && this.root.childElementCount === 0) { this.root.remove(); this.root = null }
    return results
  }
  dispose(): void { this.sync([]) }
}
