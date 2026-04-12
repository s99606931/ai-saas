// Bulkhead 테스트
// Plan SC: FR-BH.1~FR-BH.6

import { describe, it, expect } from 'vitest';
import {
  Bulkhead,
  BulkheadRejectedError,
  BulkheadGroupNotFoundError,
} from '../src/bulkhead.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('FR-BH.1: 동시 실행 제한', () => {
  it('maxConcurrent 초과 실행 불가', async () => {
    const bh = new Bulkhead();
    bh.addGroup('api', { maxConcurrent: 2, maxQueue: 10 });

    let running = 0;
    let max = 0;

    await Promise.all(
      Array.from({ length: 10 }, () =>
        bh.execute('api', async () => {
          running++;
          max = Math.max(max, running);
          await delay(10);
          running--;
        }),
      ),
    );

    expect(max).toBe(2);
  });
});

describe('FR-BH.2: 큐 대기', () => {
  it('슬롯 없으면 큐에 대기 후 실행', async () => {
    const bh = new Bulkhead();
    bh.addGroup('g', { maxConcurrent: 1, maxQueue: 5 });

    const results: number[] = [];
    const tasks = [1, 2, 3].map((n) =>
      bh.execute('g', async () => {
        await delay(5);
        results.push(n);
        return n;
      }),
    );

    await Promise.all(tasks);
    expect(results).toEqual([1, 2, 3]);
  });
});

describe('FR-BH.3: 큐 포화 시 거부', () => {
  it('큐 가득차면 BulkheadRejectedError', async () => {
    const bh = new Bulkhead();
    bh.addGroup('tight', { maxConcurrent: 1, maxQueue: 1 });

    // 첫 작업 = active
    const p1 = bh.execute('tight', async () => {
      await delay(30);
    });
    // 두 번째 = 큐에 들어감
    const p2 = bh.execute('tight', async () => {
      await delay(10);
    });
    // 세 번째 = 거부
    await expect(
      bh.execute('tight', async () => 'nope'),
    ).rejects.toThrow(BulkheadRejectedError);

    await Promise.all([p1, p2]);
  });

  it('maxQueue=0이면 즉시 거부', async () => {
    const bh = new Bulkhead();
    bh.addGroup('nq', { maxConcurrent: 1, maxQueue: 0 });

    const p1 = bh.execute('nq', async () => {
      await delay(20);
    });
    await expect(bh.execute('nq', async () => 'x')).rejects.toThrow(
      BulkheadRejectedError,
    );
    await p1;
  });
});

describe('FR-BH.4: 상태 조회', () => {
  it('accepted/rejected/active 카운터', async () => {
    const bh = new Bulkhead();
    bh.addGroup('m', { maxConcurrent: 1, maxQueue: 1 });

    const p1 = bh.execute('m', async () => {
      await delay(20);
    });
    const p2 = bh.execute('m', async () => {
      await delay(5);
    });
    await expect(bh.execute('m', async () => 'nope')).rejects.toThrow();

    const midMetrics = bh.getMetrics('m');
    expect(midMetrics.active).toBe(1);
    expect(midMetrics.waiting).toBe(1);
    expect(midMetrics.rejected).toBe(1);

    await Promise.all([p1, p2]);
    const finalMetrics = bh.getMetrics('m');
    expect(finalMetrics.active).toBe(0);
    expect(finalMetrics.accepted).toBe(2);
  });
});

describe('FR-BH.5: 그룹 관리', () => {
  it('addGroup + removeGroup', () => {
    const bh = new Bulkhead();
    bh.addGroup('g1', { maxConcurrent: 1, maxQueue: 1 });
    expect(bh.hasGroup('g1')).toBe(true);
    expect(bh.listGroups()).toContain('g1');

    bh.removeGroup('g1');
    expect(bh.hasGroup('g1')).toBe(false);
  });

  it('존재하지 않는 그룹 실행 거부', async () => {
    const bh = new Bulkhead();
    await expect(bh.execute('ghost', async () => 'x')).rejects.toThrow(
      BulkheadGroupNotFoundError,
    );
  });

  it('removeGroup이 대기 작업 거부', async () => {
    const bh = new Bulkhead();
    bh.addGroup('g', { maxConcurrent: 1, maxQueue: 5 });

    const p1 = bh.execute('g', async () => {
      await delay(30);
    });
    const p2 = bh.execute('g', async () => 'waiting');

    bh.removeGroup('g');
    await expect(p2).rejects.toThrow(BulkheadRejectedError);
    await p1;
  });

  it('잘못된 설정 거부', () => {
    const bh = new Bulkhead();
    expect(() => bh.addGroup('x', { maxConcurrent: 0, maxQueue: 1 })).toThrow();
    expect(() => bh.addGroup('y', { maxConcurrent: 1, maxQueue: -1 })).toThrow();
  });
});

describe('FR-BH.6: 명확한 에러', () => {
  it('BulkheadRejectedError는 group 이름 포함', async () => {
    const bh = new Bulkhead();
    bh.addGroup('tenant-a', { maxConcurrent: 1, maxQueue: 0 });
    bh.execute('tenant-a', async () => delay(20));

    try {
      await bh.execute('tenant-a', async () => 'x');
    } catch (e) {
      expect(e).toBeInstanceOf(BulkheadRejectedError);
      expect((e as BulkheadRejectedError).group).toBe('tenant-a');
      expect((e as BulkheadRejectedError).code).toBe('BULKHEAD_REJECTED');
    }
  });

  it('그룹 간 격리 확인', async () => {
    const bh = new Bulkhead();
    bh.addGroup('a', { maxConcurrent: 1, maxQueue: 0 });
    bh.addGroup('b', { maxConcurrent: 1, maxQueue: 0 });

    const aBlock = bh.execute('a', async () => delay(20));
    // b 그룹은 a 포화와 무관
    const bResult = await bh.execute('b', async () => 'b-ok');
    expect(bResult).toBe('b-ok');
    await aBlock;
  });
});
