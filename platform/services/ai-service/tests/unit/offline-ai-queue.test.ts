// MTU-N390 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  enqueue,
  dequeue,
  markSuccess,
  markFailure,
  computeBackoff,
  setNetworkStatus,
  isOnline,
  getDeadLetter,
  getQueueSize,
  getQueueAuditLog,
  OfflineAiQueueService,
} from '../../src/lib/offline-ai-queue';

const config = {
  maxAttempts: 3,
  initialBackoffMs: 100,
  maxBackoffMs: 10_000,
  maxCapacity: 100,
};

describe('MTU-N390 OfflineAiQueue', () => {
  it('enqueue 기본 동작', () => {
    setNetworkStatus(true);
    const item = enqueue('tN390-a', { foo: 'bar' });
    expect(item.status).toBe('pending');
  });

  it('큐 용량 초과 예외', () => {
    const cfg = { ...config, maxCapacity: 2 };
    const tenant = 'tN390-cap';
    enqueue(tenant, {}, 5, cfg);
    enqueue(tenant, {}, 5, cfg);
    expect(() => enqueue(tenant, {}, 5, cfg)).toThrow(/포화/);
  });

  it('네트워크 오프라인 시 dequeue 불가', () => {
    enqueue('tN390-off', { x: 1 });
    setNetworkStatus(false);
    expect(dequeue('tN390-off')).toBeUndefined();
    setNetworkStatus(true);
  });

  it('우선순위 높은 것 먼저', () => {
    const tenant = 'tN390-prio';
    enqueue(tenant, { v: 1 }, 1);
    enqueue(tenant, { v: 2 }, 9);
    setNetworkStatus(true);
    const item = dequeue(tenant);
    expect((item?.payload as { v: number }).v).toBe(2);
  });

  it('성공 처리', () => {
    const tenant = 'tN390-succ';
    const item = enqueue(tenant, {});
    markSuccess(tenant, item.itemId);
    // 직접 확인이 어려워 감사 로그로 확인
    expect(getQueueAuditLog(tenant).some((e) => e.action === 'ITEM_COMPLETED')).toBe(true);
  });

  it('실패 재시도', () => {
    const tenant = 'tN390-retry';
    const item = enqueue(tenant, {}, 5, config);
    dequeue(tenant);
    markFailure(tenant, item.itemId, 'oops', config);
    expect(item.nextRetryAt).toBeDefined();
  });

  it('최대 시도 초과 시 데드레터', () => {
    const tenant = 'tN390-dead';
    const item = enqueue(tenant, {}, 5, config);
    let virtualNow = Date.now();
    for (let i = 0; i < 3; i++) {
      virtualNow += 100_000;
      dequeue(tenant, virtualNow);
      markFailure(tenant, item.itemId, 'err', config);
    }
    expect(getDeadLetter(tenant).some((i) => i.itemId === item.itemId)).toBe(true);
  });

  it('지수 백오프 계산', () => {
    const b0 = computeBackoff(0, config);
    const b1 = computeBackoff(1, config);
    expect(b1).toBeGreaterThan(b0);
  });

  it('백오프 상한', () => {
    const b = computeBackoff(100, config);
    expect(b).toBeLessThanOrEqual(config.maxBackoffMs);
  });

  it('큐 사이즈', () => {
    const tenant = 'tN390-size';
    enqueue(tenant, {});
    expect(getQueueSize(tenant)).toBeGreaterThan(0);
  });

  it('네트워크 상태 조회', () => {
    setNetworkStatus(true);
    expect(isOnline()).toBe(true);
    setNetworkStatus(false);
    expect(isOnline()).toBe(false);
    setNetworkStatus(true);
  });

  it('서비스 클래스', () => {
    const svc = new OfflineAiQueueService('tN390-svc', config);
    const item = svc.enqueue({ x: 1 });
    expect(item.tenantId).toBe('tN390-svc');
  });
});
