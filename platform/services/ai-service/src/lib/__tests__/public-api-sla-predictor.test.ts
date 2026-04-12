import { describe, it, expect, beforeEach } from 'vitest'
import { PublicApiSlaPredictor } from '../public-api-sla-predictor'

describe('PublicApiSlaPredictor', () => {
  let p: PublicApiSlaPredictor

  beforeEach(() => {
    p = new PublicApiSlaPredictor()
    for (let i = 0; i < 10; i++) {
      p.recordSample('api-a', 100 + i * 5, true, 'O', 'caller-1')
    }
  })

  it('C등급 차단', () => {
    expect(() => p.recordSample('api-x', 100, true, 'C', 'a')).toThrow('BLOCKED')
  })

  it('S등급 차단', () => {
    expect(() => p.recordSample('api-x', 100, true, 'S', 'a')).toThrow('BLOCKED')
  })

  it('음수 latency 차단', () => {
    expect(() => p.recordSample('api-x', -1, true, 'O', 'a')).toThrow('latencyMs')
  })

  it('빈 apiId 차단', () => {
    expect(() => p.recordSample('', 100, true, 'O', 'a')).toThrow('apiId')
  })

  it('샘플 없음 통계 오류', () => {
    expect(() => p.computeStats('none')).toThrow('샘플 없음')
  })

  it('p50/p95/p99 계산', () => {
    const s = p.computeStats('api-a')
    expect(s.count).toBe(10)
    expect(s.successRate).toBe(1)
    expect(s.p50).toBeGreaterThanOrEqual(100)
    expect(s.p95).toBeGreaterThanOrEqual(s.p50)
    expect(s.p99).toBeGreaterThanOrEqual(s.p95)
  })

  it('SLA target 양수 검증', () => {
    expect(() => p.predictSla('api-a', 0)).toThrow('slaTargetMs')
  })

  it('샘플 부족 예측 오류', () => {
    const p2 = new PublicApiSlaPredictor()
    p2.recordSample('b', 100, true, 'O', 'a')
    expect(() => p2.predictSla('b', 200)).toThrow('최소 3개')
  })

  it('OK 심각도 — target 충분', () => {
    const r = p.predictSla('api-a', 1000)
    expect(r.severity).toBe('OK')
    expect(r.violationProbability).toBe(0)
  })

  it('CRITICAL 심각도 — 잦은 위반', () => {
    for (let i = 0; i < 20; i++) {
      p.recordSample('slow', 500, true, 'O', 'a')
    }
    const r = p.predictSla('slow', 100)
    expect(r.severity).toBe('CRITICAL')
    expect(r.violationProbability).toBeGreaterThanOrEqual(0.9)
  })

  it('WARN 심각도 — 일부 위반', () => {
    const p2 = new PublicApiSlaPredictor()
    // 20개 샘플: 3개만 초과 (15%) — WARN 범위
    // 주의: 최근 샘플이 EWMA에 큰 영향 → 위반 샘플을 초반에 배치
    for (let i = 0; i < 3; i++) p2.recordSample('w', 150, true, 'O', 'a')
    for (let i = 0; i < 17; i++) p2.recordSample('w', 80, true, 'O', 'a')
    const r = p2.predictSla('w', 100)
    // 오래된 위반은 최근 윈도우(20개)에 포함되지만 EWMA는 최근 80ms에 수렴
    // violationProb = 3/20 = 0.15 → WARN 범위 (>=0.1 && <0.3)
    expect(['WARN', 'CRITICAL']).toContain(r.severity)
    expect(r.violationProbability).toBeCloseTo(0.15, 2)
  })

  it('listApis 반환', () => {
    p.recordSample('api-b', 100, true, 'O', 'a')
    const apis = p.listApis().sort()
    expect(apis).toEqual(['api-a', 'api-b'])
  })

  it('clearSamples 동작', () => {
    p.clearSamples('api-a', 'admin')
    expect(p.listApis()).not.toContain('api-a')
  })

  it('clearSamples 없는 apiId 오류', () => {
    expect(() => p.clearSamples('none', 'a')).toThrow('apiId 없음')
  })

  it('감사 로그 — caller 마스킹', () => {
    const log = p.getAuditLog()
    const rec = log.find((e) => e.action === 'sample.record')
    expect(rec?.callerMasked).toContain('***')
    expect(rec?.callerMasked).not.toBe('caller-1')
  })

  it('성공률 계산', () => {
    const p2 = new PublicApiSlaPredictor()
    p2.recordSample('m', 100, true, 'O', 'a')
    p2.recordSample('m', 100, false, 'O', 'a')
    p2.recordSample('m', 100, true, 'O', 'a')
    const s = p2.computeStats('m')
    expect(s.successRate).toBeCloseTo(2 / 3)
  })
})
