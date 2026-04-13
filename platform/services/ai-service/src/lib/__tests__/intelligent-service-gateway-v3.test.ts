import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentServiceGatewayV3 } from '../intelligent-service-gateway-v3'

describe('IntelligentServiceGatewayV3', () => {
  let gateway: IntelligentServiceGatewayV3

  beforeEach(() => {
    gateway = new IntelligentServiceGatewayV3()
  })

  it('라우트 등록 후 요청 허용', () => {
    gateway.registerRoute('route-1', '/api/users', 'user-service', 10)
    const result = gateway.processRequest('/api/users', 'client-1')
    expect(result.allowed).toBe(true)
    expect(result.targetService).toBe('user-service')
  })

  it('등록되지 않은 경로 요청 거부', () => {
    const result = gateway.processRequest('/unknown', 'client-1')
    expect(result.allowed).toBe(false)
  })

  it('rate limit 초과 시 요청 거부', () => {
    gateway.registerRoute('route-1', '/api/data', 'data-service', 2)
    gateway.processRequest('/api/data', 'client-1')
    gateway.processRequest('/api/data', 'client-1')
    const result = gateway.processRequest('/api/data', 'client-1')
    expect(result.allowed).toBe(false)
  })

  it('다른 클라이언트는 독립적으로 rate limit 적용', () => {
    gateway.registerRoute('route-1', '/api/data', 'data-service', 2)
    gateway.processRequest('/api/data', 'client-1')
    gateway.processRequest('/api/data', 'client-1')
    const result = gateway.processRequest('/api/data', 'client-2')
    expect(result.allowed).toBe(true)
  })

  it('getRouteStats: 요청 수 집계', () => {
    gateway.registerRoute('route-1', '/api/users', 'user-service', 10)
    gateway.processRequest('/api/users', 'client-1')
    gateway.processRequest('/api/users', 'client-1')
    const stats = gateway.getRouteStats('route-1')
    expect(stats.totalRequests).toBe(2)
  })

  it('getRouteStats: 거부 요청 집계', () => {
    gateway.registerRoute('route-1', '/api/data', 'data-service', 1)
    gateway.processRequest('/api/data', 'client-1')
    gateway.processRequest('/api/data', 'client-1')
    const stats = gateway.getRouteStats('route-1')
    expect(stats.rejectedRequests).toBe(1)
  })

  it('C등급 데이터 전송 차단', () => {
    gateway.registerRoute('route-1', '/api/users', 'user-service', 10)
    expect(() => gateway.processRequest('/api/users', 'client-1', 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    gateway.registerRoute('route-1', '/api/users', 'user-service', 10)
    gateway.processRequest('/api/users', 'client-1')
    const log = gateway.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
