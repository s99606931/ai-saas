import { describe, it, expect, beforeEach } from 'vitest';
import { SmartQueueManagerAIV3 } from '../smart-queue-manager-ai-v3';

describe('SmartQueueManagerAIV3', () => {
  let svc: SmartQueueManagerAIV3;

  beforeEach(() => {
    svc = new SmartQueueManagerAIV3();
    svc.defineQueue({ queueId: 'q1', capacity: 100, slaMs: 1000 });
  });

  it('FR-R685.3/4: HIGH pressure → REBALANCE', () => {
    const v = svc.enqueue({
      jobId: 'j1',
      queueId: 'q1',
      jobOwner: 'owner@example.com',
      currentLength: 90,
      waitMs: 500,
    });
    expect(v.pressure).toBe('HIGH');
    expect(v.action).toBe('REBALANCE');
    expect(v.maskedOwner).toHaveLength(16);
    expect(v.maskedOwner).not.toContain('owner');
  });

  it('MEDIUM pressure → PRIORITIZE', () => {
    const v = svc.enqueue({
      jobId: 'j2',
      queueId: 'q1',
      jobOwner: 'x',
      currentLength: 55,
      waitMs: 100,
    });
    expect(v.pressure).toBe('MEDIUM');
    expect(v.action).toBe('PRIORITIZE');
  });

  it('LOW pressure → HOLD', () => {
    const v = svc.enqueue({
      jobId: 'j3',
      queueId: 'q1',
      jobOwner: 'x',
      currentLength: 10,
      waitMs: 100,
    });
    expect(v.pressure).toBe('LOW');
    expect(v.action).toBe('HOLD');
  });

  it('waitMs > slaMs promotes action one rank', () => {
    const v = svc.enqueue({
      jobId: 'j4',
      queueId: 'q1',
      jobOwner: 'x',
      currentLength: 10,
      waitMs: 5000,
    });
    expect(v.action).toBe('PRIORITIZE');
  });

  it('FR-R685.2: C/S blocked', () => {
    expect(() =>
      svc.enqueue(
        { jobId: 'j', queueId: 'q1', jobOwner: 'x', currentLength: 0, waitMs: 0 },
        'C',
      ),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown queue and invalid config', () => {
    expect(() =>
      svc.enqueue({ jobId: 'j', queueId: 'ghost', jobOwner: 'x', currentLength: 0, waitMs: 0 }),
    ).toThrow('UNKNOWN_QUEUE');
    expect(() => svc.defineQueue({ queueId: 'bad', capacity: 0, slaMs: 1 })).toThrow(
      'INVALID_QUEUE_CONFIG',
    );
  });

  it('FR-R685.5: audit log masks jobOwner', () => {
    svc.enqueue({
      jobId: 'j5',
      queueId: 'q1',
      jobOwner: 'leak@example.com',
      currentLength: 10,
      waitMs: 10,
    });
    const audit = svc.getAuditLog();
    for (const e of audit) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('leak@example.com');
    }
  });
});
