import { describe, it, expect, beforeEach } from 'vitest'
import { AiWorkflowVersioningV2 } from '../ai-workflow-versioning-v2'

describe('AiWorkflowVersioningV2', () => {
  let svc: AiWorkflowVersioningV2
  beforeEach(() => { svc = new AiWorkflowVersioningV2() })

  it('FR-R628.1: registers version', () => {
    svc.registerVersion('wf1', 1, 0.9, 'baseline')
    expect(svc.getLatest('wf1')?.version).toBe(1)
  })

  it('FR-R628.2: blocks C grade', () => {
    expect(() => svc.registerVersion('wf1', 1, 0.9, 'x', 'C')).toThrow('BLOCKED')
  })

  it('FR-R628.2: blocks S grade', () => {
    expect(() => svc.registerVersion('wf1', 1, 0.9, 'x', 'S')).toThrow('BLOCKED')
  })

  it('FR-R628.3: returns latest version', () => {
    svc.registerVersion('wf1', 1, 0.9, 'a')
    svc.registerVersion('wf1', 2, 0.92, 'b')
    expect(svc.getLatest('wf1')?.version).toBe(2)
  })

  it('FR-R628.4: detects regression', () => {
    svc.registerVersion('wf1', 1, 0.9, 'a')
    svc.registerVersion('wf1', 2, 0.7, 'b')
    expect(svc.detectRegression('wf1', 0.1)).toBe(true)
  })

  it('FR-R628.5: audit log populated', () => {
    svc.registerVersion('wf1', 1, 0.9, 'a')
    expect(svc.getAuditLog().some(e => e.action === 'REGISTER_VERSION')).toBe(true)
  })
})
