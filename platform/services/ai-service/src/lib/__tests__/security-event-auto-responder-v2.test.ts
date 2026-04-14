import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityEventAutoResponderV2 } from '../security-event-auto-responder-v2'

describe('SecurityEventAutoResponderV2', () => {
  let responder: SecurityEventAutoResponderV2

  beforeEach(() => {
    responder = new SecurityEventAutoResponderV2()
  })

  it('should register an event type', () => {
    responder.registerEventType('type1', 'DDoS', 'critical')
    expect(responder.getAuditLog().length).toBeGreaterThan(0)
  })

  it('should record an event', () => {
    responder.registerEventType('type1', 'Intrusion', 'high')
    responder.recordEvent('evt1', 'type1', '192.168.1.1')
    expect(responder.getUnrespondedHighRiskEvents()).toHaveLength(1)
  })

  it('should return correct response action for high severity', () => {
    responder.registerEventType('type1', 'Intrusion', 'high')
    responder.recordEvent('evt1', 'type1', '10.0.0.1')
    expect(responder.getResponseAction('evt1')).toBe('즉시 격리')
  })

  it('should mark event as responded after getResponseAction', () => {
    responder.registerEventType('type1', 'Intrusion', 'high')
    responder.recordEvent('evt1', 'type1', '10.0.0.1')
    responder.getResponseAction('evt1')
    expect(responder.getUnrespondedHighRiskEvents()).toHaveLength(0)
  })

  it('should not include low severity events in unresponded high risk list', () => {
    responder.registerEventType('type1', 'Minor', 'low')
    responder.recordEvent('evt1', 'type1', 'host1')
    expect(responder.getUnrespondedHighRiskEvents()).toHaveLength(0)
  })

  it('should block C grade data', () => {
    responder.registerEventType('type1', 'X', 'medium')
    expect(() => responder.recordEvent('evt1', 'type1', 'src', 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    responder.registerEventType('type1', 'X', 'medium')
    expect(() => responder.recordEvent('evt1', 'type1', 'src', 'S')).toThrow('BLOCKED')
  })

  it('should include critical events in unresponded high risk list', () => {
    responder.registerEventType('type1', 'Critical', 'critical')
    responder.recordEvent('evt1', 'type1', 'host1')
    expect(responder.getUnrespondedHighRiskEvents()).toHaveLength(1)
  })
})
