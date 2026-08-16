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
  } as DesktopBridge
}

describe('App', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('loads the complete DSH URL in a webview', async () => {
    render(<App bridge={bridge()} />)
    expect(screen.getByText('Starting DSH')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('webview')?.getAttribute('src')).toBe('http://127.0.0.1:3080'))
  })

  it('renders no desktop toolbar or plugin button', () => {
    render(<App bridge={bridge()} />)
    expect(document.querySelector('.desktop-toolbar')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Plugins' })).not.toBeInTheDocument()
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
