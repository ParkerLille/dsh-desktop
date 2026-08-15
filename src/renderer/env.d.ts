import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import type { DesktopBridge } from '../shared/desktop-bridge'

declare global {
  interface Window { desktop: DesktopBridge; __DSH_DESKTOP_PLUGIN_DISPOSE__?: () => void }
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { src?: string; partition?: string; onDomReady?: () => void }
    }
  }
}
export {}
