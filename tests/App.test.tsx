// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/renderer/App'
import type { DesktopBridge } from '../src/shared/desktop-bridge'

function bridge(): DesktopBridge {
  return {
    dsh: {
      start: vi.fn(async () => ({ phase: 'ready', ownership: 'external', url: 'http://127.0.0.1:3080' })),
      status: vi.fn(async () => ({ phase: 'idle', ownership: null, url: 'http://127.0.0.1:3080' })),
      retry: vi.fn(async () => ({ phase: 'ready', ownership: 'external', url: 'http://127.0.0.1:3080' })),
    },
    plugins: {
      list: vi.fn(async () => []),
      create: vi.fn(async input => ({
        manifest: { id: 'my-panel', name: input.name, description: input.description, version: '0.1.0', apiVersion: 1, enabled: false },
        source: "api.registerPanel({ id: 'main', title: 'My Panel', html: 'Ready' })",
        updatedAt: '2026-11-30T00:00:00.000Z',
      })),
      update: vi.fn(async () => { throw new Error('not used') }),
      setEnabled: vi.fn(async (_id, enabled) => ({
        manifest: { id: 'my-panel', name: 'My Panel', description: '', version: '0.1.0', apiVersion: 1, enabled },
        source: '', updatedAt: '2026-11-30T00:00:00.000Z',
      })),
      remove: vi.fn(async () => undefined),
    },
  } as DesktopBridge
}

describe('App', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('loads the complete DSH URL in a webview and opens the plugin workbench', async () => {
    const api = bridge()
    render(<App bridge={api} />)
    expect(screen.getByText('Starting DSH')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('webview')?.getAttribute('src')).toBe('http://127.0.0.1:3080'))
    fireEvent.click(screen.getByRole('button', { name: 'Plugins' }))
    expect(screen.getByRole('complementary', { name: 'Plugin workbench' })).toBeInTheDocument()
  })

  it('creates a plugin and enables it from the workbench', async () => {
    const api = bridge()
    render(<App bridge={api} />)
    await waitFor(() => expect(document.querySelector('webview')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Plugins' }))
    fireEvent.click(screen.getByRole('button', { name: 'New plugin' }))
    fireEvent.change(screen.getByLabelText('Plugin name'), { target: { value: 'My Panel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create plugin' }))
    await waitFor(() => expect(api.plugins.create).toHaveBeenCalledWith({ name: 'My Panel', description: '' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable My Panel' }))
    await waitFor(() => expect(api.plugins.setEnabled).toHaveBeenCalledWith('my-panel', true))
  })

  it('shows startup diagnostics and offers retry', async () => {
    const api = bridge()
    vi.mocked(api.dsh.start).mockRejectedValueOnce(new Error('dsh command not found'))
    render(<App bridge={api} />)
    expect(await screen.findByText('dsh command not found')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(api.dsh.retry).toHaveBeenCalledOnce())
  })
})
