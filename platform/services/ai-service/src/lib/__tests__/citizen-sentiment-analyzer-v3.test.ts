import { describe, it, expect } from 'vitest';
import { CitizenSentimentAnalyzerV3 } from '../citizen-sentiment-analyzer-v3.js';

describe('SVC-AI-ADV-R606 (v3) CitizenSentimentAnalyzerV3', () => {
  const svc = new CitizenSentimentAnalyzerV3();

  it('FR-R606v3.2: S등급 → BLOCKED', () => {
    expect(() =>
      svc.analyze({ id: 's1', citizenEmail: 'a@gov.kr', text: '감사합니다', grade: 'S' })
    ).toThrow(/BLOCKED.*N2SF N-05/);
  });

  it('FR-R606v3.4: 부정 ≥2 → NEGATIVE', () => {
    const r = svc.analyze({
      id: 's2',
      citizenEmail: 'a@gov.kr',
      text: '정말 불만이고 항의합니다 분노',
      grade: 'O',
    });
    expect(r.sentiment).toBe('NEGATIVE');
    expect(r.score).toBeLessThanOrEqual(-2);
  });

  it('FR-R606v3.4: 긍정 ≥2 → POSITIVE', () => {
    const r = svc.analyze({
      id: 's3',
      citizenEmail: 'b@gov.kr',
      text: '친절하고 만족스러우며 감사합니다',
      grade: 'O',
    });
    expect(r.sentiment).toBe('POSITIVE');
  });

  it('FR-R606v3.4: 중립 → NEUTRAL', () => {
    const r = svc.analyze({
      id: 's4',
      citizenEmail: 'c@gov.kr',
      text: '문의드립니다',
      grade: 'O',
    });
    expect(r.sentiment).toBe('NEUTRAL');
  });

  it('FR-R606v3.5: PII 마스킹', () => {
    const r = svc.analyze({
      id: 's5',
      citizenEmail: 'pii@gov.kr',
      text: '안녕하세요',
      grade: 'O',
    });
    expect(r.maskedCitizen).toMatch(/^[0-9a-f]{16}$/);
  });

  it('감사 로그', () => {
    const local = new CitizenSentimentAnalyzerV3();
    local.analyze({ id: 's6', citizenEmail: 'd@gov.kr', text: '감사', grade: 'O' });
    expect(local.getAuditLog()).toHaveLength(1);
  });
});
