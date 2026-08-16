import { ipcMain } from 'electron'
import { IPC } from '../shared/desktop-bridge'
import type { DshProcessManager } from './dsh-process'

export function registerDesktopIpc(processManager: DshProcessManager): () => void {
  const channels = Object.values(IPC)
  ipcMain.handle(IPC.dshStart, () => processManager.start())
  ipcMain.handle(IPC.dshStatus, () => processManager.status())
  ipcMain.handle(IPC.dshRetry, async () => { processManager.stop(); return processManager.start() })
  return () => { for (const channel of channels) ipcMain.removeHandler(channel) }
}
