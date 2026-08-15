export interface DshLaunchOptions {
  executable: string
  dshBin: string
  port: string
  env: NodeJS.ProcessEnv
}
export interface DshLaunch {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
}
export function requiresWindowsShell(command: string): boolean {
  return /\.(?:cmd|bat)$/i.test(command)
}

export function resolveDshLaunch(options: DshLaunchOptions): DshLaunch {
  const common = ['web', '--host', '127.0.0.1', '--port', options.port]
  const external = options.env.DSH_DESKTOP_COMMAND
  if (external) return { command: external, args: common, env: {} }
  return { command: options.executable, args: ['--expose-internals', options.dshBin, ...common], env: { ELECTRON_RUN_AS_NODE: '1' } }
}
