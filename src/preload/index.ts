import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type DesktopBridge } from '../shared/desktop-bridge'

const bridge: DesktopBridge = {
  dsh: {
    start: () => ipcRenderer.invoke(IPC.dshStart),
    status: () => ipcRenderer.invoke(IPC.dshStatus),
    retry: () => ipcRenderer.invoke(IPC.dshRetry),
  },
  plugins: {
    list: () => ipcRenderer.invoke(IPC.pluginList),
    create: input => ipcRenderer.invoke(IPC.pluginCreate, input),
    update: (id, input) => ipcRenderer.invoke(IPC.pluginUpdate, id, input),
    setEnabled: (id, enabled) => ipcRenderer.invoke(IPC.pluginSetEnabled, id, enabled),
    remove: id => ipcRenderer.invoke(IPC.pluginRemove, id),
  },
}
contextBridge.exposeInMainWorld('desktop', bridge)
