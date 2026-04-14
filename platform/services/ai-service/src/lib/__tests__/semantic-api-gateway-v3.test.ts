import { describe, it, expect, beforeEach } from 'vitest'
import { SemanticAPIGatewayV3 } from '../semantic-api-gateway-v3'

describe('SemanticAPIGatewayV3', () => {
  let gateway: SemanticAPIGatewayV3

  beforeEach(() => {
    gateway = new SemanticAPIGatewayV3()
  })

  it('N2SF C등급 라우팅 차단', () => {
    expect(() => gateway.route('민원', 3, 'C')).toThrow('BLOCKED')
  })

  it('키워드 매칭 → 후보 반환', () => {
    gateway.registerAPI({
      apiId: 'api.tax',
      description: '세금 신고',
      keywords: ['세금', '신고'],
    })
    const result = gateway.route('세금 신고 방법')
    expect(result.candidates.length).toBeGreaterThanOrEqual(1)
    expect(result.candidates[0]!.apiId).toBe('api.tax')
  })

  it('top-k 제한 적용', () => {
    gateway.registerAPI({ apiId: 'a1', description: 'A', keywords: ['세금'] })
    gateway.registerAPI({ apiId: 'a2', description: 'B', keywords: ['세금'] })
    gateway.registerAPI({ apiId: 'a3', description: 'C', keywords: ['세금'] })
    const result = gateway.route('세금 문의', 2)
    expect(result.candidates.length).toBe(2)
  })

  it('PII (전화번호) 마스킹', () => {
    gateway.registerAPI({ apiId: 'a4', description: 'D', keywords: ['민원'] })
    const result = gateway.route('민원 010-1234-5678')
    expect(result.utteranceMasked).not.toContain('010-1234-5678')
  })

  it('매칭 없음 → 빈 candidates', () => {
    gateway.registerAPI({ apiId: 'a5', description: 'E', keywords: ['세금'] })
    const result = gateway.route('전혀 다른 주제')
    expect(result.candidates.length).toBe(0)
  })

  it('빈 키워드 API 등록 거부', () => {
    expect(() =>
      gateway.registerAPI({ apiId: 'a6', description: 'F', keywords: [] }),
    ).toThrow('keyword')
  })

  it('감사 로그 복사본 반환', () => {
    gateway.registerAPI({ apiId: 'a7', description: 'G', keywords: ['x'] })
    const log = gateway.getAuditLog()
    log.push({ timestamp: '', action: 'injected', apiId: 'X', detail: {} })
    expect(gateway.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
