import { ipcMain } from 'electron'
import type { CreatePluginInput, UpdatePluginInput } from '../shared/contracts'
import { IPC } from '../shared/desktop-bridge'
import type { DshProcessManager } from './dsh-process'
import type { PluginStore } from './plugin-store'

export function registerDesktopIpc(processManager: DshProcessManager, pluginStore: PluginStore): () => void {
  const channels = Object.values(IPC)
  ipcMain.handle(IPC.dshStart, () => processManager.start())
  ipcMain.handle(IPC.dshStatus, () => processManager.status())
  ipcMain.handle(IPC.dshRetry, async () => { processManager.stop(); return processManager.start() })
  ipcMain.handle(IPC.pluginList, () => pluginStore.list())
  ipcMain.handle(IPC.pluginCreate, (_event, input: CreatePluginInput) => pluginStore.create(input))
  ipcMain.handle(IPC.pluginUpdate, (_event, id: string, input: UpdatePluginInput) => pluginStore.update(id, input))
  ipcMain.handle(IPC.pluginSetEnabled, (_event, id: string, enabled: boolean) => pluginStore.setEnabled(id, enabled))
  ipcMain.handle(IPC.pluginRemove, (_event, id: string) => pluginStore.remove(id))
  return () => { for (const channel of channels) ipcMain.removeHandler(channel) }
}
