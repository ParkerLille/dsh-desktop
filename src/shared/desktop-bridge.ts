import type { CreatePluginInput, DesktopPluginRecord, DshProcessStatus, UpdatePluginInput } from './contracts'

export interface DesktopBridge {
  dsh: {
    start(): Promise<DshProcessStatus>
    status(): Promise<DshProcessStatus>
    retry(): Promise<DshProcessStatus>
  }
  plugins: {
    list(): Promise<DesktopPluginRecord[]>
    create(input: CreatePluginInput): Promise<DesktopPluginRecord>
    update(id: string, input: UpdatePluginInput): Promise<DesktopPluginRecord>
    setEnabled(id: string, enabled: boolean): Promise<DesktopPluginRecord>
    remove(id: string): Promise<void>
  }
}

export const IPC = {
  dshStart: 'dsh:start', dshStatus: 'dsh:status', dshRetry: 'dsh:retry',
  pluginList: 'plugins:list', pluginCreate: 'plugins:create', pluginUpdate: 'plugins:update',
  pluginSetEnabled: 'plugins:set-enabled', pluginRemove: 'plugins:remove',
} as const
