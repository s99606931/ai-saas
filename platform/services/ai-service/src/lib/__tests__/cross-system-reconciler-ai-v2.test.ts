import { describe, it, expect, beforeEach } from 'vitest';
import { CrossSystemReconcilerAIV2 } from '../cross-system-reconciler-ai-v2';

describe('CrossSystemReconcilerAIV2', () => {
  let svc: CrossSystemReconcilerAIV2;

  beforeEach(() => {
    svc = new CrossSystemReconcilerAIV2();
  });

  it('FR-R687.3: CRITICAL → HALT_SYNC when drift>=0.3', () => {
    const r = svc.reconcile({
      pairId: 'p1',
      sourceEmail: 'src@example.com',
      sourceRecord: { a: '1', b: '2', c: '3', d: '4' },
      targetRecord: { a: '9', b: '9', c: '9', d: '4' },
    });
    expect(r.level).toBe('CRITICAL');
    expect(r.action).toBe('HALT_SYNC');
    expect(r.maskedSource).toHaveLength(16);
  });

  it('WARNING → AUTO_HEAL when drift 0.1~0.3', () => {
    const r = svc.reconcile({
      pairId: 'p2',
      sourceEmail: 'x',
      sourceRecord: { a: '1', b: '2', c: '3', d: '4', e: '5' },
      targetRecord: { a: '1', b: '2', c: '3', d: '4', e: '9' },
    });
    expect(r.level).toBe('WARNING');
    expect(r.action).toBe('AUTO_HEAL');
  });

  it('OK → NONE when fully consistent', () => {
    const r = svc.reconcile({
      pairId: 'p3',
      sourceEmail: 'x',
      sourceRecord: { a: '1', b: '2' },
      targetRecord: { a: '1', b: '2' },
    });
    expect(r.level).toBe('OK');
    expect(r.action).toBe('NONE');
    expect(r.driftRatio).toBe(0);
  });

  it('FR-R687.1: C/S blocked', () => {
    expect(() =>
      svc.reconcile(
        {
          pairId: 'p',
          sourceEmail: 'x',
          sourceRecord: { a: '1' },
          targetRecord: { a: '1' },
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });

  it('rejects empty records', () => {
    expect(() =>
      svc.reconcile({
        pairId: 'p',
        sourceEmail: 'x',
        sourceRecord: {},
        targetRecord: {},
      }),
    ).toThrow('EMPTY_RECORDS');
  });

  it('FR-R687.5: audit log masks sourceEmail', () => {
    svc.reconcile({
      pairId: 'p9',
      sourceEmail: 'leak@example.com',
      sourceRecord: { a: '1' },
      targetRecord: { a: '1' },
    });
    const audit = svc.getAuditLog();
    for (const e of audit) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('leak@example.com');
    }
  });
});
