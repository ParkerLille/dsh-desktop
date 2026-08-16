import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import type { DesktopBridge } from '../shared/desktop-bridge'

declare global {
  interface Window { desktop: DesktopBridge }
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { src?: string; partition?: string; onDomReady?: () => void }
    }
  }
}
export {}
