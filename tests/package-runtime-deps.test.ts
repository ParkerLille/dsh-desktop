import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>
}

describe('packaged DSH runtime dependencies', () => {
  it('includes worker-thread peer runtimes used by agent presets', () => {
    expect(manifest.dependencies).toMatchObject({
      '@deepseek-ai/dsh-code-runtime': '0.1.0-rc.6',
      '@deepseek-ai/dsh-compaction': '0.1.0-rc.6',
      '@deepseek-ai/dsh-workflow': '0.1.0-rc.6',
    })
  })
})
