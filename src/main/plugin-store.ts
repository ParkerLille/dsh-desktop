import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { DESKTOP_PLUGIN_API_VERSION, type CreatePluginInput, type DesktopPluginManifest, type DesktopPluginRecord, type UpdatePluginInput } from '../shared/contracts'

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export function normalizePluginId(value: string): string {
  const id = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!ID_PATTERN.test(id)) throw new Error('Name must produce a valid plugin id')
  return id
}
function assertPluginId(id: string): void { if (!ID_PATTERN.test(id)) throw new Error('Invalid plugin id') }
function starterSource(name: string): string {
  return `api.registerPanel({
  id: 'main',
  title: ${JSON.stringify(name)},
  html: '<p>Edit this plugin to build your panel.</p>',
})
`
}

export class PluginStore {
  constructor(private readonly root: string, private readonly now: () => string = () => new Date().toISOString()) {}
  private directory(id: string): string {
    assertPluginId(id)
    const directory = resolve(this.root, id)
    const root = resolve(this.root)
    if (!directory.startsWith(`${root}${sep}`)) throw new Error('Invalid plugin id')
    return directory
  }
  private async writeJson(path: string, value: unknown): Promise<void> {
    const temporary = `${path}.tmp`
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
  }
  async list(): Promise<DesktopPluginRecord[]> {
    await mkdir(this.root, { recursive: true })
    const entries = await readdir(this.root, { withFileTypes: true })
    const records: DesktopPluginRecord[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) continue
      try { records.push(await this.read(entry.name)) } catch { /* Skip incomplete plugin directories. */ }
    }
    return records.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
  }
  async create(input: CreatePluginInput): Promise<DesktopPluginRecord> {
    const name = input.name.trim()
    if (name === '') throw new Error('Plugin name is required')
    const id = normalizePluginId(name)
    const directory = this.directory(id)
    try { await mkdir(directory, { recursive: false }) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Plugin "${id}" already exists`)
      throw error
    }
    const manifest: DesktopPluginManifest = { id, name, description: input.description.trim(), version: '0.1.0', apiVersion: DESKTOP_PLUGIN_API_VERSION, enabled: false }
    const source = starterSource(name)
    const updatedAt = this.now()
    await this.writeJson(join(directory, 'manifest.json'), manifest)
    await writeFile(join(directory, 'index.js'), source, 'utf8')
    await writeFile(join(directory, '.updated-at'), updatedAt, 'utf8')
    return { manifest, source, updatedAt }
  }
  async read(id: string): Promise<DesktopPluginRecord> {
    const directory = this.directory(id)
    const [manifestRaw, source, updatedAt] = await Promise.all([
      readFile(join(directory, 'manifest.json'), 'utf8'),
      readFile(join(directory, 'index.js'), 'utf8'),
      readFile(join(directory, '.updated-at'), 'utf8'),
    ])
    const manifest = JSON.parse(manifestRaw) as DesktopPluginManifest
    if (manifest.id !== id || manifest.apiVersion !== DESKTOP_PLUGIN_API_VERSION) throw new Error('Invalid plugin manifest')
    return { manifest, source, updatedAt: updatedAt.trim() }
  }
  async update(id: string, input: UpdatePluginInput): Promise<DesktopPluginRecord> {
    const current = await this.read(id)
    const manifest = { ...current.manifest, ...(input.name === undefined ? {} : { name: input.name.trim() }), ...(input.description === undefined ? {} : { description: input.description.trim() }) }
    if (manifest.name === '') throw new Error('Plugin name is required')
    const source = input.source ?? current.source
    const updatedAt = this.now()
    const directory = this.directory(id)
    await this.writeJson(join(directory, 'manifest.json'), manifest)
    await writeFile(join(directory, 'index.js'), source, 'utf8')
    await writeFile(join(directory, '.updated-at'), updatedAt, 'utf8')
    return { manifest, source, updatedAt }
  }
  async setEnabled(id: string, enabled: boolean): Promise<DesktopPluginRecord> {
    const current = await this.read(id)
    const manifest = { ...current.manifest, enabled }
    const updatedAt = this.now()
    const directory = this.directory(id)
    await this.writeJson(join(directory, 'manifest.json'), manifest)
    await writeFile(join(directory, '.updated-at'), updatedAt, 'utf8')
    return { ...current, manifest, updatedAt }
  }
  async remove(id: string): Promise<void> { await rm(this.directory(id), { recursive: true, force: true }) }
}
