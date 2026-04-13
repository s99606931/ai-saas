import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentServiceGatewayV2, type GatewayRoute, type GatewayRequest } from '../intelligent-service-gateway-v2'

describe('IntelligentServiceGatewayV2', () => {
  let gateway: IntelligentServiceGatewayV2
  const now = Date.now()

  const route: GatewayRoute = {
    routeId: 'ROUTE001',
    path: '/api/v1/complaints',
    targetServiceId: 'SVC-COMPLAINT',
    authRequired: true,
    rateLimit: 60,
    dataGrade: 'O',
    timeoutMs: 3000,
  }

  const request: GatewayRequest = {
    requestId: 'REQ001',
    routeId: 'ROUTE001',
    clientId: 'CLIENT001',
    timestamp: now,
  }

  beforeEach(() => {
    gateway = new IntelligentServiceGatewayV2()
    gateway.registerRoute(route)
  })

  it('라우트 등록 감사 로그', () => {
    const log = gateway.getAuditLog()
    expect(log.some((e) => e.action === 'route.register')).toBe(true)
  })

  it('O등급 정상 요청 → ALLOW', () => {
    const result = gateway.process(request)
    expect(result.decision).toBe('ALLOW')
  })

  it('C등급 라우트 + payload → BLOCK_DATA_GRADE', () => {
    gateway.registerRoute({ ...route, routeId: 'ROUTE002', dataGrade: 'C' })
    const result = gateway.process({ ...request, routeId: 'ROUTE002', payload: { data: '민감정보' } })
    expect(result.decision).toBe('BLOCK_DATA_GRADE')
    expect(result.reason).toContain('N2SF')
  })

  it('S등급 라우트 + payload → BLOCK_DATA_GRADE', () => {
    gateway.registerRoute({ ...route, routeId: 'ROUTE003', dataGrade: 'S' })
    const result = gateway.process({ ...request, routeId: 'ROUTE003', payload: { phone: '010-1234-5678' } })
    expect(result.decision).toBe('BLOCK_DATA_GRADE')
  })

  it('차단된 클라이언트 → DENY', () => {
    gateway.blockClient('CLIENT001')
    const result = gateway.process(request)
    expect(result.decision).toBe('DENY')
  })

  it('Rate limit 초과 → THROTTLE', () => {
    const limitedRoute: GatewayRoute = { ...route, routeId: 'ROUTE004', rateLimit: 2 }
    gateway.registerRoute(limitedRoute)
    gateway.process({ ...request, requestId: 'R1', routeId: 'ROUTE004' })
    gateway.process({ ...request, requestId: 'R2', routeId: 'ROUTE004' })
    const result = gateway.process({ ...request, requestId: 'R3', routeId: 'ROUTE004' })
    expect(result.decision).toBe('THROTTLE')
  })

  it('미등록 라우트 에러', () => {
    expect(() => gateway.process({ ...request, routeId: 'UNKNOWN' })).toThrow()
  })

  it('처리 후 감사 로그', () => {
    gateway.process(request)
    const log = gateway.getAuditLog()
    expect(log.some((e) => e.action === 'gateway.process')).toBe(true)
  })
})
