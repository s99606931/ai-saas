import { describe, it, expect, beforeEach } from 'vitest'
import { CyberSecurityAutomatorV2 } from '../cyber-security-automator-v2'

describe('CyberSecurityAutomatorV2', () => {
  let automator: CyberSecurityAutomatorV2

  beforeEach(() => {
    automator = new CyberSecurityAutomatorV2()
  })

  it('should register a policy', () => {
    automator.registerPolicy('pol1', 'IDS Policy', 'intrusion', 'high')
    expect(automator.getEventCount('pol1')).toBe(0)
  })

  it('should record event and increment count', () => {
    automator.registerPolicy('pol1', 'IDS', 'intrusion', 'medium')
    automator.recordEvent('pol1', 'intrusion_detected', '192.168.1.1')
    expect(automator.getEventCount('pol1')).toBe(1)
  })

  it('should count multiple events per policy', () => {
    automator.registerPolicy('pol1', 'Firewall', 'network', 'low')
    automator.recordEvent('pol1', 'port_scan', '10.0.0.1')
    automator.recordEvent('pol1', 'port_scan', '10.0.0.2')
    automator.recordEvent('pol1', 'ddos', '10.0.0.3')
    expect(automator.getEventCount('pol1')).toBe(3)
  })

  it('should return high severity policies', () => {
    automator.registerPolicy('pol1', 'Critical', 'network', 'high')
    automator.registerPolicy('pol2', 'Low', 'app', 'low')
    const highPols = automator.getHighSeverityPolicies()
    expect(highPols.map((p: { policyId: string }) => p.policyId)).toContain('pol1')
    expect(highPols.map((p: { policyId: string }) => p.policyId)).not.toContain('pol2')
  })

  it('should block C grade data', () => {
    automator.registerPolicy('pol1', 'Sensitive', 'data', 'high')
    expect(() => automator.recordEvent('pol1', 'access', 'src', 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    automator.registerPolicy('pol1', 'Sensitive', 'data', 'medium')
    expect(() => automator.recordEvent('pol1', 'access', 'src', 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    automator.registerPolicy('pol1', 'IDS', 'intrusion', 'high')
    automator.recordEvent('pol1', 'alert', 'host1')
    expect(automator.getAuditLog().length).toBeGreaterThan(0)
  })
})
