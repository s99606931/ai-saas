import { describe, it, expect, beforeEach } from 'vitest';
import { FraudPatternRecognizerV3 } from '../fraud-pattern-recognizer-v3';

describe('SVC-AI-ADV-R641 FraudPatternRecognizerV3', () => {
  let svc: FraudPatternRecognizerV3;

  beforeEach(() => {
    svc = new FraudPatternRecognizerV3();
  });

  it('FR-R641.1: 트랜잭션 등록 & actorEmail SHA-256 마스킹', () => {
    svc.registerTransaction('tx1', 500, 'user@gov.kr');
    const log = svc.getAuditLog();
    const entry = log.find((e) => e.action === 'REGISTER_TX');
    const masked = entry?.details?.['maskedActor'];
    expect(masked).toMatch(/^[0-9a-f]{16}$/);
  });

  it('FR-R641.2: C등급 차단', () => {
    svc.registerTransaction('tx1', 500, 'u@gov.kr');
    expect(() => svc.evaluate('tx1', 'C')).toThrow(/BLOCKED/);
  });

  it('FR-R641.3: 고액 거래 위험 가산', () => {
    svc.registerTransaction('tx1', 20000, 'u@gov.kr');
    const score = svc.evaluate('tx1');
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  it('FR-R641.4: 동일 actor 3회 이상 고위험', () => {
    svc.registerTransaction('tx1', 20000, 'repeat@gov.kr');
    svc.registerTransaction('tx2', 20000, 'repeat@gov.kr');
    svc.registerTransaction('tx3', 20000, 'repeat@gov.kr');
    svc.evaluate('tx1');
    svc.evaluate('tx2');
    svc.evaluate('tx3');
    const high = svc.getHighRiskTransactions();
    expect(high.length).toBeGreaterThanOrEqual(1);
  });

  it('FR-R641.5: 감사 로그 evaluate 기록', () => {
    svc.registerTransaction('tx1', 500, 'u@gov.kr');
    svc.evaluate('tx1');
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'EVALUATE_TX')).toBe(true);
  });
});
