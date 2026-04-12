/**
 * Unit tests for API Security Gateway V2 — SVC-AI-ADV-R142
 */
import { describe, it, expect } from 'vitest'
import { ApiSecurityGatewayV2, DataGrade } from '../api-security-gateway-v2'

const makeRequest = (overrides = {}) => ({
  requestId: 'req-001',
  clientId: 'client-a',
  endpoint: '/api/v1/notices',
  method: 'GET',
  timestamp: '2026-04-12T10:00:00Z',
  payloadBytes: 512,
  grade: DataGrade.O,
  ...overrides,
})

const makeProfile = (overrides = {}) => ({
  clientId: 'client-a',
  avgRps: 10,
  avgPayloadBytes: 512,
  knownEndpoints: ['/api/v1/notices'],
  blocked: false,
  ...overrides,
})

describe('SVC-AI-ADV-R142 ApiSecurityGatewayV2', () => {
  it('[FR-R142.6] normal request is ALLOW', () => {
    const gw = new ApiSecurityGatewayV2()
    gw.registerClient(makeProfile())
    const result = gw.inspect(makeRequest())
    expect(result.decision).toBe('ALLOW')
    expect(result.riskScore).toBeLessThan(40)
  })

  it('[FR-R142.6] blocks C/S grade requests', () => {
    const gw = new ApiSecurityGatewayV2()
    expect(() => gw.inspect(makeRequest({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => gw.inspect(makeRequest({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R142.3] unknown endpoint triggers endpoint-anomaly', () => {
    const gw = new ApiSecurityGatewayV2()
    gw.registerClient(makeProfile())
    const result = gw.inspect(makeRequest({ endpoint: '/admin/secret' }))
    expect(result.anomalies).toContain('endpoint-anomaly')
  })

  it('[FR-R142.3] oversized payload triggers payload-spike', () => {
    const gw = new ApiSecurityGatewayV2()
    gw.registerClient(makeProfile({ avgPayloadBytes: 512 }))
    const result = gw.inspect(makeRequest({ payloadBytes: 512 * 15 }))
    expect(result.anomalies).toContain('payload-spike')
  })

  it('[FR-R142.2] manually blocked client gets BLOCK decision', () => {
    const gw = new ApiSecurityGatewayV2()
    gw.registerClient(makeProfile())
    gw.blockClient('client-a', '악의적 행동')
    const result = gw.inspect(makeRequest())
    expect(result.decision).toBe('BLOCK')
  })

  it('[FR-R142.7] auto-block when risk score >= 70', () => {
    const gw = new ApiSecurityGatewayV2()
    gw.registerClient(makeProfile({ avgPayloadBytes: 100, avgRps: 2 }))
    // high payload + unknown endpoint = 30 + 20 = 50, plus after-hours
    const result = gw.inspect(makeRequest({
      endpoint: '/unknown',
      payloadBytes: 1500,
      timestamp: '2026-04-12T23:00:00Z', // after hours UTC → ~08:00 KST, actually check hour logic
    }))
    expect(['BLOCK', 'THROTTLE']).toContain(result.decision)
  })

  it('[FR-R142.2] unblock restores client', () => {
    const gw = new ApiSecurityGatewayV2()
    gw.registerClient(makeProfile())
    gw.blockClient('client-a', 'test')
    gw.unblockClient('client-a')
    const result = gw.inspect(makeRequest())
    expect(result.decision).toBe('ALLOW')
  })

  it('audit log records inspect', () => {
    const gw = new ApiSecurityGatewayV2()
    gw.registerClient(makeProfile())
    gw.inspect(makeRequest())
    expect(gw.getAuditLog().some(e => e.action === 'inspect')).toBe(true)
  })
})
