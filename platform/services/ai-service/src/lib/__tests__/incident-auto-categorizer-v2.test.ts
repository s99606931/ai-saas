import { describe, it, expect } from 'vitest';
import { IncidentAutoCategorizerV2 } from '../incident-auto-categorizer-v2.js';

describe('SVC-AI-ADV-R364 IncidentAutoCategorizerV2', () => {
  const svc = new IncidentAutoCategorizerV2();

  it('FR-364.1: 멀티라벨 분류', () => {
    const r = svc.categorize({
      id: 'i1',
      title: '네트워크 timeout 및 db deadlock',
      description: '쿼리 실패',
      grade: 'O',
    });
    const cats = r.labels.map((l) => l.category);
    expect(cats).toContain('network');
    expect(cats).toContain('database');
  });

  it('FR-364.2: 신뢰도 정렬', () => {
    const r = svc.categorize({
      id: 'i2',
      title: '로그인 인증 token 권한',
      description: '',
      grade: 'O',
    });
    expect(r.labels[0]?.category).toBe('auth');
  });

  it('FR-364.3: S등급 차단', () => {
    expect(() =>
      svc.categorize({ id: 'i3', title: 'x', description: 'y', grade: 'S' }),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-364.4: 감사 로그', () => {
    svc.categorize({ id: 'i4', title: 'latency', description: '', grade: 'O' });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('매칭 없음', () => {
    const r = svc.categorize({ id: 'i5', title: '평범한 텍스트', description: '', grade: 'O' });
    expect(r.labels.length).toBe(0);
  });
});
