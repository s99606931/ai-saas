import { describe, it, expect, beforeEach } from 'vitest'
import { ApiMonitoringV2 } from '../api-monitoring-v2'

describe('ApiMonitoringV2', () => {
  let monitor: ApiMonitoringV2

  beforeEach(() => { monitor = new ApiMonitoringV2() })

  it('should register an endpoint', () => {
    monitor.registerEndpoint('ep1', '/api/users', 'GET')
    expect(monitor.getAverageLatency('ep1')).toBe(0)
  })

  it('should compute average latency', () => {
    monitor.registerEndpoint('ep1', '/api/users', 'GET')
    monitor.recordMetric('ep1', 100, 200)
    monitor.recordMetric('ep1', 200, 200)
    expect(monitor.getAverageLatency('ep1')).toBe(150)
  })

  it('should compute error rate (5xx / total * 100)', () => {
    monitor.registerEndpoint('ep1', '/api/data', 'POST')
    monitor.recordMetric('ep1', 100, 200)
    monitor.recordMetric('ep1', 150, 500)
    expect(monitor.getErrorRate('ep1')).toBe(50)
  })

  it('should identify high latency endpoints', () => {
    monitor.registerEndpoint('ep1', '/slow', 'GET')
    monitor.registerEndpoint('ep2', '/fast', 'GET')
    monitor.recordMetric('ep1', 600, 200)
    monitor.recordMetric('ep2', 50, 200)
    const high = monitor.getHighLatencyEndpoints(500)
    expect(high.map((e: { endpointId: string }) => e.endpointId)).toContain('ep1')
    expect(high.map((e: { endpointId: string }) => e.endpointId)).not.toContain('ep2')
  })

  it('should block C grade data', () => {
    monitor.registerEndpoint('ep1', '/x', 'GET')
    expect(() => monitor.recordMetric('ep1', 100, 200, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    monitor.registerEndpoint('ep1', '/x', 'GET')
    expect(() => monitor.recordMetric('ep1', 100, 200, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    monitor.registerEndpoint('ep1', '/api', 'GET')
    monitor.recordMetric('ep1', 100, 200)
    expect(monitor.getAuditLog().length).toBeGreaterThan(0)
  })
})
