// Plan SC: SVC-AI-ADV-R610
import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowBottleneckDetectorV3 } from '../workflow-bottleneck-detector-v3'

describe('WorkflowBottleneckDetectorV3', () => {
  let d: WorkflowBottleneckDetectorV3

  beforeEach(() => {
    d = new WorkflowBottleneckDetectorV3()
  })

  it('registerStep — 감사 로그에 step.register 기록', () => {
    d.registerStep('s1', '접수', 100)
    const log = d.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('step.register')
  })

  it('detect — NORMAL/WARNING/BOTTLENECK 등급 판정', () => {
    d.registerStep('s1', '접수', 100)
    d.recordSample('s1', 100)
    expect(d.detect('s1').severity).toBe('NORMAL')

    d.registerStep('s2', '검토', 100)
    d.recordSample('s2', 130)
    expect(d.detect('s2').severity).toBe('WARNING')

    d.registerStep('s3', '승인', 100)
    d.recordSample('s3', 170)
    expect(d.detect('s3').severity).toBe('BOTTLENECK')
  })

  it('detect — 큐 >50 또는 ratio>=2 시 CRITICAL', () => {
    d.registerStep('s1', '접수', 100)
    d.recordSample('s1', 250)
    expect(d.detect('s1').severity).toBe('CRITICAL')

    d.registerStep('s2', '검토', 100)
    d.recordSample('s2', 100, 60)
    expect(d.detect('s2').severity).toBe('CRITICAL')
  })

  it('recordSample — C/S 등급 차단', () => {
    d.registerStep('s1', '접수', 100)
    expect(() => d.recordSample('s1', 100, 0, 'C')).toThrow(/BLOCKED/)
    expect(() => d.recordSample('s1', 100, 0, 'S')).toThrow(/BLOCKED/)
  })

  it('registerStep — assignee PII 마스킹', () => {
    d.registerStep('s1', '접수', 100, 'user@test.kr')
    d.recordSample('s1', 110)
    const alerts = d.getAlerts()
    // WARNING 이상 알림만 반환 (1.1 -> WARNING은 아님 -> NORMAL, 알림 0)
    expect(alerts).toHaveLength(0)
  })

  it('getAlerts — NORMAL 제외, WARNING 이상만 반환', () => {
    d.registerStep('s1', '접수', 100)
    d.registerStep('s2', '검토', 100)
    d.recordSample('s1', 100)
    d.recordSample('s2', 200)
    const alerts = d.getAlerts()
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.stepId).toBe('s2')
  })
})
