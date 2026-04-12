import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeTranslationStreamer } from '../realtime-translation-streamer'

describe('RealtimeTranslationStreamer', () => {
  let streamer: RealtimeTranslationStreamer

  beforeEach(() => {
    streamer = new RealtimeTranslationStreamer()
  })

  it('N2SF C등급 번역 차단', () => {
    expect(() => streamer.translate('기밀 내용', 'ko', 'en', 'C')).toThrow('BLOCKED')
  })

  it('N2SF S등급 번역 차단', () => {
    expect(() => streamer.translate('비밀 내용', 'ko', 'en', 'S')).toThrow('BLOCKED')
  })

  it('문장 분리: 마침표 기준', () => {
    const chunks = streamer.getChunks('안녕하세요. 반갑습니다. 도움이 필요하신가요.')
    expect(chunks.length).toBe(3)
    expect(chunks[0]).toBe('안녕하세요')
  })

  it('AsyncGenerator 스트림에서 모든 청크 수집', async () => {
    const result = streamer.translate('Hello. World. Test.', 'en', 'ko', 'O')
    expect(result.totalChunks).toBe(3)
    const chunks = await streamer.collectChunks(result)
    expect(chunks.length).toBe(3)
  })

  it('청크 progress는 1/N ~ N/N 범위', async () => {
    const result = streamer.translate('A. B. C. D.', 'en', 'ko', 'O')
    const chunks = await streamer.collectChunks(result)
    expect(chunks[0]!.progress).toBeCloseTo(0.25)
    expect(chunks[3]!.progress).toBeCloseTo(1.0)
  })

  it('모의 번역 형식: [locale] original', async () => {
    const result = streamer.translate('Hello.', 'en', 'ko', 'O')
    const chunks = await streamer.collectChunks(result)
    expect(chunks[0]!.translated).toBe('[ko] Hello')
  })

  it('감사 로그 복사본 반환', async () => {
    const result = streamer.translate('Test.', 'en', 'ko', 'O')
    await streamer.collectChunks(result)
    const log = streamer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', requestId: 'X', detail: {} })
    expect(streamer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
