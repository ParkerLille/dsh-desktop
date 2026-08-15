export const DESKTOP_PLUGIN_API_VERSION = 1 as const

export interface DesktopPluginManifest {
  id: string
  name: string
  description: string
  version: string
  apiVersion: typeof DESKTOP_PLUGIN_API_VERSION
  enabled: boolean
}

export interface DesktopPluginRecord {
  manifest: DesktopPluginManifest
  source: string
  updatedAt: string
}

export interface CreatePluginInput { name: string; description: string }
export interface UpdatePluginInput { source?: string; name?: string; description?: string }
export type DshOwnership = 'external' | 'desktop'
export type DshProcessPhase = 'idle' | 'starting' | 'ready' | 'failed'
export interface DshProcessStatus { phase: DshProcessPhase; ownership: DshOwnership | null; url: string; error?: string }
export interface PluginActivationResult { id: string; error?: string }
