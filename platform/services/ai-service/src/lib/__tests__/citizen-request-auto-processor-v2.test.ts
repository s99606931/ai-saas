import { describe, it, expect, beforeEach } from 'vitest'
import { CitizenRequestAutoProcessorV2 } from '../citizen-request-auto-processor-v2'

describe('CitizenRequestAutoProcessorV2', () => {
  let processor: CitizenRequestAutoProcessorV2

  beforeEach(() => {
    processor = new CitizenRequestAutoProcessorV2()
  })

  it('민원 등록 후 pending 상태', () => {
    const req = processor.registerRequest('req-1', 'citizen-1', '주민등록', '주민등록 발급 신청')
    expect(req.requestId).toBe('req-1')
    expect(req.status).toBe('pending')
  })

  it('상태 업데이트', () => {
    processor.registerRequest('req-1', 'citizen-1', '주민등록', '신청')
    processor.updateStatus('req-1', 'processing')
    const pending = processor.getPendingRequests()
    expect(pending.map((r) => r.requestId)).not.toContain('req-1')
  })

  it('getPendingRequests: pending 상태만 반환', () => {
    processor.registerRequest('req-1', 'citizen-1', '주민등록', '신청')
    processor.registerRequest('req-2', 'citizen-2', '여권', '신청')
    processor.updateStatus('req-1', 'completed')
    const pending = processor.getPendingRequests()
    expect(pending.map((r) => r.requestId)).toContain('req-2')
    expect(pending.map((r) => r.requestId)).not.toContain('req-1')
  })

  it('getRequestTypeStats: 유형별 집계', () => {
    processor.registerRequest('req-1', 'c-1', '주민등록', '신청')
    processor.registerRequest('req-2', 'c-2', '주민등록', '신청')
    processor.registerRequest('req-3', 'c-3', '여권', '신청')
    const stats = processor.getRequestTypeStats()
    expect(stats['주민등록']).toBe(2)
    expect(stats['여권']).toBe(1)
  })

  it('C등급 데이터 전송 차단', () => {
    processor.registerRequest('req-1', 'citizen-1', '주민등록', '신청')
    expect(() => processor.updateStatus('req-1', 'processing', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    processor.registerRequest('req-1', 'citizen-1', '주민등록', '신청')
    expect(() => processor.updateStatus('req-1', 'processing', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    processor.registerRequest('req-1', 'citizen-1', '주민등록', '신청')
    processor.updateStatus('req-1', 'processing')
    const log = processor.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
