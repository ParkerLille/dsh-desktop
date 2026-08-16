export type DshOwnership = 'external' | 'desktop'
export type DshProcessPhase = 'idle' | 'starting' | 'ready' | 'failed'
export interface DshProcessStatus { phase: DshProcessPhase; ownership: DshOwnership | null; url: string; error?: string }
