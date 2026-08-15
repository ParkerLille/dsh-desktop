import { resolve } from 'node:path'
import { repairSessionLogFile } from '../src/main/session-log-repair.ts'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const paths = args.filter(argument => argument !== '--apply')
if (paths.length !== 1) {
  console.error('Usage: pnpm repair:session <session.jsonl.zstd> [--apply]')
  process.exitCode = 2
} else {
  try {
    const path = resolve(paths[0])
    const result = await repairSessionLogFile(path, { apply })
    console.log(JSON.stringify({ path, mode: apply ? 'applied' : 'dry-run', ...result }, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
