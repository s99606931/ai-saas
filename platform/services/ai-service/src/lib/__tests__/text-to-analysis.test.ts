import { describe, it, expect, beforeEach } from 'vitest';
import { TextToAnalysis } from '../text-to-analysis';

describe('TextToAnalysis', () => {
  let svc: TextToAnalysis;

  beforeEach(() => {
    svc = new TextToAnalysis();
    svc.registerSchema([
      { table: 'complaints', column: '민원', type: 'int', pii: false },
      { table: 'users', column: 'name', type: 'string', pii: true },
      { table: 'users', column: 'email', type: 'string', pii: true },
    ]);
  });

  it('FR-T2A.1 자연어 파싱 (count)', () => {
    const q = svc.parseQuery('2026년 민원 개수');
    expect(q.intent).toBe('count');
    expect(q.target).toBe('민원');
    expect(q.filters[0]!.value).toBe(2026);
  });

  it('FR-T2A.2 스키마 매핑', () => {
    const q = svc.parseQuery('민원 추세');
    const m = svc.mapToSchema(q);
    expect(m?.table).toBe('complaints');
  });

  it('FR-T2A.3 SQL 생성 (매개변수화)', () => {
    const q = svc.parseQuery('2026년 민원 개수');
    const plan = svc.buildSql(q, 'complaints');
    expect(plan.sql).toContain('$1');
    expect(plan.params[0]).toBe(2026);
  });

  it('FR-T2A.4 결과 요약', () => {
    const q = svc.parseQuery('민원 개수');
    const s = svc.summarizeResult([{ count: 42 }], q);
    expect(s).toContain('42');
  });

  it('FR-T2A.5 PII 마스킹', () => {
    const r = svc.maskPii({ name: '홍길동', email: 'test@gov.kr', id: 1 });
    expect(r.name).toContain('***');
    expect(r.email).toContain('***');
    expect(r.id).toBe(1);
  });
});
