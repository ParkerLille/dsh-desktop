import { constants } from 'node:fs'
import { copyFile, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import * as zlib from 'node:zlib'

const zstdDecompressSync = (zlib as typeof zlib & { zstdDecompressSync(input: Uint8Array): Buffer }).zstdDecompressSync
const ZSTD_MAGIC = 0xfd2fb528

interface FrameRange {
  start: number
  end: number
}

interface SequenceRange {
  first: number
  last: number
}

interface StoredRecord {
  type?: unknown
  seq?: unknown
  seq0?: unknown
  data?: {
    turn?: unknown
    reason?: { kind?: unknown }
    dt?: unknown
  }
}

interface ParsedFrame extends FrameRange {
  records: StoredRecord[]
  ranges: SequenceRange[]
}

export type SessionLogAnalysis =
  | { status: 'valid'; lastSeq: number }
  | {
      status: 'repairable'
      lastSeq: number
      conflict: { expected: number; got: number }
      removed: FrameRange & { firstSeq: number; lastSeq: number }
    }
  | { status: 'invalid'; message: string }

export interface SessionLogRepair {
  buffer: Buffer
  analysis: Extract<SessionLogAnalysis, { status: 'repairable' }>
}

function scanZstdFrames(buffer: Buffer): FrameRange[] {
  const frames: FrameRange[] = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 5) throw new Error('incomplete Zstandard frame at byte ' + start)
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error('invalid Zstandard frame magic at byte ' + offset)
    offset += 4

    const descriptor = buffer.readUInt8(offset++)
    if ((descriptor & 0x18) !== 0) throw new Error('reserved Zstandard frame-header bit at byte ' + (offset - 1))
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const headerBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < headerBytes) throw new Error('incomplete Zstandard frame header at byte ' + start)
    offset += headerBytes

    for (;;) {
      if (buffer.length - offset < 3) throw new Error('incomplete Zstandard block header at byte ' + start)
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      if (blockType === 3) throw new Error('reserved Zstandard block type at byte ' + (offset - 3))
      const blockSize = blockHeader >>> 3
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) throw new Error('incomplete Zstandard block at byte ' + start)
      offset += payloadBytes
      if (lastBlock) break
    }

    if (checksum) {
      if (buffer.length - offset < 4) throw new Error('incomplete Zstandard checksum at byte ' + start)
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

function sequenceRange(record: StoredRecord): SequenceRange | null {
  if (typeof record.seq === 'number') return { first: record.seq, last: record.seq }
  if (typeof record.seq0 !== 'number') return null
  if (!Array.isArray(record.data?.dt)) throw new Error('packed record at seq ' + record.seq0 + ' has no dt array')
  return { first: record.seq0, last: record.seq0 + record.data.dt.length }
}

function parseFrames(buffer: Buffer): ParsedFrame[] {
  return scanZstdFrames(buffer).map(frame => {
    const text = zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString('utf8')
    if (!text.endsWith('\n')) throw new Error('frame at byte ' + frame.start + ' has an incomplete JSONL record')
    const records = text.slice(0, -1).split('\n').map((line, index) => {
      try {
        return JSON.parse(line) as StoredRecord
      } catch {
        throw new Error('frame at byte ' + frame.start + ' contains invalid JSON at row ' + (index + 1))
      }
    })
    return { ...frame, records, ranges: records.map(sequenceRange).filter((range): range is SequenceRange => range !== null) }
  })
}

function validateSequence(frames: ParsedFrame[]): { lastSeq: number; gap?: { expected: number; got: number; frameIndex: number } } {
  let expected = 0
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    for (const range of frames[frameIndex].ranges) {
      if (range.first !== expected) return { lastSeq: expected - 1, gap: { expected, got: range.first, frameIndex } }
      expected = range.last + 1
    }
  }
  return { lastSeq: expected - 1 }
}

function isInterruptedTerminalFrame(frame: ParsedFrame, firstSeq: number, lastSeq: number): boolean {
  if (frame.records.length !== 2 || frame.ranges.length !== 2) return false
  const [stepEnd, turnEnd] = frame.records
  const [stepRange, turnRange] = frame.ranges
  return stepEnd.type === 'step/end'
    && turnEnd.type === 'turn/end'
    && turnEnd.data?.reason?.kind === 'interrupted'
    && stepEnd.data?.turn === turnEnd.data?.turn
    && stepRange.first === firstSeq
    && stepRange.last === firstSeq
    && turnRange.first === lastSeq
    && turnRange.last === lastSeq
}

export function analyzeInterruptedReplay(buffer: Buffer): SessionLogAnalysis {
  try {
    const frames = parseFrames(buffer)
    const validation = validateSequence(frames)
    if (!validation.gap) return { status: 'valid', lastSeq: validation.lastSeq }

    const { expected, got, frameIndex } = validation.gap
    const removedFrame = frames[frameIndex - 1]
    if (frameIndex === 0 || !removedFrame || got >= expected) {
      return { status: 'invalid', message: 'sequence gap: expected ' + expected + ', got ' + got }
    }
    if (!isInterruptedTerminalFrame(removedFrame, got, expected - 1)) {
      return { status: 'invalid', message: 'sequence overlap is not an interrupted terminal replay: expected ' + expected + ', got ' + got }
    }

    const repairedBuffer = Buffer.concat([buffer.subarray(0, removedFrame.start), buffer.subarray(removedFrame.end)])
    const repairedValidation = validateSequence(parseFrames(repairedBuffer))
    if (repairedValidation.gap) {
      return { status: 'invalid', message: 'repair leaves a sequence gap: expected ' + repairedValidation.gap.expected + ', got ' + repairedValidation.gap.got }
    }
    return {
      status: 'repairable',
      lastSeq: repairedValidation.lastSeq,
      conflict: { expected, got },
      removed: { start: removedFrame.start, end: removedFrame.end, firstSeq: got, lastSeq: expected - 1 },
    }
  } catch (error) {
    return { status: 'invalid', message: error instanceof Error ? error.message : String(error) }
  }
}

export function repairInterruptedReplay(buffer: Buffer): SessionLogRepair {
  const analysis = analyzeInterruptedReplay(buffer)
  if (analysis.status !== 'repairable') {
    const detail = analysis.status === 'invalid' ? analysis.message : 'the log is already valid'
    throw new Error('session log is not safely repairable: ' + detail)
  }
  const repaired = Buffer.concat([
    buffer.subarray(0, analysis.removed.start),
    buffer.subarray(analysis.removed.end),
  ])
  return { buffer: repaired, analysis }
}

export interface SessionLogFileRepairOptions {
  apply: boolean
  timestamp?: string
}

export interface SessionLogFileRepairResult {
  analysis: Extract<SessionLogAnalysis, { status: 'repairable' }>
  backupPath: string | null
}

function repairTimestamp(): string {
  return new Date().toISOString().replace(/[-:.]/g, '')
}

export async function repairSessionLogFile(path: string, options: SessionLogFileRepairOptions): Promise<SessionLogFileRepairResult> {
  const original = await readFile(path)
  const repaired = repairInterruptedReplay(original)
  if (!options.apply) return { analysis: repaired.analysis, backupPath: null }

  const timestamp = options.timestamp ?? repairTimestamp()
  const backupPath = path + '.bak-' + timestamp
  const temporaryPath = path + '.repair-' + process.pid + '-' + timestamp + '.tmp'
  await copyFile(path, backupPath, constants.COPYFILE_EXCL)
  try {
    await writeFile(temporaryPath, repaired.buffer, { flag: 'wx' })
    const handle = await open(temporaryPath, 'r+')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporaryPath, path)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
  return { analysis: repaired.analysis, backupPath }
}
