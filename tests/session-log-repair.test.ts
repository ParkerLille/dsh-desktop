import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { analyzeInterruptedReplay, repairInterruptedReplay, repairSessionLogFile } from '../src/main/session-log-repair'

const zstdCompressSync = (zlib as typeof zlib & { zstdCompressSync(input: Uint8Array): Buffer }).zstdCompressSync

function frame(...records: object[]): Buffer {
  return zstdCompressSync(Buffer.from(records.map(record => JSON.stringify(record)).join('\n') + '\n'))
}

function corruptedLog(reason: 'interrupted' | 'completed' = 'interrupted'): Buffer {
  return Buffer.concat([
    frame({ type: 'session', version: 0, id: 'session-test', createdAt: 1 }),
    frame({ type: 'step/start', seq: 0, time: 2, data: { turn: 0, step: 0 } }),
    frame(
      { type: 'step/end', seq: 1, time: 3, data: { turn: 0, step: 0 } },
      { type: 'turn/end', seq: 2, time: 3, data: { turn: 0, reason: { kind: reason } } },
    ),
    frame(
      { type: 'assistant/chunk', seq: 1, time: 4, data: { turn: 0, step: 0, chunk: { type: 'block-start', index: 0, blockType: 'text' } } },
      { type: 'assistant/chunk', seq: 2, time: 4, data: { turn: 0, step: 0, chunk: { type: 'block-end', index: 0, block: { type: 'text', text: 'done' } } } },
      { type: 'assistant/message', seq: 3, time: 4, data: { turn: 0 } },
      { type: 'step/end', seq: 4, time: 4, data: { turn: 0, step: 0 } },
      { type: 'turn/end', seq: 5, time: 4, data: { turn: 0, reason: { kind: 'completed' } } },
    ),
  ])
}

describe('interrupted session replay recovery', () => {
  it('removes only the interrupted terminal frame replayed by the following frame', () => {
    const input = corruptedLog()
    const analysis = analyzeInterruptedReplay(input)

    expect(analysis).toMatchObject({
      status: 'repairable',
      conflict: { expected: 3, got: 1 },
      removed: { firstSeq: 1, lastSeq: 2 },
    })

    const repaired = repairInterruptedReplay(input)
    expect(repaired.buffer.length).toBeLessThan(input.length)
    expect(analyzeInterruptedReplay(repaired.buffer)).toMatchObject({ status: 'valid', lastSeq: 5 })
  })

  it('rejects an overlap whose prior turn was not interrupted', () => {
    expect(() => repairInterruptedReplay(corruptedLog('completed'))).toThrow(/not safely repairable/)
  })

  it('rejects an ordinary sequence gap', () => {
    const input = Buffer.concat([
      frame({ type: 'session', version: 0, id: 'session-test', createdAt: 1 }),
      frame({ type: 'step/start', seq: 0, time: 2, data: { turn: 0, step: 0 } }),
      frame({ type: 'assistant/message', seq: 2, time: 3, data: { turn: 0 } }),
    ])
    expect(() => repairInterruptedReplay(input)).toThrow(/not safely repairable/)
  })
})

describe('session log file recovery', () => {
  it('keeps dry-run read-only and backs up before applying the repair', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-session-repair-'))
    const path = join(directory, 'session.jsonl.zstd')
    const original = corruptedLog()
    await writeFile(path, original)

    const dryRun = await repairSessionLogFile(path, { apply: false, timestamp: '20260815T150000000Z' })
    expect(dryRun.backupPath).toBeNull()
    expect(await readFile(path)).toEqual(original)

    const expected = repairInterruptedReplay(original).buffer
    const applied = await repairSessionLogFile(path, { apply: true, timestamp: '20260815T150000000Z' })
    expect(applied.backupPath).toBe(path + '.bak-20260815T150000000Z')
    expect(await readFile(applied.backupPath!)).toEqual(original)
    expect(await readFile(path)).toEqual(expected)
  })
})
