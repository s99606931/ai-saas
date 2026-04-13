import { describe, it, expect } from 'vitest';
import { PublicWorkflowBuilder } from '../public-workflow-builder.js';

describe('SVC-AI-ADV-R441 PublicWorkflowBuilder', () => {
  const svc = new PublicWorkflowBuilder();

  it('FR-441.3: 순차 실행', () => {
    const r = svc.run(
      [
        { id: 's1', action: 'a' },
        { id: 's2', action: 'b' },
      ],
      {},
    );
    expect(r.executed).toEqual(['s1', 's2']);
  });

  it('FR-441.2: when eq 조건 불일치 → 스킵', () => {
    const r = svc.run(
      [
        { id: 's1', action: 'a', when: { key: 'role', op: 'eq', value: 'admin' } },
        { id: 's2', action: 'b' },
      ],
      { role: 'user' },
    );
    expect(r.skipped).toContain('s1');
    expect(r.executed).toContain('s2');
  });

  it('FR-441.2: gt 조건', () => {
    const r = svc.run(
      [{ id: 's1', action: 'a', when: { key: 'age', op: 'gt', value: 18 } }],
      { age: 20 },
    );
    expect(r.executed).toContain('s1');
  });

  it('FR-441.4: set → ctx 병합', () => {
    const r = svc.run([{ id: 's1', action: 'a', set: { approved: true } }], {});
    expect(r.context.approved).toBe(true);
  });

  it('id 누락 → 오류', () => {
    expect(() => svc.run([{ id: '', action: 'a' }], {})).toThrow('INVALID_STEP');
  });

  it('FR-441.5: S 차단', () => {
    expect(() => svc.run([], {}, 'S')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.run([{ id: 's1', action: 'a' }], {});
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
