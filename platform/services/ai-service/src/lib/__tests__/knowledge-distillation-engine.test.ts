/**
 * Unit tests for Knowledge Distillation Engine — SVC-AI-ADV-R103
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeDistillationEngine } from '../knowledge-distillation-engine'

describe('SVC-AI-ADV-R103 KnowledgeDistillationEngine', () => {
  it('[FR-R103.1] registers a distillation job', () => {
    const e = new KnowledgeDistillationEngine()
    const job = e.registerDistillationJob('j1', 'claude-opus', 'phi-3-mini')
    expect(job.jobId).toBe('j1')
    expect(job.samples).toEqual([])
  })

  it('[FR-R103.1] throws on duplicate job', () => {
    const e = new KnowledgeDistillationEngine()
    e.registerDistillationJob('j1', 't', 's')
    expect(() => e.registerDistillationJob('j1', 't', 's')).toThrow(/already/)
  })

  it('[FR-R103.2/N2SF N-05] blocks C grade input', () => {
    const e = new KnowledgeDistillationEngine()
    e.registerDistillationJob('j1', 't', 's')
    expect(() => e.addSample('j1', 'p', 'to', 'so', 'C')).toThrow(/BLOCKED/)
    expect(() => e.addSample('j1', 'p', 'to', 'so', 'S')).toThrow(/BLOCKED/)
  })

  it('[FR-R103.2] adds sample and computes agreement', () => {
    const e = new KnowledgeDistillationEngine()
    e.registerDistillationJob('j1', 't', 's')
    const s = e.addSample(
      'j1',
      '민원 신청 절차는?',
      '절차는 방문 신청',
      '절차는 방문 신청',
      'O',
    )
    expect(s.agreementScore).toBe(1)
  })

  it('[FR-R103.3] computes average agreement across samples', () => {
    const e = new KnowledgeDistillationEngine()
    e.registerDistillationJob('j1', 't', 's')
    e.addSample('j1', 'p1', 'hello world', 'hello world', 'O') // 1.0
    e.addSample('j1', 'p2', 'cat dog', 'fish bird', 'O') // 0.0
    const avg = e.computeAgreement('j1')
    expect(avg).toBeCloseTo(0.5, 5)
  })

  it('[FR-R103.4] selects high-value (low-agreement) samples first', () => {
    const e = new KnowledgeDistillationEngine()
    e.registerDistillationJob('j1', 't', 's')
    e.addSample('j1', 'p1', 'a b c', 'a b c', 'O') // 1.0
    e.addSample('j1', 'p2', 'a b c', 'x y z', 'O') // 0.0
    e.addSample('j1', 'p3', 'a b c', 'a b d', 'O') // 0.5
    const top2 = e.selectHighValueSamples('j1', 2)
    expect(top2).toHaveLength(2)
    expect(top2[0]!.agreementScore).toBe(0)
    expect(top2[1]!.agreementScore).toBe(0.5)
  })

  it('[FR-R103.5] exports JSONL training set with PII masked', () => {
    const e = new KnowledgeDistillationEngine()
    e.registerDistillationJob('j1', 't', 's')
    e.addSample(
      'j1',
      '홍길동 010-1234-5678 문의',
      '답변 hong@example.com 연락',
      '답변',
      'O',
    )
    const records = e.exportTrainingSet('j1')
    expect(records).toHaveLength(1)
    expect(records[0]!.prompt).toContain('[PHONE]')
    expect(records[0]!.output).toContain('[EMAIL]')
    expect(records[0]!.prompt).not.toContain('010-1234-5678')
  })

  it('[CSAP D-06] audit log appends actions', () => {
    const e = new KnowledgeDistillationEngine()
    e.registerDistillationJob('j1', 't', 's')
    e.addSample('j1', 'p', 'to', 'to', 'O')
    e.computeAgreement('j1')
    const log = e.getAuditLog()
    const actions = log.map((l) => l.action)
    expect(actions).toContain('registerDistillationJob')
    expect(actions).toContain('addSample')
    expect(actions).toContain('computeAgreement')
  })

  it('throws on unknown job id', () => {
    const e = new KnowledgeDistillationEngine()
    expect(() => e.computeAgreement('missing')).toThrow(/no such/)
  })
})
