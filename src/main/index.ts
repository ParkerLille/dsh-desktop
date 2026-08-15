import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { requiresWindowsShell, resolveDshLaunch } from './dsh-launch'
import { DshProcessManager, type ChildProcessLike } from './dsh-process'
import { registerDesktopIpc } from './ipc'
import { PluginStore } from './plugin-store'

const DSH_URL = process.env.DSH_DESKTOP_URL ?? 'http://127.0.0.1:3080'
let processManager: DshProcessManager | null = null
let unregisterIpc: (() => void) | null = null

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 720,
    minHeight: 560,
    title: 'DeepSeek Harness Desktop',
    backgroundColor: '#f7f8fa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(__dirname, '../../dist/index.html'))
  return window
}

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'webview') return
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', event => {
    const target = new URL(event.url)
    const allowed = new URL(DSH_URL)
    if (target.origin !== allowed.origin) event.preventDefault()
  })
})

app.whenReady().then(() => {
  const require = createRequire(import.meta.url)
  const dshBin = join(dirname(require.resolve('@deepseek-ai/dsh/package.json')), 'lib', 'bin.js')
  const launch = resolveDshLaunch({
    executable: process.execPath,
    dshBin,
    port: new URL(DSH_URL).port || '3080',
    env: process.env,
  })
  const userData = app.getPath('userData')
  mkdirSync(userData, { recursive: true })
  processManager = new DshProcessManager({
    url: DSH_URL,
    command: launch.command,
    commandArgs: launch.args,
    env: launch.env,
    fetchImpl: (url, init) => fetch(url, init),
    spawn: (executable, args, options) => spawn(executable, [...args], { ...options, stdio: [...options.stdio], shell: process.platform === 'win32' && requiresWindowsShell(executable) }) as unknown as ChildProcessLike,
    onFailure: message => appendFileSync(join(userData, 'desktop.log'), `[${new Date().toISOString()}] ${message}\n`, 'utf8'),
  })
  const pluginStore = new PluginStore(join(userData, 'plugins'))
  unregisterIpc = registerDesktopIpc(processManager, pluginStore)
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('before-quit', () => {
  unregisterIpc?.()
  unregisterIpc = null
  processManager?.stop()
  processManager = null
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
