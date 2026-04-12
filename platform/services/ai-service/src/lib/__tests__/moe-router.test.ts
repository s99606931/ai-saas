// Plan SC: FR-R83.1~5
import { describe, it, expect } from 'vitest';
import { MoeRouter, createMoeRouter } from '../moe-router';

function setup(): MoeRouter {
  const r = createMoeRouter();
  r.register({ id: 'law', domain: '법령', keywords: ['법령', '조항', '시행령', '공공'] });
  r.register({ id: 'code', domain: '코드', keywords: ['function', 'typescript', '버그', '코드'] });
  r.register({ id: 'general', domain: '일반', keywords: [], isDefault: true });
  return r;
}

describe('MoeRouter', () => {
  it('FR-R83.1: registers experts', () => {
    const r = setup();
    expect(r.getAuditLog().filter((e) => e.action === 'REGISTER').length).toBe(3);
  });

  it('FR-R83.2~3: selects legal expert for law query', () => {
    const r = setup();
    const res = r.select('공공기관 시행령의 조항 설명해주세요');
    expect(res.selected[0]?.expertId).toBe('law');
    expect(res.fallback).toBe(false);
  });

  it('FR-R83.2: code keyword with code block boost', () => {
    const r = setup();
    const res = r.select('```typescript function 버그 수정```');
    expect(res.selected[0]?.expertId).toBe('code');
  });

  it('FR-R83.3: top-k returns normalized weights', () => {
    const r = setup();
    r.register({ id: 'hybrid', domain: '복합', keywords: ['법령', 'function'] });
    const res = r.select('법령과 function 관련', 2);
    expect(res.selected.length).toBeLessThanOrEqual(2);
    const sum = res.selected.reduce((s, x) => s + x.score, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('FR-R83.4: falls back to default when no match', () => {
    const r = setup();
    const res = r.select('날씨가 어때요');
    expect(res.fallback).toBe(true);
    expect(res.selected[0]?.expertId).toBe('general');
  });

  it('FR-R83.5: audit log contains SELECT/FALLBACK', () => {
    const r = setup();
    r.select('법령 조항');
    r.select('아무거나');
    const log = r.getAuditLog();
    expect(log.some((e) => e.action === 'SELECT')).toBe(true);
    expect(log.some((e) => e.action === 'FALLBACK')).toBe(true);
  });

  it('rejects invalid expert', () => {
    const r = new MoeRouter();
    expect(() =>
      r.register({ id: '', domain: 'x', keywords: [] }),
    ).toThrow();
  });
});
