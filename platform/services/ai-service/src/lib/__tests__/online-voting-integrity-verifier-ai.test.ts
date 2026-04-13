import { describe, it, expect } from 'vitest';
import { OnlineVotingIntegrityVerifierAI } from '../online-voting-integrity-verifier-ai.js';

describe('SVC-AI-ADV-R433 OnlineVotingIntegrityVerifierAI', () => {
  const svc = new OnlineVotingIntegrityVerifierAI();

  it('FR-433.1: 중복 voter 탐지', () => {
    const r = svc.verify([
      { voteId: 'v1', voterId: 'A', ip: '1.1.1.1', timestamp: '2026-04-13T10:00:00Z' },
      { voteId: 'v2', voterId: 'A', ip: '1.1.1.2', timestamp: '2026-04-13T11:00:00Z' },
    ]);
    expect(r.flaggedCount).toBe(2);
    const reasons = new Set(r.suspicious.flatMap((s) => s.reasons));
    expect(reasons.has('DUPLICATE')).toBe(true);
  });

  it('FR-433.2: 동일 IP > 5 탐지', () => {
    const events = Array.from({ length: 6 }, (_, i) => ({
      voteId: `v${i}`,
      voterId: `U${i}`,
      ip: '9.9.9.9',
      timestamp: `2026-04-13T10:0${i}:00Z`,
    }));
    const r = svc.verify(events);
    expect(r.flaggedCount).toBe(6);
    expect(r.suspicious.every((s) => s.reasons.includes('SUSPICIOUS_IP'))).toBe(true);
  });

  it('FR-433.3: 봇 속도 탐지', () => {
    const r = svc.verify([
      { voteId: 'v1', voterId: 'A', ip: '1.1.1.1', timestamp: '2026-04-13T10:00:00.000Z' },
      { voteId: 'v2', voterId: 'A', ip: '1.1.1.2', timestamp: '2026-04-13T10:00:00.500Z' },
    ]);
    const v2 = r.suspicious.find((s) => s.voteId === 'v2');
    expect(v2?.reasons).toContain('BOT_SPEED');
  });

  it('정상 투표 → 플래그 없음', () => {
    const r = svc.verify([
      { voteId: 'v1', voterId: 'A', ip: '1.1.1.1', timestamp: '2026-04-13T10:00:00Z' },
      { voteId: 'v2', voterId: 'B', ip: '2.2.2.2', timestamp: '2026-04-13T10:05:00Z' },
    ]);
    expect(r.flaggedCount).toBe(0);
  });

  it('FR-433.5: S 차단', () => {
    expect(() => svc.verify([], 'S')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.verify([]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
