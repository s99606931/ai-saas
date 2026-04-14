import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimePerformanceDashboardAi } from '../realtime-performance-dashboard-ai'

describe('RealtimePerformanceDashboardAi', () => {
  let dashboard: RealtimePerformanceDashboardAi

  beforeEach(() => {
    dashboard = new RealtimePerformanceDashboardAi()
  })

  it('should register a panel', () => {
    dashboard.registerPanel('p1', 'CPU Usage', 'cpu', 80)
    const value = dashboard.getCurrentValue('p1')
    expect(value).toBe(0)
  })

  it('should update metric for a panel', () => {
    dashboard.registerPanel('p1', 'Memory', 'memory', 90)
    dashboard.updateMetric('p1', 75)
    expect(dashboard.getCurrentValue('p1')).toBe(75)
  })

  it('should detect alerting panel when value exceeds threshold', () => {
    dashboard.registerPanel('p1', 'CPU', 'cpu', 80)
    dashboard.updateMetric('p1', 85)
    const alerting = dashboard.getAlertingPanels()
    expect(alerting).toHaveLength(1)
    expect(alerting[0]!.panelId).toBe('p1')
  })

  it('should not alert when value is below threshold', () => {
    dashboard.registerPanel('p1', 'CPU', 'cpu', 80)
    dashboard.updateMetric('p1', 70)
    expect(dashboard.getAlertingPanels()).toHaveLength(0)
  })

  it('should block C grade data', () => {
    dashboard.registerPanel('p1', 'Score', 'latency', 100)
    expect(() => dashboard.updateMetric('p1', 50, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    dashboard.registerPanel('p1', 'Score', 'latency', 100)
    expect(() => dashboard.updateMetric('p1', 50, 'S')).toThrow('BLOCKED')
  })

  it('should track audit log', () => {
    dashboard.registerPanel('p1', 'RPS', 'throughput', 1000)
    dashboard.updateMetric('p1', 1200)
    const log = dashboard.getAuditLog()
    expect(log.length).toBeGreaterThan(0)
  })

  it('should return multiple alerting panels', () => {
    dashboard.registerPanel('p1', 'CPU', 'cpu', 80)
    dashboard.registerPanel('p2', 'Mem', 'memory', 70)
    dashboard.updateMetric('p1', 90)
    dashboard.updateMetric('p2', 75)
    expect(dashboard.getAlertingPanels()).toHaveLength(2)
  })
})
