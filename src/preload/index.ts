import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type DesktopBridge } from '../shared/desktop-bridge'

const bridge: DesktopBridge = {
  dsh: {
    start: () => ipcRenderer.invoke(IPC.dshStart),
    status: () => ipcRenderer.invoke(IPC.dshStatus),
    retry: () => ipcRenderer.invoke(IPC.dshRetry),
  },
}
contextBridge.exposeInMainWorld('desktop', bridge)
