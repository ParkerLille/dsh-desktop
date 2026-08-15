import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { PluginStore, normalizePluginId } from '../src/main/plugin-store'

describe('normalizePluginId', () => {
  it('creates a stable lowercase plugin id', () => {
    expect(normalizePluginId('  My Useful Plugin  ')).toBe('my-useful-plugin')
  })
  it('rejects a name that cannot produce a contained id', () => {
    expect(() => normalizePluginId('../')).toThrow('valid plugin id')
  })
})

describe('PluginStore', () => {
  let root: string
  let store: PluginStore
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-desktop-plugins-'))
    store = new PluginStore(root, () => '2026-11-30T00:00:00.000Z')
  })

  it('creates source and manifest files then lists the plugin', async () => {
    const created = await store.create({ name: 'Status Panel', description: 'Shows status' })
    expect(created.manifest).toMatchObject({ id: 'status-panel', name: 'Status Panel', enabled: false, apiVersion: 1 })
    expect(JSON.parse(await readFile(join(root, 'status-panel', 'manifest.json'), 'utf8'))).toEqual(created.manifest)
    expect(await readFile(join(root, 'status-panel', 'index.js'), 'utf8')).toContain('api.registerPanel')
    await expect(store.list()).resolves.toEqual([created])
  })

  it('rejects duplicate plugins and traversal ids', async () => {
    await store.create({ name: 'Status Panel', description: '' })
    await expect(store.create({ name: 'Status Panel', description: '' })).rejects.toThrow('already exists')
    await expect(store.read('../status-panel')).rejects.toThrow('Invalid plugin id')
  })

  it('updates source and persists enablement', async () => {
    await store.create({ name: 'Status Panel', description: '' })
    const source = "api.registerStyle('body { outline: 0; }')\n"
    await store.update('status-panel', { source })
    const enabled = await store.setEnabled('status-panel', true)
    expect(enabled.source).toBe(source)
    expect(enabled.manifest.enabled).toBe(true)
    await expect(store.read('status-panel')).resolves.toEqual(enabled)
  })

  it('removes a plugin directory', async () => {
    await store.create({ name: 'Status Panel', description: '' })
    await store.remove('status-panel')
    await expect(store.list()).resolves.toEqual([])
  })
})
