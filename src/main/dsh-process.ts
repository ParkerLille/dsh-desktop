import type { DshProcessStatus } from '../shared/contracts'

export interface ChildProcessLike {
  stdout?: { on(event: 'data', listener: (data: unknown) => void): unknown }
  stderr?: { on(event: 'data', listener: (data: unknown) => void): unknown }
  once(event: 'exit' | 'error', listener: (...args: unknown[]) => void): unknown
  kill(): boolean
}
export type SpawnLike = (command: string, args: readonly string[], options: {
  env: NodeJS.ProcessEnv
  windowsHide: boolean
  stdio: readonly ['ignore', 'pipe', 'pipe']
}) => ChildProcessLike
export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean }>
export interface DshProcessManagerOptions {
  url: string
  command?: string
  commandArgs?: readonly string[]
  env?: NodeJS.ProcessEnv
  fetchImpl: FetchLike
  spawn: SpawnLike
  delay?: (milliseconds: number) => Promise<void> | void
  timeoutMs?: number
  pollIntervalMs?: number
  onFailure?: (message: string) => void
}

export async function probeUrl(url: string, fetchImpl: FetchLike): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

const sleep = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds))

export class DshProcessManager {
  private child: ChildProcessLike | null = null
  private current: DshProcessStatus
  private readonly options: Required<Pick<DshProcessManagerOptions, 'command' | 'commandArgs' | 'timeoutMs' | 'pollIntervalMs'>> & DshProcessManagerOptions

  constructor(options: DshProcessManagerOptions) {
    this.options = {
      ...options,
      command: options.command ?? (process.platform === 'win32' ? 'dsh.cmd' : 'dsh'),
      commandArgs: options.commandArgs ?? ['web', '--host', '127.0.0.1', '--port', '3080'],
      timeoutMs: options.timeoutMs ?? 30_000,
      pollIntervalMs: options.pollIntervalMs ?? 200,
    }
    this.current = { phase: 'idle', ownership: null, url: options.url }
  }

  status(): DshProcessStatus { return { ...this.current } }

  async start(): Promise<DshProcessStatus> {
    if (this.current.phase === 'ready') return this.status()
    this.current = { phase: 'starting', ownership: null, url: this.options.url }
    if (await probeUrl(this.options.url, this.options.fetchImpl)) {
      this.current = { phase: 'ready', ownership: 'external', url: this.options.url }
      return this.status()
    }

    const diagnostics: string[] = []
    const child = this.options.spawn(this.options.command, this.options.commandArgs, {
      env: { ...process.env, ...this.options.env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'] as const,
    })
    this.child = child
    child.stdout?.on('data', data => diagnostics.push(String(data)))
    child.stderr?.on('data', data => diagnostics.push(String(data)))

    let rejectExit: ((error: Error) => void) | null = null
    const exited = new Promise<never>((_, reject) => { rejectExit = reject })
    child.once('error', error => rejectExit?.(error instanceof Error ? error : new Error(String(error))))
    child.once('exit', code => rejectExit?.(new Error(`DSH exited before readiness (code ${String(code)}). ${diagnostics.join('').trim()}`)))

    const readiness = (async () => {
      const startedAt = Date.now()
      while (Date.now() - startedAt < this.options.timeoutMs) {
        if (await probeUrl(this.options.url, this.options.fetchImpl)) return
        await (this.options.delay ?? sleep)(this.options.pollIntervalMs)
      }
      throw new Error(`Timed out waiting for DSH at ${this.options.url}. ${diagnostics.join('').trim()}`)
    })()

    try {
      await Promise.race([readiness, exited])
      this.current = { phase: 'ready', ownership: 'desktop', url: this.options.url }
      return this.status()
    } catch (error) {
      this.child = null
      const message = error instanceof Error ? error.message : String(error)
      this.current = { phase: 'failed', ownership: null, url: this.options.url, error: message }
      this.options.onFailure?.(message)
      throw new Error(message)
    }
  }

  stop(): void {
    if (this.child !== null) { this.child.kill(); this.child = null }
    this.current = { phase: 'idle', ownership: null, url: this.options.url }
  }
}
