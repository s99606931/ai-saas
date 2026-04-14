import { describe, it, expect, beforeEach } from 'vitest'
import { ApiResponseQualityEvaluatorV2 } from '../api-response-quality-evaluator-v2'

describe('ApiResponseQualityEvaluatorV2', () => {
  let evaluator: ApiResponseQualityEvaluatorV2

  beforeEach(() => {
    evaluator = new ApiResponseQualityEvaluatorV2()
  })

  it('엔드포인트 등록 후 조회 가능', () => {
    const ep = evaluator.registerEndpoint('ep-1', '/api/users', 'GET')
    expect(ep.endpointId).toBe('ep-1')
    expect(ep.path).toBe('/api/users')
  })

  it('응답 없으면 품질 점수 100', () => {
    evaluator.registerEndpoint('ep-1', '/api/users', 'GET')
    expect(evaluator.getQualityScore('ep-1')).toBe(100)
  })

  it('모두 2xx + 낮은 레이턴시: 높은 점수', () => {
    evaluator.registerEndpoint('ep-1', '/api/users', 'GET')
    evaluator.recordResponse('ep-1', 200, 100)
    const score = evaluator.getQualityScore('ep-1')
    expect(score).toBeGreaterThan(60)
  })

  it('모두 5xx: 낮은 점수', () => {
    evaluator.registerEndpoint('ep-1', '/api/error', 'GET')
    evaluator.recordResponse('ep-1', 500, 100)
    evaluator.recordResponse('ep-1', 503, 100)
    const score = evaluator.getQualityScore('ep-1')
    expect(score).toBeLessThan(60)
  })

  it('getLowQualityEndpoints: score < 60', () => {
    evaluator.registerEndpoint('ep-1', '/api/good', 'GET')
    evaluator.registerEndpoint('ep-2', '/api/bad', 'GET')
    evaluator.recordResponse('ep-1', 200, 100)
    evaluator.recordResponse('ep-2', 500, 100)
    evaluator.recordResponse('ep-2', 500, 100)
    const low = evaluator.getLowQualityEndpoints()
    expect(low.map((e) => e.endpointId)).toContain('ep-2')
    expect(low.map((e) => e.endpointId)).not.toContain('ep-1')
  })

  it('C등급 데이터 전송 차단', () => {
    evaluator.registerEndpoint('ep-1', '/api/users', 'GET')
    expect(() => evaluator.recordResponse('ep-1', 200, 100, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    evaluator.registerEndpoint('ep-1', '/api/users', 'GET')
    expect(() => evaluator.recordResponse('ep-1', 200, 100, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    evaluator.registerEndpoint('ep-1', '/api/users', 'GET')
    evaluator.recordResponse('ep-1', 200, 100)
    const log = evaluator.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
