import type { DshProcessStatus } from './contracts'

export interface DesktopBridge {
  dsh: {
    start(): Promise<DshProcessStatus>
    status(): Promise<DshProcessStatus>
    retry(): Promise<DshProcessStatus>
  }
}

export const IPC = {
  dshStart: 'dsh:start', dshStatus: 'dsh:status', dshRetry: 'dsh:retry',
} as const
