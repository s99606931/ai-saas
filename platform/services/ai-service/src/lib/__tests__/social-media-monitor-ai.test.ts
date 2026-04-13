import { describe, it, expect } from 'vitest';
import { SocialMediaMonitorAI } from '../social-media-monitor-ai.js';

describe('SVC-AI-ADV-R397 SocialMediaMonitorAI', () => {
  const svc = new SocialMediaMonitorAI();

  it('FR-387.1: 위기 카테고리 감지', () => {
    const r = svc.analyze([{ id: 'p1', text: '폭발 사고 발생' }]);
    expect(r.analyses[0]?.category).toBe('crisis');
    expect(r.analyses[0]?.score).toBeLessThan(0);
  });

  it('FR-387.2: 긍정 카테고리', () => {
    const r = svc.analyze([{ id: 'p2', text: '감사합니다 좋다' }]);
    expect(r.analyses[0]?.category).toBe('positive');
    expect(r.analyses[0]?.score).toBeGreaterThan(0);
  });

  it('FR-387.3: high alert (위기 2건)', () => {
    const r = svc.analyze([
      { id: 'p1', text: '화재 사망' },
      { id: 'p2', text: '붕괴 사고' },
    ]);
    expect(r.alertLevel).toBe('high');
  });

  it('FR-387.4: S등급 차단', () => {
    expect(() => svc.analyze([{ id: 'p', text: '테스트' }], 'S')).toThrow('N2SF_BLOCKED');
  });

  it('FR-387.5: 감사 로그', () => {
    const m = new SocialMediaMonitorAI();
    m.analyze([{ id: 'p', text: '정상' }]);
    expect(m.getAuditLog().length).toBe(1);
  });

  it('중립 카테고리', () => {
    const r = svc.analyze([{ id: 'p', text: '공지사항입니다' }]);
    expect(r.analyses[0]?.category).toBe('neutral');
  });
});
