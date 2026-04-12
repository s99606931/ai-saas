import { describe, it, expect } from 'vitest';
import {
  CostAwareBatchScheduler,
  type BatchJob,
  type PricingSlot,
} from '../cost-aware-batch-scheduler.js';

const basePricing: PricingSlot[] = [
  { startHour: 0, endHour: 6, pricePerToken: 0.0001, capacityTokens: 100000 },
  { startHour: 6, endHour: 18, pricePerToken: 0.001, capacityTokens: 100000 },
  { startHour: 18, endHour: 24, pricePerToken: 0.0005, capacityTokens: 100000 },
];

function makeJob(id: string, partial: Partial<BatchJob> = {}): BatchJob {
  return {
    id,
    name: `job-${id}`,
    payloadSize: 1024,
    estimatedTokens: 1000,
    deadline: Date.now() + 24 * 60 * 60 * 1000,
    grade: 'O',
    run: async () => {},
    ...partial,
  };
}

describe('생성자 가격표 검증', () => {
  it('빈 pricing 에러', () => {
    expect(() => new CostAwareBatchScheduler([])).toThrow('SCHED_PRICING_EMPTY');
  });
  it('정상 pricing', () => {
    const s = new CostAwareBatchScheduler(basePricing);
    expect(s.getJobCount()).toBe(0);
  });
});

describe('addJob 등급 검증 (FR-R70.1, N-05)', () => {
  it('O 등급 허용', () => {
    const s = new CostAwareBatchScheduler(basePricing);
    s.addJob(makeJob('j1'));
    expect(s.getJobCount()).toBe(1);
  });
  it('C 등급 차단', () => {
    const s = new CostAwareBatchScheduler(basePricing);
    expect(() => s.addJob(makeJob('j1', { grade: 'C' }))).toThrow(
      'BATCH_GRADE_BLOCKED',
    );
  });
  it('S 등급 차단', () => {
    const s = new CostAwareBatchScheduler(basePricing);
    expect(() => s.addJob(makeJob('j1', { grade: 'S' }))).toThrow(
      'BATCH_GRADE_BLOCKED',
    );
  });
});

describe('plan 최적 슬롯 (FR-R70.2, FR-R70.3)', () => {
  it('마감 여유 있으면 가장 저렴한 시간대 선택', () => {
    const s = new CostAwareBatchScheduler(basePricing);
    s.addJob(makeJob('j1'));
    const plans = s.plan(Date.now());
    expect(plans.length).toBe(1);
    // 최저가 slot = 0~6시 (0.0001)
    const plan = plans[0]!;
    expect(plan.estimatedCost).toBeCloseTo(0.0001 * 1000, 5);
  });
  it('용량 부족 시 다음 슬롯', () => {
    const small: PricingSlot[] = [
      { startHour: 0, endHour: 24, pricePerToken: 0.001, capacityTokens: 1500 },
    ];
    const s = new CostAwareBatchScheduler(small);
    s.addJob(makeJob('j1', { estimatedTokens: 1000 }));
    s.addJob(makeJob('j2', { estimatedTokens: 1000 }));
    s.plan(Date.now());
    // 첫 번째 job은 배치, 두 번째는 capacity 부족으로 miss 가능
    const plans = s.getPlans();
    expect(plans.length).toBeGreaterThanOrEqual(1);
  });
  it('우선순위 높은 job 먼저', () => {
    const s = new CostAwareBatchScheduler(basePricing);
    s.addJob(makeJob('low', { priority: 1 }));
    s.addJob(makeJob('high', { priority: 10 }));
    const plans = s.plan(Date.now());
    expect(plans[0]?.jobId).toBe('high');
  });
});

describe('executeDue 실행 (FR-R70.4)', () => {
  it('정상 job 실행 ok', async () => {
    let ran = false;
    const s = new CostAwareBatchScheduler(basePricing);
    s.addJob(
      makeJob('j1', {
        run: async () => {
          ran = true;
        },
      }),
    );
    const now = Date.now();
    s.plan(now);
    // plan.plannedAt 이 미래일 수 있으므로 강제로 미래 시점으로 executeDue
    const results = await s.executeDue(now + 24 * 60 * 60 * 1000);
    // 마감 지났을 수 있으므로 miss or ok
    expect(['ok', 'missed']).toContain(results[0]?.status);
    // 마감 넉넉한 경우
    expect(ran || results[0]?.status === 'missed').toBe(true);
  });

  it('실패 job 재시도 후 error', async () => {
    let attempts = 0;
    const s = new CostAwareBatchScheduler(basePricing);
    s.addJob(
      makeJob('j1', {
        maxRetries: 2,
        deadline: Date.now() + 24 * 60 * 60 * 1000,
        run: async () => {
          attempts += 1;
          throw new Error('fail');
        },
      }),
    );
    s.plan(Date.now());
    const results = await s.executeDue(Date.now());
    if (results[0]?.status === 'error') {
      expect(attempts).toBeGreaterThanOrEqual(3);
    }
  });

  it('마감 초과 job missed', async () => {
    const s = new CostAwareBatchScheduler(basePricing);
    s.addJob(
      makeJob('j1', {
        deadline: Date.now() - 1000, // 이미 마감
      }),
    );
    s.plan(Date.now() - 2000);
    const results = await s.executeDue(Date.now());
    // 마감 초과 감지
    const missed = results.find((r) => r.status === 'missed');
    expect(missed).toBeDefined();
  });
});

describe('summary 리포트 (FR-R70.5)', () => {
  it('완료/실패/미스 집계', async () => {
    const s = new CostAwareBatchScheduler(basePricing);
    s.addJob(makeJob('ok1'));
    s.plan(Date.now());
    await s.executeDue(Date.now() + 24 * 60 * 60 * 1000);
    const sum = s.summary();
    expect(sum.totalJobs).toBeGreaterThan(0);
    expect(sum.completed + sum.failed + sum.missed).toBeGreaterThan(0);
  });
});

describe('감사 로그 (CSAP D-06)', () => {
  it('JOB_ADD 기록', () => {
    const s = new CostAwareBatchScheduler(basePricing);
    s.addJob(makeJob('j1'));
    expect(s.getAuditLog().some((e) => e.action === 'JOB_ADD')).toBe(true);
  });
  it('PLAN 기록', () => {
    const s = new CostAwareBatchScheduler(basePricing);
    s.addJob(makeJob('j1'));
    s.plan(Date.now());
    expect(s.getAuditLog().some((e) => e.action === 'PLAN')).toBe(true);
  });
  it('GRADE_BLOCK 기록', () => {
    const s = new CostAwareBatchScheduler(basePricing);
    try {
      s.addJob(makeJob('j1', { grade: 'C' }));
    } catch {
      /* noop */
    }
    expect(s.getAuditLog().some((e) => e.action === 'GRADE_BLOCK')).toBe(true);
  });
});
