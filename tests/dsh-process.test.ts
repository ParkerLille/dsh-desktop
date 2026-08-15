import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { DshProcessManager, probeUrl, type ChildProcessLike } from '../src/main/dsh-process'

function child(): ChildProcessLike & EventEmitter {
  const process = new EventEmitter() as ChildProcessLike & EventEmitter
  process.kill = vi.fn(() => true)
  process.stdout = new EventEmitter()
  process.stderr = new EventEmitter()
  return process
}

describe('probeUrl', () => {
  it('reports an HTTP endpoint as available', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }))
    await expect(probeUrl('http://127.0.0.1:3080', fetchImpl)).resolves.toBe(true)
  })

  it('reports connection errors as unavailable', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('refused') })
    await expect(probeUrl('http://127.0.0.1:3080', fetchImpl)).resolves.toBe(false)
  })
})

describe('DshProcessManager', () => {
  it('reuses an already running DSH server', async () => {
    const spawn = vi.fn()
    const manager = new DshProcessManager({
      url: 'http://127.0.0.1:3080',
      fetchImpl: vi.fn(async () => ({ ok: true })),
      spawn,
      delay: vi.fn(),
    })

    await expect(manager.start()).resolves.toMatchObject({ phase: 'ready', ownership: 'external' })
    expect(spawn).not.toHaveBeenCalled()
    manager.stop()
  })

  it('starts DSH and waits for readiness when the port is closed', async () => {
    const spawned = child()
    const spawn = vi.fn(() => spawned)
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('refused'))
      .mockRejectedValueOnce(new Error('refused'))
      .mockResolvedValueOnce({ ok: true })
    const manager = new DshProcessManager({
      url: 'http://127.0.0.1:3080',
      command: 'electron.exe',
      commandArgs: ['dsh-bin.js', 'web', '--host', '127.0.0.1', '--port', '3080'],
      fetchImpl, spawn, delay: vi.fn(async () => undefined), timeoutMs: 1000,
    })

    await expect(manager.start()).resolves.toMatchObject({ phase: 'ready', ownership: 'desktop' })
    expect(spawn).toHaveBeenCalledWith('electron.exe', ['dsh-bin.js', 'web', '--host', '127.0.0.1', '--port', '3080'], expect.objectContaining({ windowsHide: true }))
    manager.stop()
    expect(spawned.kill).toHaveBeenCalledOnce()
  })

  it('surfaces child diagnostics when DSH exits before readiness', async () => {
    const spawned = child()
    const onFailure = vi.fn()
    const manager = new DshProcessManager({
      url: 'http://127.0.0.1:3080', fetchImpl: vi.fn(async () => { throw new Error('refused') }),
      spawn: vi.fn(() => spawned), delay: () => new Promise(resolve => setTimeout(resolve, 0)), timeoutMs: 1000, onFailure,
    })
    const started = manager.start()
    await vi.waitFor(() => expect(manager.status().phase).toBe('starting'))
    await vi.waitFor(() => expect(spawned.listenerCount('exit')).toBeGreaterThan(0))
    ;(spawned.stderr as EventEmitter | undefined)?.emit('data', Buffer.from('invalid configuration'))
    spawned.emit('exit', 1)
    await expect(started).rejects.toThrow('invalid configuration')
    expect(onFailure).toHaveBeenCalledWith(expect.stringContaining('invalid configuration'))
  })
})
