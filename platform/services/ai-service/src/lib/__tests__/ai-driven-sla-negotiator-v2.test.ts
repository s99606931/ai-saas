import { describe, it, expect, beforeEach } from 'vitest'
import { AIDrivenSLANegotiatorV2 } from '../ai-driven-sla-negotiator-v2'

describe('AIDrivenSLANegotiatorV2', () => {
  let negotiator: AIDrivenSLANegotiatorV2

  beforeEach(() => {
    negotiator = new AIDrivenSLANegotiatorV2()
  })

  it('N2SF C등급 제안 차단', () => {
    expect(() =>
      negotiator.proposeSLA(
        'P1',
        'public',
        { availability: 0.99, responseMs: 200, pricePerMonth: 1000000 },
        'a@b.kr',
        '홍길동',
        'C',
      ),
    ).toThrow('BLOCKED')
  })

  it('PII 마스킹: 이메일/이름이 SHA-256 16자로 변환', () => {
    const proposal = negotiator.proposeSLA(
      'P2',
      'public',
      { availability: 0.99, responseMs: 200, pricePerMonth: 1000000 },
      'admin@gov.kr',
      '홍길동',
      'O',
    )
    expect(proposal.contactEmail).toMatch(/^[a-f0-9]{16}$/)
    expect(proposal.contactName).toMatch(/^[a-f0-9]{16}$/)
  })

  it('점수 산출: 가용성 + 응답 + 가격 가중합', () => {
    negotiator.proposeSLA(
      'P3',
      'public',
      { availability: 1, responseMs: 0, pricePerMonth: 0 },
      'a@b.kr',
      'name',
      'O',
    )
    const score = negotiator.scoreProposal('P3')
    expect(score.score).toBeCloseTo(1, 5)
  })

  it('합의 판정: 양측 동의 + 점수 ≥ 0.7', () => {
    negotiator.proposeSLA(
      'P4',
      'public',
      { availability: 0.99, responseMs: 100, pricePerMonth: 1000000 },
      'a@b.kr',
      'name',
      'O',
    )
    negotiator.accept('P4', 'public')
    negotiator.accept('P4', 'vendor')
    const result = negotiator.evaluateAgreement('P4')
    expect(result.agreed).toBe(true)
    expect(result.acceptedBy).toEqual(expect.arrayContaining(['public', 'vendor']))
  })

  it('한쪽만 수락 시 합의 불가', () => {
    negotiator.proposeSLA(
      'P5',
      'vendor',
      { availability: 0.99, responseMs: 100, pricePerMonth: 1000000 },
      'a@b.kr',
      'name',
      'O',
    )
    negotiator.accept('P5', 'public')
    expect(negotiator.evaluateAgreement('P5').agreed).toBe(false)
  })

  it('감사 로그 복사본 반환 — 외부 변조 무효', () => {
    negotiator.proposeSLA(
      'P6',
      'public',
      { availability: 0.9, responseMs: 100, pricePerMonth: 1000000 },
      'a@b.kr',
      'name',
      'O',
    )
    const log = negotiator.getAuditLog()
    log.push({ timestamp: '', action: 'injected', proposalId: 'X', detail: {} })
    expect(negotiator.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
