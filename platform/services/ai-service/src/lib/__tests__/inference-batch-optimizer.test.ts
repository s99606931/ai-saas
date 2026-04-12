import { describe, it, expect } from 'vitest';
import { InferenceBatchOptimizer, type BatchRequest } from '../inference-batch-optimizer.js';

describe('SVC-AI-ADV-R351 InferenceBatchOptimizer', () => {
  const makeReq = (id: string, model = 'm1'): BatchRequest<string> => ({
    id,
    modelId: model,
    payload: `p-${id}`,
    grade: 'O',
    queuedAt: Date.now(),
  });

  it('FR-351.1: 배치 크기 도달 시 flush', () => {
    const executed: string[] = [];
    const svc = new InferenceBatchOptimizer<string>((batch) => {
      batch.forEach((b) => executed.push(b.id));
    });
    svc.configureModel('m1', { maxBatchSize: 2, timeoutMs: 1000 });
    svc.enqueue(makeReq('a'));
    const res = svc.enqueue(makeReq('b'));
    expect(res?.reason).toBe('size');
    expect(executed).toEqual(['a', 'b']);
  });

  it('FR-351.2: 타임아웃 시 부분 flush', () => {
    const svc = new InferenceBatchOptimizer<string>(() => {});
    svc.configureModel('m1', { maxBatchSize: 10, timeoutMs: 100 });
    const old: BatchRequest<string> = { id: 'x', modelId: 'm1', payload: 'p', grade: 'O', queuedAt: 0 };
    svc.enqueue(old);
    const results = svc.tick(1000);
    expect(results.length).toBe(1);
    expect(results[0]?.reason).toBe('timeout');
  });

  it('FR-351.3: C/S 차단', () => {
    const svc = new InferenceBatchOptimizer<string>(() => {});
    svc.configureModel('m1', { maxBatchSize: 1, timeoutMs: 1 });
    expect(() =>
      svc.enqueue({ id: 'x', modelId: 'm1', payload: 'p', grade: 'C', queuedAt: 0 }),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-351.4: 감사 로그', () => {
    const svc = new InferenceBatchOptimizer<string>(() => {});
    svc.configureModel('m1', { maxBatchSize: 5, timeoutMs: 1 });
    svc.enqueue(makeReq('a'));
    svc.flush('m1');
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(3);
  });

  it('빈 큐 flush null', () => {
    const svc = new InferenceBatchOptimizer<string>(() => {});
    svc.configureModel('m1', { maxBatchSize: 1, timeoutMs: 1 });
    expect(svc.flush('m1')).toBeNull();
  });
});
