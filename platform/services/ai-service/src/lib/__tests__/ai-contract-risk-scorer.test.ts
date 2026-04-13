import { describe, it, expect } from 'vitest';
import { AIContractRiskScorer } from '../ai-contract-risk-scorer.js';

describe('SVC-AI-ADV-R401 AIContractRiskScorer', () => {
  const svc = new AIContractRiskScorer();

  it('FR-391.1: critical 키워드 high 등급', () => {
    const r = svc.score('c1', [
      { id: 'cl1', text: '무한책임 및 즉시해지 조건' },
    ]);
    // critical=2, score=80
    expect(r.clauses[0]?.score).toBe(80);
    expect(r.grade).toBe('high');
  });

  it('FR-391.2: low 등급 (키워드 없음)', () => {
    const r = svc.score('c2', [{ id: 'cl1', text: '상호 협력 조항' }]);
    expect(r.grade).toBe('low');
    expect(r.overallScore).toBe(0);
  });

  it('FR-391.3: med 등급', () => {
    const r = svc.score('c3', [
      { id: 'cl1', text: '위약금 조항 및 일방해지 조항' },
    ]);
    // high=2, score=50 → med
    expect(r.grade).toBe('med');
  });

  it('FR-391.4: S등급 차단', () => {
    expect(() => svc.score('c', [{ id: 'cl', text: 't' }], 'S')).toThrow('N2SF_BLOCKED');
  });

  it('FR-391.5: 빈 조항 거부', () => {
    expect(() => svc.score('c', [])).toThrow('INVALID_INPUT');
  });

  it('감사 로그', () => {
    svc.score('c5', [{ id: 'cl', text: '정상' }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
