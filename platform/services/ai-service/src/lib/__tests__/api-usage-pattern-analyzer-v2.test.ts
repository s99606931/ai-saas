import { describe, it, expect, beforeEach } from 'vitest'
import { ApiUsagePatternAnalyzerV2 } from '../api-usage-pattern-analyzer-v2'

describe('ApiUsagePatternAnalyzerV2', () => {
  let analyzer: ApiUsagePatternAnalyzerV2

  beforeEach(() => {
    analyzer = new ApiUsagePatternAnalyzerV2()
  })

  it('데이터 없으면 기본값 반환', () => {
    const result = analyzer.analyze('API-1')
    expect(result.totalCalls).toBe(0)
    expect(result.trend).toBe('STABLE')
  })

  it('성공률 계산', () => {
    for (let i = 0; i < 8; i++) {
      analyzer.ingest({ apiId: 'API-1', endpoint: '/api/data', method: 'GET', clientId: 'C-1', responseTimeMs: 100, statusCode: 200, timestamp: Date.now() })
    }
    for (let i = 0; i < 2; i++) {
      analyzer.ingest({ apiId: 'API-1', endpoint: '/api/data', method: 'GET', clientId: 'C-1', responseTimeMs: 100, statusCode: 500, timestamp: Date.now() })
    }
    const result = analyzer.analyze('API-1')
    expect(result.successRate).toBeCloseTo(0.8)
  })

  it('p95 레이턴시 계산', () => {
    for (let i = 1; i <= 100; i++) {
      analyzer.ingest({ apiId: 'API-2', endpoint: '/api/x', method: 'GET', clientId: 'C-1', responseTimeMs: i * 10, statusCode: 200, timestamp: Date.now() })
    }
    const result = analyzer.analyze('API-2')
    expect(result.p95ResponseTimeMs).toBeGreaterThanOrEqual(900)
  })

  it('GROWING 트렌드 탐지', () => {
    for (let i = 0; i < 5; i++) {
      analyzer.ingest({ apiId: 'API-3', endpoint: '/api/y', method: 'GET', clientId: 'C-1', responseTimeMs: 50, statusCode: 200, timestamp: Date.now() })
    }
    for (let i = 0; i < 10; i++) {
      analyzer.ingest({ apiId: 'API-3', endpoint: '/api/y', method: 'GET', clientId: 'C-2', responseTimeMs: 50, statusCode: 200, timestamp: Date.now() })
    }
    const result = analyzer.analyze('API-3')
    expect(result.trend).toBe('GROWING')
  })

  it('이상 클라이언트 탐지', () => {
    for (let i = 0; i < 3; i++) {
      analyzer.ingest({ apiId: 'API-4', endpoint: '/api/z', method: 'GET', clientId: 'NORMAL', responseTimeMs: 100, statusCode: 200, timestamp: Date.now() })
    }
    for (let i = 0; i < 50; i++) {
      analyzer.ingest({ apiId: 'API-4', endpoint: '/api/z', method: 'GET', clientId: 'ABUSER', responseTimeMs: 100, statusCode: 200, timestamp: Date.now() })
    }
    const anomalies = analyzer.detectAnomalies('API-4')
    expect(anomalies.anomalies.some((a) => a.clientId === 'ABUSER')).toBe(true)
  })

  it('감사 로그 복사본 반환', () => {
    analyzer.ingest({ apiId: 'API-5', endpoint: '/test', method: 'GET', clientId: 'C', responseTimeMs: 50, statusCode: 200, timestamp: Date.now() })
    analyzer.analyze('API-5')
    const log = analyzer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', apiId: 'X', detail: {} })
    expect(analyzer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
