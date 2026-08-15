import { describe, expect, it } from 'vitest'
import { requiresWindowsShell, resolveDshLaunch } from '../src/main/dsh-launch'

describe('requiresWindowsShell', () => {
  it('uses cmd only for Windows command scripts', () => {
    expect(requiresWindowsShell('Desktop.exe')).toBe(false)
    expect(requiresWindowsShell('C:/tools/dsh.cmd')).toBe(true)
    expect(requiresWindowsShell('setup.bat')).toBe(true)
  })
})

describe('resolveDshLaunch', () => {
  it('runs the embedded CLI through Electron node mode by default', () => {
    expect(resolveDshLaunch({ executable: 'Desktop.exe', dshBin: 'app/dsh/lib/bin.js', port: '3080', env: {} })).toEqual({
      command: 'Desktop.exe',
      args: ['--expose-internals', 'app/dsh/lib/bin.js', 'web', '--host', '127.0.0.1', '--port', '3080'],
      env: { ELECTRON_RUN_AS_NODE: '1' },
    })
  })
  it('uses an explicit external DSH command without Electron node mode', () => {
    expect(resolveDshLaunch({ executable: 'Desktop.exe', dshBin: 'ignored', port: '4090', env: { DSH_DESKTOP_COMMAND: 'custom-dsh.cmd' } })).toEqual({
      command: 'custom-dsh.cmd',
      args: ['web', '--host', '127.0.0.1', '--port', '4090'],
      env: {},
    })
  })
})
