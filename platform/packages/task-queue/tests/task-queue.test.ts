// Task Queue 테스트
// Plan SC: FR-TQ.1~FR-TQ.6

import { describe, it, expect } from 'vitest';
import { TaskQueue } from '../src/task-queue.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('FR-TQ.1: 동시성 제한', () => {
  it('최대 concurrency만큼만 동시 실행', async () => {
    const q = new TaskQueue({ concurrency: 2 });
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 10 }, () =>
      q.add(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await delay(10);
        running--;
      }),
    );

    await Promise.all(tasks);
    expect(maxRunning).toBe(2);
  });

  it('concurrency 0 거부', () => {
    expect(() => new TaskQueue({ concurrency: 0 })).toThrow();
  });

  it('concurrency 소수점 거부', () => {
    expect(() => new TaskQueue({ concurrency: 1.5 })).toThrow();
  });
});

describe('FR-TQ.2: 작업 결과 반환', () => {
  it('성공 결과 resolve', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const result = await q.add(async () => 42);
    expect(result).toBe(42);
  });

  it('에러 reject', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    await expect(q.add(async () => {
      throw new Error('실패');
    })).rejects.toThrow('실패');
  });
});

describe('FR-TQ.3: 우선순위 스케줄링', () => {
  it('높은 우선순위 먼저 실행', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const order: number[] = [];

    // 첫 작업 점유 (즉시 실행됨)
    const first = q.add(async () => {
      await delay(10);
      order.push(0);
    });

    // 대기 큐에 들어감
    q.add(async () => {
      order.push(1);
    }, { priority: 1 });
    q.add(async () => {
      order.push(2);
    }, { priority: 10 });
    q.add(async () => {
      order.push(3);
    }, { priority: 5 });

    await first;
    await q.idle();
    expect(order).toEqual([0, 2, 3, 1]);
  });
});

describe('FR-TQ.4: 작업 취소', () => {
  it('clear로 대기 작업 취소', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    void q.add(async () => {
      await delay(50);
    });
    const pending = q.add(async () => 'should-cancel');
    const count = q.clear();
    expect(count).toBe(1);
    await expect(pending).rejects.toThrow(/취소/);
  });
});

describe('FR-TQ.5: 상태 조회', () => {
  it('size와 pending', async () => {
    const q = new TaskQueue({ concurrency: 2 });
    const p1 = q.add(async () => {
      await delay(20);
    });
    const p2 = q.add(async () => {
      await delay(20);
    });
    q.add(async () => {
      await delay(20);
    });

    await delay(5);
    expect(q.pending).toBe(2);
    expect(q.size).toBe(1);

    await Promise.all([p1, p2]);
    await q.idle();
    expect(q.pending).toBe(0);
    expect(q.size).toBe(0);
  });
});

describe('FR-TQ.6: idle 대기', () => {
  it('모든 작업 완료 후 idle resolve', async () => {
    const q = new TaskQueue({ concurrency: 2 });
    q.add(async () => delay(10));
    q.add(async () => delay(15));
    q.add(async () => delay(5));

    await q.idle();
    expect(q.pending).toBe(0);
    expect(q.size).toBe(0);
  });

  it('빈 큐에서 idle 즉시 resolve', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    await q.idle();
  });

  it('setConcurrency 확장', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    let concurrent = 0;
    let max = 0;

    for (let i = 0; i < 5; i++) {
      q.add(async () => {
        concurrent++;
        max = Math.max(max, concurrent);
        await delay(10);
        concurrent--;
      });
    }

    q.setConcurrency(5);
    await q.idle();
    expect(max).toBeGreaterThanOrEqual(2);
  });
});
