// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { GuestPluginRuntime } from '../src/guest/plugin-runtime'
import type { DesktopPluginRecord } from '../src/shared/contracts'

function plugin(id: string, source: string, enabled = true): DesktopPluginRecord {
  return {
    manifest: { id, name: id, description: '', version: '0.1.0', apiVersion: 1, enabled },
    source, updatedAt: '2026-11-30T00:00:00.000Z',
  }
}

describe('GuestPluginRuntime', () => {
  it('activates enabled plugins and ignores disabled plugins', () => {
    const runtime = new GuestPluginRuntime(window)
    runtime.sync([
      plugin('visible', "api.registerPanel({ id: 'main', title: 'Visible', html: '<strong>ready</strong>' })"),
      plugin('hidden', "api.registerPanel({ id: 'main', title: 'Hidden', html: 'no' })", false),
    ])
    expect(document.querySelector('[data-dsh-desktop-plugin="visible"]')?.textContent).toContain('ready')
    expect(document.querySelector('[data-dsh-desktop-plugin="hidden"]')).toBeNull()
  })

  it('removes owned panels and styles during reload and disable', () => {
    const runtime = new GuestPluginRuntime(window)
    runtime.sync([plugin('theme', "api.registerStyle('body { color: red; }'); api.registerPanel({ id: 'one', title: 'One', html: 'first' })")])
    runtime.sync([plugin('theme', "api.registerPanel({ id: 'two', title: 'Two', html: 'second' })")])
    expect(document.body.textContent).not.toContain('first')
    expect(document.querySelector('style[data-dsh-desktop-plugin="theme"]')).toBeNull()
    expect(document.body.textContent).toContain('second')
    runtime.sync([])
    expect(document.querySelector('[data-dsh-desktop-plugin="theme"]')).toBeNull()
  })

  it('isolates a failing plugin and continues activating the rest', () => {
    const runtime = new GuestPluginRuntime(window)
    const result = runtime.sync([
      plugin('broken', "throw new Error('broken source')"),
      plugin('healthy', "api.registerPanel({ id: 'ok', title: 'OK', html: 'healthy' })"),
    ])
    expect(result.find(item => item.id === 'broken')?.error).toContain('broken source')
    expect(document.body.textContent).toContain('healthy')
  })

  it('dispatches commands and notifications through DOM events', () => {
    const runtime = new GuestPluginRuntime(window)
    runtime.sync([plugin('actions', "api.registerCommand({ id: 'run', label: 'Run', run: () => api.notify('done') })")])
    document.querySelector<HTMLButtonElement>('[data-command-id="run"]')?.click()
    expect(document.querySelector('[role="status"]')?.textContent).toContain('done')
  })
})
